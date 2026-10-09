-- "What Did Ben Say?": teams predict whether Liv will match Ben's answer.
-- Run once, after the quiz-teams and Family Feud migrations. Reuses the Feud
-- host access code and team roster. Ben's answers stay hidden until revealed.
CREATE TABLE public.ben_questions (
  id integer PRIMARY KEY CHECK (id > 0),
  prompt text NOT NULL,
  ben_answer text NOT NULL
);
CREATE TABLE public.ben_game (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  phase text NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby','question','locked','reveal','judged','leaderboard','finished')),
  current_question_id integer REFERENCES public.ben_questions(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One shared prediction per team per question; any teammate's phone can set it.
-- liv_right = true means "Liv will get it right".
CREATE TABLE public.ben_predictions (
  team_id uuid NOT NULL REFERENCES public.quiz_teams(id),
  question_id integer NOT NULL REFERENCES public.ben_questions(id),
  liv_right boolean NOT NULL,
  guest_id uuid NOT NULL REFERENCES public.quiz_team_members(guest_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, question_id)
);
-- The host's ruling on Liv's live answer.
CREATE TABLE public.ben_results (
  question_id integer PRIMARY KEY REFERENCES public.ben_questions(id),
  liv_right boolean NOT NULL,
  judged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ben_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ben_game ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ben_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ben_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ben_questions, public.ben_game, public.ben_predictions,
  public.ben_results FROM PUBLIC, anon, authenticated;

INSERT INTO public.ben_questions (id, prompt, ben_answer) VALUES
(1, 'What''s your best dish?', 'Probably a disgustingly good stir fry or salmon bowl. Not every time, but occasionally I''ll serve up an 11/10 dish'),
(2, 'What is the one thing you do that frustrates Liv?', 'Sometimes I''m too considerate….. Jokes. Maybe the occasional loud chewing.'),
(3, 'What is the strangest thing you''ve ever argued about?', 'Probably a particular cousin (not naming names)'),
(4, 'Who would last longer in a disastrous match up on Married at First Sight and why?', 'I think I would as Liv would struggle to keep her poker face while listening to a moron'),
(5, 'Where is the strangest place you''ve hooked up?', 'Undisclosed dining table'),
(6, 'What is your favourite memory together?', 'Soooo many to choose from. Some special moments down I Inverloch (first I love you''s & engagement). Special mention to our incredible overseas trip'),
(7, 'What is the one thing you hope never changes about Liv?', 'Her sense of humor and involuntary LOLs'),
(8, 'What would Liv most likely be arrested for?', 'Definitely hate speech (mistakenly), screaming Fang-it! at a car revving up the the street but being missheard'),
(9, 'Who would survive longest in prison, and why?', 'We would both at least make it past day one as we regulary discuss the strategy of punching the biggest person in the face as soon as you arrive. I think Liv would last longer as she has more gangster traits and regulary wears a do-rag around the house.'),
(10, 'Who would be most likely to say “Yeehaw” after one tequila?', 'Definitely Liv. Also potentially wearing a sombrero'),
(11, 'What is the strangest thing Liv does when it''s just the two of you?', 'Maybe an Egg at night (she will explain)'),
(12, 'What is the most ridiculous purchase Liv has made for the wedding?', 'Hmmmm nothing in the rediculous category (yet)'),
(13, 'What is Liv''s most irrational fear?', 'Sitting at a restaurant solo'),
(14, 'What is the one thing you secretly think Liv is amazing at?', 'Dancing. The sheer enjoyment that comes out when she hears a banger. Also she is incredible articulate in her writing (monthly cards, or any speeches)'),
(15, 'What is Liv''s go-to dance move?', 'Blue steel faced mega strut to the nearest wall into standing twerk'),
(16, 'What is the best date Liv''s ever planned?', 'Musical about 9/11');
INSERT INTO public.ben_game (singleton) VALUES (true);

-- Public state. Ben's answer appears only after the reveal; team picks appear
-- only after predictions lock. p_guest_id (nullable) adds that guest's team view.
CREATE FUNCTION public.ben_state(p_guest_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  game public.ben_game%ROWTYPE;
  question public.ben_questions%ROWTYPE;
  result boolean;
  my_team uuid;
  teams jsonb;
BEGIN
  SELECT * INTO STRICT game FROM public.ben_game WHERE singleton;
  SELECT * INTO question FROM public.ben_questions WHERE id = game.current_question_id;
  SELECT liv_right INTO result FROM public.ben_results WHERE question_id = game.current_question_id;
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id = p_guest_id;

  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.team_number) INTO teams FROM (
    SELECT team.id, team.name, team.team_number,
      (SELECT count(*) FROM public.ben_predictions p
        JOIN public.ben_results r ON r.question_id = p.question_id AND r.liv_right = p.liv_right
        WHERE p.team_id = team.id) AS points,
      current.team_id IS NOT NULL AS submitted,
      CASE WHEN game.phase <> 'question' OR team.id = my_team THEN current.liv_right END AS prediction
    FROM public.quiz_teams team
    LEFT JOIN public.ben_predictions current
      ON current.team_id = team.id AND current.question_id = game.current_question_id
  ) t;

  RETURN jsonb_build_object(
    'phase', game.phase,
    'current_question_id', game.current_question_id,
    'question_number', (SELECT count(*) FROM public.ben_questions WHERE id <= game.current_question_id),
    'total_questions', (SELECT count(*) FROM public.ben_questions),
    'judged_count', (SELECT count(*) FROM public.ben_results),
    'prompt', question.prompt,
    'ben_answer', CASE WHEN game.phase IN ('reveal','judged','leaderboard') THEN question.ben_answer END,
    'liv_right', CASE WHEN game.phase IN ('judged','leaderboard') THEN result END,
    'liv_guest_id', (SELECT liv_guest_id FROM public.feud_settings WHERE singleton),
    'my_team_id', my_team,
    'updated_at', game.updated_at,
    'teams', teams);
END;
$$;

-- Host view: always includes the current answer and the full question list.
CREATE FUNCTION public.ben_host_state(p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  RETURN public.ben_state(NULL) || jsonb_build_object(
    'ben_answer', (SELECT q.ben_answer FROM public.ben_questions q JOIN public.ben_game g ON g.current_question_id = q.id),
    'liv_right', (SELECT r.liv_right FROM public.ben_results r JOIN public.ben_game g ON g.current_question_id = r.question_id),
    'teams', (SELECT jsonb_agg(team || jsonb_build_object('prediction', p.liv_right, 'submitted_by', m.display_name)
        ORDER BY (team->>'team_number')::int)
      FROM jsonb_array_elements(public.ben_state(NULL)->'teams') team
      LEFT JOIN public.ben_predictions p ON p.team_id = (team->>'id')::uuid
        AND p.question_id = (SELECT current_question_id FROM public.ben_game WHERE singleton)
      LEFT JOIN public.quiz_team_members m ON m.guest_id = p.guest_id),
    'questions', (SELECT jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'ben_answer', q.ben_answer,
        'liv_right', r.liv_right) ORDER BY q.id)
      FROM public.ben_questions q LEFT JOIN public.ben_results r ON r.question_id = q.id));
END;
$$;

CREATE FUNCTION public.ben_save_prediction(p_guest_id uuid, p_question_id integer, p_liv_right boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE game public.ben_game%ROWTYPE; my_team uuid;
BEGIN
  -- Serialize against the host locking predictions.
  SELECT * INTO STRICT game FROM public.ben_game WHERE singleton FOR SHARE;
  IF game.phase <> 'question' OR game.current_question_id IS DISTINCT FROM p_question_id THEN
    RAISE EXCEPTION 'Predictions are locked for this question';
  END IF;
  IF p_guest_id = (SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN
    RAISE EXCEPTION 'Nice try, Liv! Your teammates make this call';
  END IF;
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id = p_guest_id;
  IF my_team IS NULL THEN RAISE EXCEPTION 'Please select a guest who is playing the quiz'; END IF;
  IF p_liv_right IS NULL THEN RAISE EXCEPTION 'Choose right or wrong'; END IF;
  INSERT INTO public.ben_predictions (team_id, question_id, liv_right, guest_id)
    VALUES (my_team, p_question_id, p_liv_right, p_guest_id)
    ON CONFLICT (team_id, question_id) DO UPDATE
      SET liv_right = EXCLUDED.liv_right, guest_id = EXCLUDED.guest_id, updated_at = now();
END;
$$;

CREATE FUNCTION public.ben_host_action(p_key text, p_action text, p_question_id integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE game public.ben_game%ROWTYPE; next_question integer;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.ben_game WHERE singleton FOR UPDATE;
  IF game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'The round has moved on. Please refresh'; END IF;

  IF p_action = 'start' AND game.phase = 'lobby' THEN
    UPDATE public.ben_game SET phase = 'question',
      current_question_id = (SELECT min(id) FROM public.ben_questions), updated_at = now() WHERE singleton;
  ELSIF p_action = 'lock' AND game.phase = 'question' THEN
    UPDATE public.ben_game SET phase = 'locked', updated_at = now() WHERE singleton;
  ELSIF p_action = 'reopen' AND game.phase = 'locked' THEN
    UPDATE public.ben_game SET phase = 'question', updated_at = now() WHERE singleton;
  ELSIF p_action = 'reveal' AND game.phase = 'locked' THEN
    UPDATE public.ben_game SET phase = 'reveal', updated_at = now() WHERE singleton;
  ELSIF p_action IN ('liv_right','liv_wrong') AND game.phase IN ('reveal','judged','leaderboard') THEN
    INSERT INTO public.ben_results (question_id, liv_right) VALUES (game.current_question_id, p_action = 'liv_right')
      ON CONFLICT (question_id) DO UPDATE SET liv_right = EXCLUDED.liv_right, judged_at = now();
    UPDATE public.ben_game SET phase = CASE WHEN phase = 'reveal' THEN 'judged' ELSE phase END,
      updated_at = now() WHERE singleton;
  ELSIF p_action = 'leaderboard' AND game.phase = 'judged' THEN
    UPDATE public.ben_game SET phase = 'leaderboard', updated_at = now() WHERE singleton;
  ELSIF p_action = 'next' AND game.phase IN ('question','locked','reveal','judged','leaderboard') THEN
    -- From an unjudged phase this skips the question; no points are awarded for it.
    SELECT min(id) INTO next_question FROM public.ben_questions WHERE id > game.current_question_id;
    UPDATE public.ben_game SET phase = CASE WHEN next_question IS NULL THEN 'finished' ELSE 'question' END,
      current_question_id = coalesce(next_question, current_question_id), updated_at = now() WHERE singleton;
  ELSE RAISE EXCEPTION 'That action is not available at this stage of the round';
  END IF;
END;
$$;

-- Fix the ruling on an earlier question. Scores are always derived from rulings.
CREATE FUNCTION public.ben_correct_result(p_key text, p_question_id integer, p_liv_right boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  PERFORM 1 FROM public.ben_game WHERE singleton FOR UPDATE;
  UPDATE public.ben_results SET liv_right = p_liv_right, judged_at = now() WHERE question_id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a judged question can be corrected'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ben_state(uuid), public.ben_host_state(text),
  public.ben_save_prediction(uuid,integer,boolean), public.ben_host_action(text,text,integer),
  public.ben_correct_result(text,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ben_state(uuid), public.ben_host_state(text),
  public.ben_save_prediction(uuid,integer,boolean), public.ben_host_action(text,text,integer),
  public.ben_correct_result(text,integer,boolean) TO anon, authenticated;
