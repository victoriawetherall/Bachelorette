-- Family Feud: individual pre-votes, live choices by Liv, host-led reveals.
-- Run once, after the already-applied quiz-teams migration. No vote data is reset.
CREATE TABLE public.feud_questions (
  id integer PRIMARY KEY CHECK (id > 0),
  prompt text NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4)
);
CREATE TABLE public.feud_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  liv_guest_id uuid NOT NULL REFERENCES public.guests(id),
  host_key_hash text NOT NULL,
  liv_key_hash text NOT NULL
);
CREATE TABLE public.feud_game (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  phase text NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby','question','locked','reveal','leaderboard','finished')),
  voting_open boolean NOT NULL DEFAULT true,
  current_question_id integer REFERENCES public.feud_questions(id),
  scoring text NOT NULL DEFAULT 'matches' CHECK (scoring IN ('matches','adjusted')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.feud_votes (
  guest_id uuid NOT NULL REFERENCES public.quiz_team_members(guest_id),
  question_id integer NOT NULL REFERENCES public.feud_questions(id),
  option_key text NOT NULL CHECK (option_key IN ('A','B','C','D')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_id, question_id)
);
CREATE INDEX feud_votes_question_idx ON public.feud_votes(question_id);
CREATE TABLE public.feud_choices (
  question_id integer PRIMARY KEY REFERENCES public.feud_questions(id),
  option_key text NOT NULL CHECK (option_key IN ('A','B','C','D')),
  revealed_at timestamptz
);

ALTER TABLE public.feud_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feud_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feud_game ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feud_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feud_choices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feud_questions, public.feud_settings, public.feud_game,
  public.feud_votes, public.feud_choices FROM PUBLIC, anon, authenticated;

INSERT INTO public.feud_questions (id,prompt,options) VALUES
(1,'If Liv is running late, what''s the most likely reason?','[{"key": "A", "text": "Forgot to get dressed"}, {"key": "B", "text": "Hungover"}, {"key": "C", "text": "Thought the breakfast was at 7:30PM"}, {"key": "D", "text": "Liv is never running late"}]'::jsonb),
(2,'Which award would Liv win in this friendship group?','[{"key": "A", "text": "Best Dressed"}, {"key": "B", "text": "Best Listener"}, {"key": "C", "text": "Best Planner"}, {"key": "D", "text": "Best Wingwoman"}]'::jsonb),
(3,'Which animal is Liv most like?','[{"key": "A", "text": "Quokka - Always Happy"}, {"key": "B", "text": "Eagle - High Achiever"}, {"key": "C", "text": "Honeybadger - Brave"}, {"key": "D", "text": "Dolphin - Smart"}]'::jsonb),
(4,'What is Liv''s role on a group holiday?','[{"key": "A", "text": "The Accountant"}, {"key": "B", "text": "The Planner"}, {"key": "C", "text": "The Leader"}, {"key": "D", "text": "The Party Girl"}]'::jsonb),
(5,'You have a bad day, and Liv comes round to support you. What does she bring?','[{"key": "A", "text": "Wine"}, {"key": "B", "text": "Chocolate"}, {"key": "C", "text": "Tissues"}, {"key": "D", "text": "Recorded episodes of the Biggest Loser"}]'::jsonb),
(6,'What would Liv''s completely useless superpower be?','[{"key": "A", "text": "can detect if someone wants to redesign their home, 70% of the time"}, {"key": "B", "text": "Able to talk to anteaters"}, {"key": "C", "text": "Can fall asleep at will on trams"}, {"key": "D", "text": "Can change eye colour one shade"}]'::jsonb),
(7,'What would Liv spend a surprise $500 on first?','[{"key": "A", "text": "A night out with Ben"}, {"key": "B", "text": "MCC Dues"}, {"key": "C", "text": "A new art piece"}, {"key": "D", "text": "Sportsbet Multi"}]'::jsonb),
(8,'Which of the four main characters in Sex and the City is Liv most like?','[{"key": "A", "text": "Charlotte"}, {"key": "B", "text": "Miranda"}, {"key": "C", "text": "Carrie"}, {"key": "D", "text": "Samantha"}]'::jsonb),
(9,'If Liv decided to become an online influencer, what niche would she choose?','[{"key": "A", "text": "TradWife + Sourdough"}, {"key": "B", "text": "Skincare"}, {"key": "C", "text": "Crypto grift"}, {"key": "D", "text": "Conspiracy Theories"}]'::jsonb),
(10,'Which topic is Liv the worst at giving advice on?','[{"key": "A", "text": "Should I propose to my boyfriend?"}, {"key": "B", "text": "Which fund should I put my super into?"}, {"key": "C", "text": "Should I quit my job and move to London?"}, {"key": "D", "text": "Should I take this pinger?"}]'::jsonb),
(11,'Liv gets two tickets to the Brownlow. Ben can''t make it. Who does she take as her plus-one?','[{"key": "A", "text": "Hughesy"}, {"key": "B", "text": "Pete Evans"}, {"key": "C", "text": "Karl Stefanovic"}, {"key": "D", "text": "ScoMo"}]'::jsonb),
(12,'What would be the worst job imaginable for Liv?','[{"key": "A", "text": "Sex Ed Teacher at Xavier College"}, {"key": "B", "text": "Bali Booze Bus Tour Guide"}, {"key": "C", "text": "International Student Recruiter at Melbourne Uni"}, {"key": "D", "text": "Pork Crackling Taste Tester"}]'::jsonb),
(13,'Liv sees a man defecate on the Number 8 tram going into the city. What does she say?','[{"key": "A", "text": "Good Heavens!"}, {"key": "B", "text": "Holy Shit"}, {"key": "C", "text": "Code Brown"}, {"key": "D", "text": "Who ordered the BBQ Chicken?"}]'::jsonb),
(14,'Liv calls you at 2am asking you to bail her out, what crime has she committed?','[{"key": "A", "text": "Ripped jeans at the MCC"}, {"key": "B", "text": "Doing 20km in a 5km carpark"}, {"key": "C", "text": "Stealing steaks down her pants at Coles"}, {"key": "D", "text": "Using the KFC Free Wifi to call her friends"}]'::jsonb),
(15,'Nobody can eat until Liv completes a task. Which one do you pick?','[{"key": "A", "text": "Solve a Rubiks cube"}, {"key": "B", "text": "Make $1000 busking"}, {"key": "C", "text": "Have 10 people join her pyramid scheme"}, {"key": "D", "text": "Get 1000 people to follow her \"Fat Pigeons of Melbourne\" insta"}]'::jsonb),
(16,'Which of these four songs would most likely be played at Liv''s funeral?','[{"key": "A", "text": "My Neck, My Back"}, {"key": "B", "text": "Fuck the Police"}, {"key": "C", "text": "WAP"}, {"key": "D", "text": "Who Let the Dogs Out"}]'::jsonb),
(17,'How many cats do you think Liv and Ben will have in the next 10 years?','[{"key": "A", "text": "0"}, {"key": "B", "text": "1"}, {"key": "C", "text": "2-5"}, {"key": "D", "text": "10+"}]'::jsonb),
(18,'Which Harry Potter Character would most likely ask Liv to the Yule Ball','[{"key": "A", "text": "Harry"}, {"key": "B", "text": "Ron"}, {"key": "C", "text": "Draco"}, {"key": "D", "text": "Hagrid"}]'::jsonb),
(19,'What do you like most about Liv?','[{"key": "A", "text": "How she makes you laugh"}, {"key": "B", "text": "How she is always loyal"}, {"key": "C", "text": "How she gives the best advice"}, {"key": "D", "text": "How she makes you a better person"}]'::jsonb),
(20,'If Liv told you she had legally changed her name, what would her new name be?','[{"key": "A", "text": "Schapelle"}, {"key": "B", "text": "Trixie"}, {"key": "C", "text": "Watermelonandrea"}, {"key": "D", "text": "Whoa-Livia"}]'::jsonb);
INSERT INTO public.feud_settings (liv_guest_id,host_key_hash,liv_key_hash)
SELECT guest_id, '6d1751bd79c5a9ca38fec775a70cb02fc0376796cf7a9491ab1a570e406187a5', '007915ceee16bce086e1006a19f20e923c1864e22d71f54c692f9405fae32676' FROM public.quiz_team_members WHERE display_name = 'Liv';
DO $check$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.feud_settings) THEN RAISE EXCEPTION 'Liv is missing from the team roster'; END IF; END; $check$;
INSERT INTO public.feud_game (singleton) VALUES (true);

-- Private helper. Codes are verified by the database, never embedded in the app.
CREATE FUNCTION public.feud_access_role(p_key text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN length(p_key) >= 20 AND encode(sha256(convert_to(p_key,'UTF8')),'hex') = host_key_hash THEN 'host'
    WHEN length(p_key) >= 20 AND encode(sha256(convert_to(p_key,'UTF8')),'hex') = liv_key_hash THEN 'liv'
    ELSE NULL END FROM public.feud_settings WHERE singleton;
$$;
REVOKE ALL ON FUNCTION public.feud_access_role(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.feud_check_access(p_key text, p_role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT coalesce(public.feud_access_role(p_key) = p_role OR
    (p_role = 'liv' AND public.feud_access_role(p_key) = 'host'), false);
$$;

CREATE FUNCTION public.feud_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  game public.feud_game%ROWTYPE;
  bride uuid;
  visible_choice text;
  teams jsonb;
  split jsonb;
BEGIN
  SELECT * INTO STRICT game FROM public.feud_game WHERE singleton;
  SELECT liv_guest_id INTO bride FROM public.feud_settings WHERE singleton;
  SELECT option_key INTO visible_choice FROM public.feud_choices
    WHERE question_id = game.current_question_id AND revealed_at IS NOT NULL;

  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.team_number) INTO teams FROM (
    SELECT team.id, team.name, team.team_number,
      count(DISTINCT member.guest_id) FILTER (WHERE member.guest_id <> bride) AS eligible_voters,
      (SELECT count(*) FROM public.quiz_team_members m WHERE m.team_id = team.id AND m.guest_id <> bride
        AND (SELECT count(*) FROM public.feud_votes v WHERE v.guest_id = m.guest_id)
          = (SELECT count(*) FROM public.feud_questions)) AS completed_voters,
      count(*) FILTER (WHERE vote.option_key = choice.option_key AND choice.revealed_at IS NOT NULL) AS raw_matches,
      CASE WHEN game.scoring = 'adjusted' THEN
        round(4.0 * count(*) FILTER (WHERE vote.option_key = choice.option_key AND choice.revealed_at IS NOT NULL)
          / nullif(count(DISTINCT member.guest_id) FILTER (WHERE member.guest_id <> bride), 0), 2)
      ELSE count(*) FILTER (WHERE vote.option_key = choice.option_key AND choice.revealed_at IS NOT NULL) END AS points,
      coalesce(jsonb_agg(member.display_name ORDER BY member.seat_number) FILTER (
        WHERE vote.question_id = game.current_question_id AND vote.option_key = visible_choice), '[]'::jsonb) AS matching_names
    FROM public.quiz_teams team
    JOIN public.quiz_team_members member ON member.team_id = team.id
    LEFT JOIN public.feud_votes vote ON vote.guest_id = member.guest_id AND member.guest_id <> bride
    LEFT JOIN public.feud_choices choice ON choice.question_id = vote.question_id
    GROUP BY team.id
  ) t;

  IF visible_choice IS NOT NULL THEN
    SELECT jsonb_object_agg(option_key, votes) INTO split FROM (
      SELECT option_key, count(*) AS votes FROM public.feud_votes
      WHERE question_id = game.current_question_id GROUP BY option_key
    ) counts;
  END IF;

  RETURN jsonb_build_object('phase',game.phase,'voting_open',game.voting_open,
    'current_question_id',game.current_question_id,'scoring',game.scoring,
    'liv_guest_id',bride,'updated_at',game.updated_at,
    'total_questions',(SELECT count(*) FROM public.feud_questions),
    'revealed_count',(SELECT count(*) FROM public.feud_choices WHERE revealed_at IS NOT NULL),
    'chosen_option',visible_choice,'distribution',split,'teams',teams);
END;
$$;

-- Name selection remains the existing guest identity model. Votes are private
-- to this RPC surface; aggregate answers stay hidden until a live reveal.
CREATE FUNCTION public.feud_ballot(p_guest_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quiz_team_members WHERE guest_id = p_guest_id) THEN
    RAISE EXCEPTION 'Please select a guest who is playing the quiz';
  END IF;
  RETURN jsonb_build_object(
    'eligible',p_guest_id <> (SELECT liv_guest_id FROM public.feud_settings WHERE singleton),
    'voting_open',(SELECT voting_open FROM public.feud_game WHERE singleton),
    'answers',coalesce((SELECT jsonb_object_agg(question_id,option_key) FROM public.feud_votes WHERE guest_id = p_guest_id),'{}'::jsonb));
END;
$$;

CREATE FUNCTION public.feud_save_vote(p_guest_id uuid, p_question_id integer, p_option text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE voting boolean;
BEGIN
  -- Serialize vote saves against the host closing pre-voting.
  SELECT voting_open INTO voting FROM public.feud_game WHERE singleton FOR SHARE;
  IF NOT voting THEN RAISE EXCEPTION 'Pre-voting has closed. Your saved answers are locked in'; END IF;
  IF p_guest_id = (SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN
    RAISE EXCEPTION 'Liv chooses her answers live';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiz_team_members WHERE guest_id = p_guest_id) THEN
    RAISE EXCEPTION 'Please select a guest who is playing the quiz';
  END IF;
  INSERT INTO public.feud_votes (guest_id,question_id,option_key)
    VALUES (p_guest_id,p_question_id,p_option)
    ON CONFLICT (guest_id,question_id) DO UPDATE SET option_key = EXCLUDED.option_key, updated_at = now();
  RETURN jsonb_build_object('question_id',p_question_id,'option_key',p_option);
END;
$$;

CREATE FUNCTION public.feud_host_state(p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  RETURN public.feud_state() || jsonb_build_object(
    'pending_option',(SELECT option_key FROM public.feud_choices WHERE question_id =
      (SELECT current_question_id FROM public.feud_game WHERE singleton)),
    'submissions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.team_number,s.display_name) FROM (
      SELECT m.guest_id,m.display_name,t.team_number,
        (SELECT count(*) FROM public.feud_votes v WHERE v.guest_id = m.guest_id) AS answered
      FROM public.quiz_team_members m JOIN public.quiz_teams t ON t.id = m.team_id
      WHERE m.guest_id <> (SELECT liv_guest_id FROM public.feud_settings WHERE singleton)
    ) s));
END;
$$;

CREATE FUNCTION public.feud_choose(p_key text, p_question_id integer, p_option text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE game public.feud_game%ROWTYPE;
BEGIN
  IF NOT public.feud_check_access(p_key,'liv') THEN RAISE EXCEPTION 'Invalid Liv access code'; END IF;
  SELECT * INTO STRICT game FROM public.feud_game WHERE singleton FOR UPDATE;
  IF game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'The question has changed. Please refresh'; END IF;
  IF game.phase = 'locked' AND EXISTS (SELECT 1 FROM public.feud_choices WHERE question_id = p_question_id AND option_key = p_option) THEN
    RETURN; -- retrying an already-saved choice is safe
  END IF;
  IF game.phase <> 'question' THEN RAISE EXCEPTION 'Wait for the host to open a question'; END IF;
  INSERT INTO public.feud_choices (question_id,option_key) VALUES (p_question_id,p_option)
    ON CONFLICT (question_id) DO UPDATE SET option_key = EXCLUDED.option_key;
  UPDATE public.feud_game SET phase = 'locked', updated_at = now() WHERE singleton;
END;
$$;

CREATE FUNCTION public.feud_host_action(p_key text, p_action text, p_question_id integer DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE game public.feud_game%ROWTYPE; next_question integer;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.feud_game WHERE singleton FOR UPDATE;
  IF game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'The quiz has moved on. Please refresh'; END IF;

  IF p_action IN ('open_votes','close_votes','score_matches','score_adjusted') AND game.phase = 'lobby' THEN
    UPDATE public.feud_game SET
      voting_open = CASE WHEN p_action = 'open_votes' THEN true WHEN p_action = 'close_votes' THEN false ELSE voting_open END,
      scoring = CASE WHEN p_action = 'score_matches' THEN 'matches' WHEN p_action = 'score_adjusted' THEN 'adjusted' ELSE scoring END,
      updated_at = now() WHERE singleton;
  ELSIF p_action = 'start' AND game.phase = 'lobby' THEN
    UPDATE public.feud_game SET voting_open = false, phase = 'question',
      current_question_id = (SELECT min(id) FROM public.feud_questions), updated_at = now() WHERE singleton;
  ELSIF p_action = 'reveal' AND game.phase IN ('locked','reveal') THEN
    UPDATE public.feud_choices SET revealed_at = coalesce(revealed_at,now()) WHERE question_id = game.current_question_id;
    UPDATE public.feud_game SET phase = 'reveal', updated_at = now() WHERE singleton;
  ELSIF p_action = 'reopen_choice' AND game.phase = 'locked' THEN
    DELETE FROM public.feud_choices WHERE question_id = game.current_question_id AND revealed_at IS NULL;
    UPDATE public.feud_game SET phase = 'question', updated_at = now() WHERE singleton;
  ELSIF p_action = 'leaderboard' AND game.phase IN ('reveal','leaderboard') THEN
    UPDATE public.feud_game SET phase = 'leaderboard', updated_at = now() WHERE singleton;
  ELSIF p_action = 'next' AND game.phase IN ('reveal','leaderboard') THEN
    SELECT min(id) INTO next_question FROM public.feud_questions WHERE id > game.current_question_id;
    UPDATE public.feud_game SET phase = CASE WHEN next_question IS NULL THEN 'finished' ELSE 'question' END,
      current_question_id = coalesce(next_question,current_question_id), updated_at = now() WHERE singleton;
  ELSE RAISE EXCEPTION 'That action is not available at this stage of the quiz';
  END IF;
END;
$$;

-- All score changes are derived from revealed choices, not incremental awards.
CREATE FUNCTION public.feud_correct_choice(p_key text, p_question_id integer, p_option text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  PERFORM 1 FROM public.feud_game WHERE singleton FOR UPDATE;
  UPDATE public.feud_choices SET option_key = p_option WHERE question_id = p_question_id AND revealed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a revealed answer can be corrected'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.feud_check_access(text,text), public.feud_state(),
  public.feud_ballot(uuid), public.feud_save_vote(uuid,integer,text),
  public.feud_host_state(text), public.feud_choose(text,integer,text),
  public.feud_host_action(text,text,integer), public.feud_correct_choice(text,integer,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feud_check_access(text,text), public.feud_state(),
  public.feud_ballot(uuid), public.feud_save_vote(uuid,integer,text),
  public.feud_host_state(text), public.feud_choose(text,integer,text),
  public.feud_host_action(text,text,integer), public.feud_correct_choice(text,integer,text)
  TO anon, authenticated;
