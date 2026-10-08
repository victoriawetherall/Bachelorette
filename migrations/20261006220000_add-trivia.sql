-- Additive: existing RSVP/photo/guest tables are untouched.
CREATE TABLE public.trivia_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('family_feud', 'manual')),
  max_points integer NOT NULL CHECK (max_points BETWEEN 1 AND 10000),
  sort_order integer NOT NULL UNIQUE
);
CREATE UNIQUE INDEX trivia_single_feud ON public.trivia_rounds(kind) WHERE kind = 'family_feud';

INSERT INTO public.trivia_rounds (id, name, kind, max_points, sort_order)
VALUES ('f0000000-0000-4000-8000-000000000001', 'Family Feud: According to Liv''s friends', 'family_feud', 150, 0);

CREATE TABLE public.trivia_session (
  id text PRIMARY KEY CHECK (id = 'liv-weekend'),
  survey_open boolean NOT NULL DEFAULT true,
  question_index integer NOT NULL DEFAULT 0 CHECK (question_index BETWEEN 0 AND 14),
  revealed_count integer NOT NULL DEFAULT 0 CHECK (revealed_count BETWEEN 0 AND 5),
  scored_questions integer[] NOT NULL DEFAULT '{}',
  team_names jsonb NOT NULL DEFAULT '["Disco Divas", "Rodeo Queens", "Bride Tribe", "Last Disco"]' CHECK (jsonb_array_length(team_names) = 4),
  active_round_id uuid REFERENCES public.trivia_rounds(id),
  version uuid NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO public.trivia_session (id, active_round_id) VALUES ('liv-weekend', 'f0000000-0000-4000-8000-000000000001');

CREATE TABLE public.trivia_votes (
  guest_id uuid PRIMARY KEY REFERENCES public.guests(id),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object' AND pg_column_size(answers) < 4096),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.trivia_scores (
  team integer NOT NULL CHECK (team BETWEEN 1 AND 4),
  round_id uuid NOT NULL REFERENCES public.trivia_rounds(id),
  points integer NOT NULL CHECK (points BETWEEN 0 AND 10000),
  submitted_by uuid NOT NULL REFERENCES public.guests(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team, round_id)
);
CREATE TABLE public.trivia_predictions (
  team integer NOT NULL CHECK (team BETWEEN 1 AND 4),
  question_index integer NOT NULL CHECK (question_index BETWEEN 0 AND 14),
  answer_index integer NOT NULL CHECK (answer_index BETWEEN 0 AND 4),
  submitted_by uuid NOT NULL REFERENCES public.guests(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team, question_index)
);

-- Browser clients never receive raw votes or unrestricted control access.
-- Next.js accesses these tables with a server-only connection as project_admin.
ALTER TABLE public.trivia_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_predictions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trivia_rounds, public.trivia_session, public.trivia_votes, public.trivia_scores, public.trivia_predictions FROM anon, authenticated;

CREATE FUNCTION public.trivia_bump_version() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.trivia_session SET version = gen_random_uuid() WHERE id = 'liv-weekend';
  RETURN NULL;
END;
$$;
CREATE TRIGGER trivia_votes_version AFTER INSERT OR UPDATE OR DELETE ON public.trivia_votes FOR EACH STATEMENT EXECUTE FUNCTION public.trivia_bump_version();
CREATE TRIGGER trivia_scores_version AFTER INSERT OR UPDATE OR DELETE ON public.trivia_scores FOR EACH STATEMENT EXECUTE FUNCTION public.trivia_bump_version();
CREATE TRIGGER trivia_predictions_version AFTER INSERT OR UPDATE OR DELETE ON public.trivia_predictions FOR EACH STATEMENT EXECUTE FUNCTION public.trivia_bump_version();
CREATE TRIGGER trivia_rounds_version AFTER INSERT OR UPDATE OR DELETE ON public.trivia_rounds FOR EACH STATEMENT EXECUTE FUNCTION public.trivia_bump_version();

CREATE FUNCTION public.trivia_submit_survey(p_guest_id uuid, p_answers jsonb) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE voting_open boolean;
BEGIN
  SELECT survey_open INTO voting_open FROM public.trivia_session WHERE id = 'liv-weekend' FOR UPDATE;
  IF NOT voting_open THEN RAISE EXCEPTION 'Survey closed'; END IF;
  INSERT INTO public.trivia_votes (guest_id, answers) VALUES (p_guest_id, p_answers)
  ON CONFLICT (guest_id) DO UPDATE SET answers = excluded.answers, updated_at = now();
END;
$$;

CREATE FUNCTION public.trivia_save_prediction(p_guest_id uuid, p_team integer, p_question integer, p_answer integer) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.trivia_session; round_kind text;
BEGIN
  SELECT * INTO s FROM public.trivia_session WHERE id = 'liv-weekend' FOR UPDATE;
  SELECT kind INTO round_kind FROM public.trivia_rounds WHERE id = s.active_round_id;
  IF s.survey_open OR round_kind <> 'family_feud' OR s.question_index <> p_question OR s.revealed_count > 0 OR p_question = ANY(s.scored_questions)
  THEN RAISE EXCEPTION 'Predictions locked'; END IF;
  INSERT INTO public.trivia_predictions (team, question_index, answer_index, submitted_by) VALUES (p_team, p_question, p_answer, p_guest_id)
  ON CONFLICT (team, question_index) DO UPDATE SET answer_index = excluded.answer_index, submitted_by = excluded.submitted_by, updated_at = now();
END;
$$;

CREATE FUNCTION public.trivia_save_score(p_guest_id uuid, p_team integer, p_round_id uuid, p_points integer) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE active_id uuid; r public.trivia_rounds;
BEGIN
  SELECT active_round_id INTO active_id FROM public.trivia_session WHERE id = 'liv-weekend' FOR UPDATE;
  IF active_id IS DISTINCT FROM p_round_id THEN RAISE EXCEPTION 'Round changed'; END IF;
  SELECT * INTO r FROM public.trivia_rounds WHERE id = p_round_id;
  IF r.kind <> 'manual' OR p_points < 0 OR p_points > r.max_points THEN RAISE EXCEPTION 'Invalid score'; END IF;
  INSERT INTO public.trivia_scores (team, round_id, points, submitted_by) VALUES (p_team, p_round_id, p_points, p_guest_id)
  ON CONFLICT (team, round_id) DO UPDATE SET points = excluded.points, submitted_by = excluded.submitted_by, updated_at = now();
END;
$$;

CREATE FUNCTION public.trivia_host_action(p_action text, p_value jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE s public.trivia_session; question integer; reveal integer;
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
      UPDATE public.trivia_session SET question_index = question, revealed_count = CASE WHEN question = ANY(s.scored_questions) THEN 5 ELSE 0 END WHERE id = s.id;
    WHEN 'reveal' THEN
      IF s.survey_open THEN RAISE EXCEPTION 'Host rule: Close the guest survey before revealing answers.'; END IF;
      reveal := (p_value #>> '{}')::integer;
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

REVOKE EXECUTE ON FUNCTION public.trivia_bump_version(), public.trivia_submit_survey(uuid,jsonb), public.trivia_save_prediction(uuid,integer,integer,integer), public.trivia_save_score(uuid,integer,uuid,integer), public.trivia_host_action(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trivia_submit_survey(uuid,jsonb), public.trivia_save_prediction(uuid,integer,integer,integer), public.trivia_save_score(uuid,integer,uuid,integer), public.trivia_host_action(text,jsonb) TO project_admin;
