-- Rounds 2–3, shared captains for rounds 2–4, and the overall leaderboard.
-- Apply once after the Family Feud and Ben migrations. Preserves all saved play.
CREATE TABLE public.quiz_team_captains (
  team_id uuid PRIMARY KEY REFERENCES public.quiz_teams(id),
  guest_id uuid NOT NULL UNIQUE REFERENCES public.quiz_team_members(guest_id)
);
CREATE TABLE public.quiz_live_rounds (
  slug text PRIMARY KEY CHECK (slug IN ('fake','stories')),
  title text NOT NULL,
  phase text NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby','question','locked','reveal','leaderboard','finished')),
  current_question_id integer,
  points_per_correct integer NOT NULL DEFAULT 1 CHECK (points_per_correct BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quiz_live_questions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  round_slug text NOT NULL REFERENCES public.quiz_live_rounds(slug),
  position integer NOT NULL CHECK (position > 0),
  prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 2000),
  options jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(options) = 'array'),
  answer text NOT NULL CHECK (length(btrim(answer)) BETWEEN 1 AND 2000),
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (round_slug, position),
  CHECK ((round_slug = 'fake' AND jsonb_array_length(options) = 4 AND answer IN ('A','B','C','D'))
    OR (round_slug = 'stories' AND options = '[]'::jsonb))
);
ALTER TABLE public.quiz_live_rounds ADD FOREIGN KEY (current_question_id) REFERENCES public.quiz_live_questions(id);
CREATE TABLE public.quiz_live_submissions (
  question_id integer NOT NULL REFERENCES public.quiz_live_questions(id),
  team_id uuid NOT NULL REFERENCES public.quiz_teams(id),
  answer text NOT NULL CHECK (length(btrim(answer)) BETWEEN 1 AND 500),
  guest_id uuid NOT NULL REFERENCES public.quiz_team_members(guest_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, team_id)
);
CREATE TABLE public.quiz_live_results (
  question_id integer NOT NULL REFERENCES public.quiz_live_questions(id),
  team_id uuid NOT NULL REFERENCES public.quiz_teams(id),
  correct boolean,
  PRIMARY KEY (question_id, team_id)
);
CREATE INDEX quiz_live_submissions_team_idx ON public.quiz_live_submissions(team_id);
CREATE INDEX quiz_live_results_team_idx ON public.quiz_live_results(team_id);
ALTER TABLE public.quiz_team_captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_live_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_live_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_live_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_live_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_team_captains, public.quiz_live_rounds, public.quiz_live_questions,
  public.quiz_live_submissions, public.quiz_live_results FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.quiz_live_questions_id_seq FROM PUBLIC, anon, authenticated;
INSERT INTO public.quiz_live_rounds(slug,title) VALUES ('fake','Real or Fake'),('stories','Story Time');

-- The existing choose-your-name guest model is retained. Captains prevent
-- accidental teammate overwrites; they are not individual account passwords.
CREATE FUNCTION public.quiz_captains() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('team_id',t.id,'guest_id',c.guest_id,
  'name',m.display_name) ORDER BY t.team_number),'[]'::jsonb)
  FROM public.quiz_teams t LEFT JOIN public.quiz_team_captains c ON c.team_id=t.id
  LEFT JOIN public.quiz_team_members m ON m.guest_id=c.guest_id $$;

CREATE FUNCTION public.quiz_claim_captain(p_guest_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE my_team uuid; existing uuid;
BEGIN
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id=p_guest_id;
  IF my_team IS NULL OR p_guest_id=(SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN
    RAISE EXCEPTION 'Choose a teammate other than Liv as captain';
  END IF;
  PERFORM 1 FROM public.quiz_teams WHERE id=my_team FOR UPDATE;
  SELECT guest_id INTO existing FROM public.quiz_team_captains WHERE team_id=my_team;
  IF existing IS NOT NULL AND existing<>p_guest_id THEN RAISE EXCEPTION 'Your team already has a captain. Ask Harry to change it'; END IF;
  INSERT INTO public.quiz_team_captains VALUES(my_team,p_guest_id) ON CONFLICT(team_id) DO NOTHING;
END $$;

CREATE FUNCTION public.quiz_set_captain(p_key text,p_team_id uuid,p_guest_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.quiz_team_members WHERE team_id=p_team_id AND guest_id=p_guest_id)
    OR p_guest_id IS NULL OR p_guest_id=(SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN
    RAISE EXCEPTION 'Choose a member of this team other than Liv';
  END IF;
  PERFORM 1 FROM public.quiz_teams WHERE id=p_team_id FOR UPDATE;
  INSERT INTO public.quiz_team_captains VALUES(p_team_id,p_guest_id)
    ON CONFLICT(team_id) DO UPDATE SET guest_id=EXCLUDED.guest_id;
END $$;

CREATE FUNCTION public.quiz_live_state(p_round text,p_guest_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE game public.quiz_live_rounds%ROWTYPE; question public.quiz_live_questions%ROWTYPE; my_team uuid; revealed boolean;
BEGIN
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round;
  SELECT * INTO question FROM public.quiz_live_questions WHERE id=game.current_question_id;
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id=p_guest_id;
  revealed:=EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=question.id);
  RETURN jsonb_build_object('slug',game.slug,'title',game.title,'phase',game.phase,
    'current_question_id',game.current_question_id,'updated_at',game.updated_at,
    'points_per_correct',game.points_per_correct,'my_team_id',my_team,
    'liv_guest_id',(SELECT liv_guest_id FROM public.feud_settings WHERE singleton),
    'total_questions',(SELECT count(*) FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled),
    'question_number',(SELECT count(*) FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled AND position<=question.position),
    'revealed_count',(SELECT count(DISTINCT r.question_id) FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id WHERE q.round_slug=p_round),
    'prompt',question.prompt,'options',coalesce(question.options,'[]'::jsonb),
    'correct_answer',CASE WHEN revealed THEN question.answer END,
    'teams',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.team_number) FROM (
      SELECT team.id,team.name,team.team_number,c.guest_id AS captain_id,m.display_name AS captain_name,
        s.team_id IS NOT NULL AS submitted,
        CASE WHEN revealed OR team.id=my_team THEN s.answer END AS answer,
        CASE WHEN revealed THEN r.correct END AS correct,
        coalesce((SELECT count(*)*game.points_per_correct FROM public.quiz_live_results result
          JOIN public.quiz_live_questions q ON q.id=result.question_id
          WHERE result.team_id=team.id AND q.round_slug=p_round AND result.correct),0) AS points
      FROM public.quiz_teams team LEFT JOIN public.quiz_team_captains c ON c.team_id=team.id
      LEFT JOIN public.quiz_team_members m ON m.guest_id=c.guest_id
      LEFT JOIN public.quiz_live_submissions s ON s.team_id=team.id AND s.question_id=question.id
      LEFT JOIN public.quiz_live_results r ON r.team_id=team.id AND r.question_id=question.id
    )t));
END $$;

CREATE FUNCTION public.quiz_live_host_state(p_key text,p_round text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  RETURN public.quiz_live_state(p_round,NULL)||jsonb_build_object(
    'correct_answer',(SELECT q.answer FROM public.quiz_live_questions q JOIN public.quiz_live_rounds g ON g.current_question_id=q.id WHERE g.slug=p_round),
    'teams',(SELECT jsonb_agg(team||jsonb_build_object('answer',s.answer,'submitted_by',m.display_name) ORDER BY (team->>'team_number')::int)
      FROM jsonb_array_elements(public.quiz_live_state(p_round,NULL)->'teams')team
      LEFT JOIN public.quiz_live_submissions s ON s.team_id=(team->>'id')::uuid AND s.question_id=(SELECT current_question_id FROM public.quiz_live_rounds WHERE slug=p_round)
      LEFT JOIN public.quiz_team_members m ON m.guest_id=s.guest_id),
    'questions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'position',q.position,'prompt',q.prompt,'answer',q.answer,'enabled',q.enabled,
      'revealed',EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=q.id)) ORDER BY q.position),'[]'::jsonb) FROM public.quiz_live_questions q WHERE round_slug=p_round));
END $$;

CREATE FUNCTION public.quiz_live_submit(p_guest_id uuid,p_round text,p_question_id integer,p_answer text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_live_rounds%ROWTYPE; my_team uuid;
BEGIN
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round FOR SHARE;
  IF game.phase<>'question' OR game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'Answers are locked for this question'; END IF;
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id=p_guest_id;
  PERFORM 1 FROM public.quiz_team_captains WHERE team_id=my_team AND guest_id=p_guest_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only your team captain can submit the shared answer'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) NOT BETWEEN 1 AND 500
    OR (p_round='fake' AND p_answer NOT IN ('A','B','C','D')) THEN RAISE EXCEPTION 'Choose or type a valid answer'; END IF;
  INSERT INTO public.quiz_live_submissions(question_id,team_id,answer,guest_id) VALUES(p_question_id,my_team,btrim(p_answer),p_guest_id)
    ON CONFLICT(question_id,team_id) DO UPDATE SET answer=EXCLUDED.answer,guest_id=EXCLUDED.guest_id,updated_at=now();
END $$;

CREATE FUNCTION public.quiz_live_action(p_key text,p_round text,p_action text,p_question_id integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_live_rounds%ROWTYPE; next_id integer;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round FOR UPDATE;
  IF game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'The round has moved on. Please refresh'; END IF;
  IF p_action='start' AND game.phase='lobby' THEN
    SELECT id INTO next_id FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled ORDER BY position LIMIT 1;
    IF next_id IS NULL THEN RAISE EXCEPTION 'Add or enable at least one question before starting'; END IF;
    UPDATE public.quiz_live_rounds SET phase='question',current_question_id=next_id,updated_at=now() WHERE slug=p_round;
  ELSIF p_action='lock' AND game.phase='question' THEN
    UPDATE public.quiz_live_rounds SET phase='locked',updated_at=now() WHERE slug=p_round;
  ELSIF p_action='reopen' AND game.phase='locked' THEN
    UPDATE public.quiz_live_rounds SET phase='question',updated_at=now() WHERE slug=p_round;
  ELSIF p_action='reveal' AND game.phase='locked' THEN
    INSERT INTO public.quiz_live_results(question_id,team_id,correct)
      SELECT p_question_id,t.id,CASE WHEN s.answer IS NULL THEN false WHEN p_round='fake' THEN s.answer=q.answer ELSE NULL END
      FROM public.quiz_teams t JOIN public.quiz_live_questions q ON q.id=p_question_id
      LEFT JOIN public.quiz_live_submissions s ON s.team_id=t.id AND s.question_id=p_question_id;
    UPDATE public.quiz_live_rounds SET phase='reveal',updated_at=now() WHERE slug=p_round;
  ELSIF p_action='leaderboard' AND game.phase='reveal' THEN
    IF EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=p_question_id AND correct IS NULL) THEN RAISE EXCEPTION 'Judge all submitted team answers first'; END IF;
    UPDATE public.quiz_live_rounds SET phase='leaderboard',updated_at=now() WHERE slug=p_round;
  ELSIF (p_action='next' AND game.phase IN ('reveal','leaderboard')) OR (p_action='skip' AND game.phase IN ('question','locked')) THEN
    IF EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=p_question_id AND correct IS NULL) THEN RAISE EXCEPTION 'Judge all submitted team answers first'; END IF;
    SELECT id INTO next_id FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled
      AND position>(SELECT position FROM public.quiz_live_questions WHERE id=p_question_id) ORDER BY position LIMIT 1;
    UPDATE public.quiz_live_rounds SET phase=CASE WHEN next_id IS NULL THEN 'finished' ELSE 'question' END,
      current_question_id=coalesce(next_id,current_question_id),updated_at=now() WHERE slug=p_round;
  ELSE RAISE EXCEPTION 'That action is not available at this stage of the round'; END IF;
END $$;

CREATE FUNCTION public.quiz_live_judge(p_key text,p_question_id integer,p_team_id uuid,p_correct boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE round_id text;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT round_slug INTO round_id FROM public.quiz_live_questions WHERE id=p_question_id;
  IF round_id IS DISTINCT FROM 'stories' OR p_correct IS NULL THEN RAISE EXCEPTION 'Only Story Time answers are judged manually'; END IF;
  PERFORM 1 FROM public.quiz_live_rounds WHERE slug=round_id FOR UPDATE;
  IF p_correct AND NOT EXISTS(SELECT 1 FROM public.quiz_live_submissions WHERE question_id=p_question_id AND team_id=p_team_id) THEN RAISE EXCEPTION 'A missing answer cannot earn points'; END IF;
  UPDATE public.quiz_live_results SET correct=p_correct WHERE question_id=p_question_id AND team_id=p_team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reveal this question before judging it'; END IF;
  UPDATE public.quiz_live_rounds SET updated_at=now() WHERE slug=round_id;
END $$;

CREATE FUNCTION public.quiz_live_configure(p_key text,p_round text,p_points integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_live_rounds%ROWTYPE;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round FOR UPDATE;
  IF game.phase<>'lobby' THEN RAISE EXCEPTION 'Scoring is fixed once the round starts'; END IF;
  IF p_points IS NULL OR p_points NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Choose 1–10 points per correct answer'; END IF;
  UPDATE public.quiz_live_rounds SET points_per_correct=p_points,updated_at=now() WHERE slug=p_round;
END $$;

CREATE FUNCTION public.quiz_story_review(p_key text,p_question_id integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.quiz_live_questions q JOIN public.quiz_live_results r ON r.question_id=q.id WHERE q.id=p_question_id AND q.round_slug='stories') THEN RAISE EXCEPTION 'Choose a revealed Story Time question'; END IF;
  RETURN (SELECT jsonb_build_object('prompt',q.prompt,'answer',q.answer,'teams',
    (SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'answer',s.answer,'correct',r.correct) ORDER BY t.team_number)
      FROM public.quiz_teams t LEFT JOIN public.quiz_live_submissions s ON s.team_id=t.id AND s.question_id=q.id
      LEFT JOIN public.quiz_live_results r ON r.team_id=t.id AND r.question_id=q.id))
    FROM public.quiz_live_questions q WHERE q.id=p_question_id);
END $$;

CREATE FUNCTION public.quiz_live_edit_question(p_key text,p_round text,p_id integer,p_prompt text,p_answer text,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_live_rounds%ROWTYPE;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round FOR UPDATE;
  IF game.phase<>'lobby' THEN RAISE EXCEPTION 'Questions are fixed once the round starts'; END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'Choose whether this question is included'; END IF;
  IF p_round='fake' THEN
    UPDATE public.quiz_live_questions SET enabled=p_enabled WHERE id=p_id AND round_slug=p_round;
    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  ELSIF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.quiz_live_questions WHERE round_slug=p_round)>=100 THEN RAISE EXCEPTION 'This round supports up to 100 questions'; END IF;
    INSERT INTO public.quiz_live_questions(round_slug,position,prompt,answer,enabled)
      SELECT p_round,coalesce(max(position),0)+1,btrim(p_prompt),btrim(p_answer),p_enabled FROM public.quiz_live_questions WHERE round_slug=p_round;
  ELSE
    IF EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=p_id) THEN RAISE EXCEPTION 'Played questions cannot be edited'; END IF;
    UPDATE public.quiz_live_questions SET prompt=btrim(p_prompt),answer=btrim(p_answer),enabled=p_enabled WHERE id=p_id AND round_slug=p_round;
    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;
  UPDATE public.quiz_live_rounds SET updated_at=now() WHERE slug=p_round;
END $$;

CREATE FUNCTION public.quiz_overall_scores() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT jsonb_agg(to_jsonb(scores)||jsonb_build_object('total',scores.feud+scores.fake+scores.stories+scores.ben) ORDER BY scores.feud+scores.fake+scores.stories+scores.ben DESC,scores.team_number)
FROM (
  SELECT t.id,t.name,t.team_number,
    coalesce((SELECT (team->>'points')::numeric FROM jsonb_array_elements(public.feud_state()->'teams')team WHERE (team->>'id')::uuid=t.id),0) AS feud,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='fake' AND r.correct GROUP BY g.points_per_correct),0) AS fake,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='stories' AND r.correct GROUP BY g.points_per_correct),0) AS stories,
    (SELECT count(*) FROM public.ben_predictions p JOIN public.ben_results r ON r.question_id=p.question_id AND r.liv_right=p.liv_right WHERE p.team_id=t.id) AS ben
  FROM public.quiz_teams t
)scores $$;

-- Patch the Ben submission surface only. Its questions, predictions and rulings
-- are preserved, and the established live sequence remains unchanged.
CREATE OR REPLACE FUNCTION public.ben_save_prediction(p_guest_id uuid,p_question_id integer,p_liv_right boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.ben_game%ROWTYPE; my_team uuid;
BEGIN
  SELECT * INTO STRICT game FROM public.ben_game WHERE singleton FOR SHARE;
  IF game.phase<>'question' OR game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'Predictions are locked for this question'; END IF;
  IF p_guest_id=(SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN RAISE EXCEPTION 'Nice try, Liv! Your teammates make this call'; END IF;
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id=p_guest_id;
  PERFORM 1 FROM public.quiz_team_captains WHERE team_id=my_team AND guest_id=p_guest_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only your team captain can submit the shared answer'; END IF;
  IF p_liv_right IS NULL THEN RAISE EXCEPTION 'Choose right or wrong'; END IF;
  INSERT INTO public.ben_predictions(team_id,question_id,liv_right,guest_id) VALUES(my_team,p_question_id,p_liv_right,p_guest_id)
    ON CONFLICT(team_id,question_id) DO UPDATE SET liv_right=EXCLUDED.liv_right,guest_id=EXCLUDED.guest_id,updated_at=now();
END $$;

REVOKE ALL ON FUNCTION public.quiz_captains(),public.quiz_claim_captain(uuid),public.quiz_set_captain(text,uuid,uuid),
  public.quiz_live_state(text,uuid),public.quiz_live_host_state(text,text),public.quiz_live_submit(uuid,text,integer,text),
  public.quiz_live_action(text,text,text,integer),public.quiz_live_judge(text,integer,uuid,boolean),
  public.quiz_live_configure(text,text,integer),public.quiz_live_edit_question(text,text,integer,text,text,boolean),
  public.quiz_story_review(text,integer),public.quiz_overall_scores() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_captains(),public.quiz_claim_captain(uuid),public.quiz_set_captain(text,uuid,uuid),
  public.quiz_live_state(text,uuid),public.quiz_live_host_state(text,text),public.quiz_live_submit(uuid,text,integer,text),
  public.quiz_live_action(text,text,text,integer),public.quiz_live_judge(text,integer,uuid,boolean),
  public.quiz_live_configure(text,text,integer),public.quiz_live_edit_question(text,text,integer,text,text,boolean),
  public.quiz_story_review(text,integer),public.quiz_overall_scores() TO anon,authenticated;
