-- Replace the unplayed draft with the supplied 20-question party list.
-- Run as project_admin inside one transaction; never re-interpret existing votes.
LOCK TABLE public.trivia_session, public.trivia_votes, public.trivia_predictions, public.trivia_scores IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trivia_votes)
     OR EXISTS (SELECT 1 FROM public.trivia_predictions)
     OR EXISTS (SELECT 1 FROM public.trivia_scores s JOIN public.trivia_rounds r ON r.id=s.round_id WHERE r.kind='family_feud')
     OR EXISTS (SELECT 1 FROM public.trivia_session WHERE cardinality(scored_questions)>0)
  THEN RAISE EXCEPTION 'Question list already has responses or scoring; preserve those before replacing it'; END IF;
END;
$$;

CREATE TABLE public.trivia_questions (
  id text PRIMARY KEY,
  prompt text NOT NULL CHECK (length(prompt)>0),
  options jsonb NOT NULL CHECK (jsonb_typeof(options)='array' AND jsonb_array_length(options)=4),
  sort_order integer NOT NULL UNIQUE CHECK (sort_order BETWEEN 0 AND 19)
);
ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trivia_questions FROM anon, authenticated;

INSERT INTO public.trivia_questions (id,prompt,options,sort_order) VALUES
('late','If Liv is running late, what''s the most likely reason?','["Forgot to get dressed", "Hungover", "Thought the breakfast was at 7:30PM", "Liv is never running late"]'::jsonb,0),
('award','Which award would Liv win in this friendship group?','["Best Dressed", "Best Listener", "Best Planner", "Best Wingwoman"]'::jsonb,1),
('animal','Which animal is Liv most like?','["Quokka - Always Happy", "Eagle - High Achiever", "Honeybadger - Brave", "Dolphin - Smart"]'::jsonb,2),
('holiday','What is Liv''s role on a group holiday?','["The Accountant", "The Planner", "The Leader", "The Party Girl"]'::jsonb,3),
('support','You have a bad day, and Liv comes round to support you. What does she bring?','["Wine", "Chocolate", "Tissues", "Recorded episodes of the Biggest Loser"]'::jsonb,4),
('superpower','What would Liv''s completely useless superpower be?','["can detect if someone wants to redesign their home, 70% of the time", "Able to talk to anteaters", "Can fall asleep at will on trams", "Can change eye colour one shade"]'::jsonb,5),
('splurge','What would Liv spend a surprise $500 on first?','["A night out with Ben", "MCC Dues", "A new art piece", "Sportsbet Multi"]'::jsonb,6),
('sex-and-city','Which of the four main characters in Sex and the City is Liv most like?','["Charlotte", "Miranda", "Carrie", "Samantha"]'::jsonb,7),
('influencer','If Liv decided to become an online influencer, what niche would she choose?','["TradWife + Sourdough", "Skincare", "Crypto grift", "Conspiracy Theories"]'::jsonb,8),
('advice','Which topic is Liv the worst at giving advice on?','["Should I propose to my boyfriend?", "Which fund should I put my super into?", "Should I quit my job and move to London?", "Should I take this pinger?"]'::jsonb,9),
('brownlow','Liv gets two tickets to the Brownlow. Ben can''t make it. Who does she take as her plus-one?','["Hughesy", "Pete Evans", "Karl Stefanovic", "ScoMo"]'::jsonb,10),
('job','What would be the worst job imaginable for Liv?','["Sex Ed Teacher at Xavier College", "Bali Booze Bus Tour Guide", "International Student Recruiter at Melbourne Uni", "Pork Crackling Taste Tester"]'::jsonb,11),
('tram','Liv sees a man defecate on the Number 8 tram going into the city. What does she say?','["Good Heavens!", "Holy Shit", "Code Brown", "Who ordered the BBQ Chicken?"]'::jsonb,12),
('crime','Liv calls you at 2am asking you to bail her out, what crime has she committed?','["Ripped jeans at the MCC", "Doing 20km in a 5km carpark", "Stealing steaks down her pants at Coles", "Using the KFC Free Wifi to call her friends"]'::jsonb,13),
('task','Nobody can eat until Liv completes a task. Which one do you pick?','["Solve a Rubiks cube", "Make $1000 busking", "Have 10 people join her pyramid scheme", "Get 1000 people to follow her \"Fat Pigeons of Melbourne\" insta"]'::jsonb,14),
('funeral','Which of these four songs would most likely be played at Liv''s funeral?','["My Neck, My Back", "Fuck the Police", "WAP", "Who Let the Dogs Out"]'::jsonb,15),
('cats','How many cats do you think Liv and Ben will have in the next 10 years?','["0", "1", "2-5", "10+"]'::jsonb,16),
('yule-ball','Which Harry Potter Character would most likely ask Liv to the Yule Ball','["Harry", "Ron", "Draco", "Hagrid"]'::jsonb,17),
('favourite','What do you like most about Liv?','["How she makes you laugh", "How she is always loyal", "How she gives the best advice", "How she makes you a better person"]'::jsonb,18),
('new-name','If Liv told you she had legally changed her name, what would her new name be?','["Schapelle", "Trixie", "Watermelonandrea", "Whoa-Livia"]'::jsonb,19);

ALTER TABLE public.trivia_session ADD COLUMN question_set_version text NOT NULL DEFAULT 'liv-party-20-v2';
ALTER TABLE public.trivia_session DROP CONSTRAINT trivia_session_question_index_check;
ALTER TABLE public.trivia_session ADD CONSTRAINT trivia_session_question_index_check CHECK (question_index BETWEEN 0 AND 19);
ALTER TABLE public.trivia_session DROP CONSTRAINT trivia_session_revealed_count_check;
ALTER TABLE public.trivia_session ADD CONSTRAINT trivia_session_revealed_count_check CHECK (revealed_count BETWEEN 0 AND 4);
ALTER TABLE public.trivia_session ADD CONSTRAINT trivia_session_question_fk FOREIGN KEY (question_index) REFERENCES public.trivia_questions(sort_order);
ALTER TABLE public.trivia_predictions DROP CONSTRAINT trivia_predictions_question_index_check;
ALTER TABLE public.trivia_predictions ADD CONSTRAINT trivia_predictions_question_index_check CHECK (question_index BETWEEN 0 AND 19);
ALTER TABLE public.trivia_predictions DROP CONSTRAINT trivia_predictions_answer_index_check;
ALTER TABLE public.trivia_predictions ADD CONSTRAINT trivia_predictions_answer_index_check CHECK (answer_index BETWEEN 0 AND 3);
ALTER TABLE public.trivia_predictions ADD CONSTRAINT trivia_predictions_question_fk FOREIGN KEY (question_index) REFERENCES public.trivia_questions(sort_order);

CREATE FUNCTION public.trivia_valid_survey(p_answers jsonb) RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN false ELSE
   (SELECT count(*) FROM jsonb_object_keys(p_answers)) = (SELECT count(*) FROM public.trivia_questions)
   AND NOT EXISTS (
     SELECT 1 FROM public.trivia_questions q WHERE NOT (
       CASE WHEN jsonb_typeof(p_answers->q.id)='number' AND (p_answers->>q.id) ~ '^[0-9]+$'
       THEN (p_answers->>q.id)::numeric BETWEEN 0 AND jsonb_array_length(q.options)-1
       ELSE false END
     )
   )
 END;
$$;
REVOKE EXECUTE ON FUNCTION public.trivia_valid_survey(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trivia_valid_survey(jsonb) TO project_admin;

CREATE OR REPLACE FUNCTION public.trivia_submit_survey(p_guest_id uuid, p_answers jsonb) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE voting_open boolean;
BEGIN
  SELECT survey_open INTO voting_open FROM public.trivia_session WHERE id = 'liv-weekend' FOR UPDATE;
  IF NOT voting_open THEN RAISE EXCEPTION 'Survey closed'; END IF;
  IF NOT public.trivia_valid_survey(p_answers) THEN RAISE EXCEPTION 'Invalid survey'; END IF;
  INSERT INTO public.trivia_votes (guest_id, answers) VALUES (p_guest_id, p_answers)
  ON CONFLICT (guest_id) DO UPDATE SET answers = excluded.answers, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trivia_save_prediction(p_guest_id uuid, p_team integer, p_question integer, p_answer integer) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.trivia_session; round_kind text; choice_count integer;
BEGIN
  SELECT * INTO s FROM public.trivia_session WHERE id = 'liv-weekend' FOR UPDATE;
  SELECT kind INTO round_kind FROM public.trivia_rounds WHERE id = s.active_round_id;
  SELECT jsonb_array_length(options) INTO choice_count FROM public.trivia_questions WHERE sort_order=p_question;
  IF choice_count IS NULL OR p_answer<0 OR p_answer>=choice_count THEN RAISE EXCEPTION 'Invalid prediction'; END IF;
  IF s.survey_open OR round_kind <> 'family_feud' OR s.question_index <> p_question OR s.revealed_count > 0 OR p_question = ANY(s.scored_questions)
  THEN RAISE EXCEPTION 'Predictions locked'; END IF;
  INSERT INTO public.trivia_predictions (team, question_index, answer_index, submitted_by) VALUES (p_team, p_question, p_answer, p_guest_id)
  ON CONFLICT (team, question_index) DO UPDATE SET answer_index = excluded.answer_index, submitted_by = excluded.submitted_by, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trivia_host_action(p_action text, p_value jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.trivia_session; question integer; reveal integer; choice_count integer;
BEGIN
  SELECT * INTO s FROM public.trivia_session WHERE id = 'liv-weekend' FOR UPDATE;
  CASE p_action
    WHEN 'close_survey' THEN
      IF NOT EXISTS (SELECT 1 FROM public.trivia_votes) THEN RAISE EXCEPTION 'Host rule: Collect at least one guest response before closing voting.'; END IF;
      UPDATE public.trivia_session SET survey_open = false WHERE id = s.id;
    WHEN 'open_survey' THEN
      IF EXISTS (SELECT 1 FROM public.trivia_predictions) OR cardinality(s.scored_questions) > 0 THEN RAISE EXCEPTION 'Host rule: Voting cannot reopen after teams start predicting.'; END IF;
      UPDATE public.trivia_session SET survey_open = true WHERE id = s.id;
    WHEN 'question' THEN
      question := (p_value #>> '{}')::integer;
      SELECT jsonb_array_length(options) INTO choice_count FROM public.trivia_questions WHERE sort_order=question;
      IF choice_count IS NULL THEN RAISE EXCEPTION 'Host rule: Choose a valid question.'; END IF;
      UPDATE public.trivia_session SET question_index = question, revealed_count = CASE WHEN question = ANY(s.scored_questions) THEN choice_count ELSE 0 END WHERE id = s.id;
    WHEN 'reveal' THEN
      IF s.survey_open THEN RAISE EXCEPTION 'Host rule: Close the guest survey before revealing answers.'; END IF;
      reveal := (p_value #>> '{}')::integer;
      SELECT jsonb_array_length(options) INTO choice_count FROM public.trivia_questions WHERE sort_order=s.question_index;
      IF reveal<1 OR reveal>choice_count THEN RAISE EXCEPTION 'Host rule: Choose a valid reveal count.'; END IF;
      UPDATE public.trivia_session SET revealed_count = greatest(revealed_count, reveal), scored_questions = CASE WHEN s.question_index = ANY(s.scored_questions) THEN s.scored_questions ELSE array_append(s.scored_questions, s.question_index) END WHERE id = s.id;
    WHEN 'round' THEN
      IF NOT EXISTS (SELECT 1 FROM public.trivia_rounds WHERE id = (p_value #>> '{}')::uuid) THEN RAISE EXCEPTION 'Host rule: That round does not exist.'; END IF;
      UPDATE public.trivia_session SET active_round_id = (p_value #>> '{}')::uuid WHERE id = s.id;
    WHEN 'teams' THEN
      UPDATE public.trivia_session SET team_names = p_value WHERE id = s.id;
    WHEN 'add_round' THEN
      IF (SELECT count(*) FROM public.trivia_rounds) >= 30 THEN RAISE EXCEPTION 'Host rule: The night already has 30 rounds.'; END IF;
      INSERT INTO public.trivia_rounds (name, max_points, sort_order) SELECT trim(p_value->>'name'), (p_value->>'max_points')::integer, coalesce(max(sort_order), -1) + 1 FROM public.trivia_rounds;
    ELSE RAISE EXCEPTION 'Host rule: Unknown action.';
  END CASE;
  UPDATE public.trivia_session SET version = gen_random_uuid() WHERE id = s.id;
END;
$$;

CREATE TRIGGER trivia_questions_version AFTER INSERT OR UPDATE OR DELETE ON public.trivia_questions FOR EACH STATEMENT EXECUTE FUNCTION public.trivia_bump_version();
UPDATE public.trivia_rounds SET max_points=200 WHERE kind='family_feud';
UPDATE public.trivia_session SET survey_open=true,question_index=0,revealed_count=0,scored_questions='{}',question_set_version='liv-party-20-v2',version=gen_random_uuid() WHERE id='liv-weekend';
