-- Carry saved predictions from the previously deployed Trivia survey into Feud.
-- Apply atomically as project_admin after SQL1 and SQL2. Existing choices win.
-- Keep older, already-open survey pages saving into the same live quiz.
DO $validate$
BEGIN
  LOCK TABLE public.trivia_votes IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.feud_game WHERE singleton FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.feud_game WHERE singleton AND phase = 'lobby' AND voting_open) THEN
    RAISE EXCEPTION 'Import survey votes before starting the live quiz';
  END IF;
  IF (SELECT count(*) FROM public.trivia_questions) <> 20 OR
     (SELECT count(*) FROM public.feud_questions) <> 20 OR
     (SELECT count(*) FROM public.trivia_questions legacy_question
       JOIN public.feud_questions current ON current.prompt = legacy_question.prompt
       WHERE legacy_question.options = (SELECT jsonb_agg(option->>'text' ORDER BY position)
         FROM jsonb_array_elements(current.options) WITH ORDINALITY AS options(option, position))) <> 20 THEN
    RAISE EXCEPTION 'The old and new question banks do not match; no votes were imported';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trivia_votes WHERE NOT public.trivia_valid_survey(answers)) THEN
    RAISE EXCEPTION 'An existing survey contains invalid answers; no votes were imported';
  END IF;
END;
$validate$;

INSERT INTO public.feud_votes (guest_id, question_id, option_key, updated_at)
SELECT vote.guest_id, question.id, chr(65 + answer.value::integer), vote.updated_at
FROM public.trivia_votes vote
CROSS JOIN LATERAL jsonb_each_text(vote.answers) answer
JOIN public.trivia_questions legacy_question ON legacy_question.id = answer.key
JOIN public.feud_questions question ON question.prompt = legacy_question.prompt
JOIN public.quiz_team_members member ON member.guest_id = vote.guest_id
WHERE vote.guest_id <> (SELECT liv_guest_id FROM public.feud_settings WHERE singleton)
ON CONFLICT (guest_id, question_id) DO NOTHING;

CREATE FUNCTION public.feud_sync_legacy_survey() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE voting boolean; previous_answers jsonb;
BEGIN
  SELECT voting_open INTO STRICT voting FROM public.feud_game WHERE singleton FOR SHARE;
  IF NOT voting THEN RAISE EXCEPTION 'Survey closed'; END IF;
  IF NEW.guest_id = (SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiz_team_members WHERE guest_id = NEW.guest_id) THEN RETURN NEW; END IF;
  IF NOT public.trivia_valid_survey(NEW.answers) THEN RAISE EXCEPTION 'Invalid survey'; END IF;
  previous_answers := CASE WHEN TG_OP = 'UPDATE' THEN OLD.answers ELSE '{}'::jsonb END;
  INSERT INTO public.feud_votes (guest_id, question_id, option_key, updated_at)
  SELECT NEW.guest_id, question.id, chr(65 + answer.value::integer), NEW.updated_at
  FROM jsonb_each_text(NEW.answers) answer
  JOIN public.trivia_questions legacy_question ON legacy_question.id = answer.key
  JOIN public.feud_questions question ON question.prompt = legacy_question.prompt
  WHERE previous_answers->>answer.key IS DISTINCT FROM answer.value
  ON CONFLICT (guest_id, question_id) DO UPDATE
    SET option_key = EXCLUDED.option_key, updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.feud_sync_legacy_survey() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER feud_sync_legacy_survey
AFTER INSERT OR UPDATE OF answers ON public.trivia_votes
FOR EACH ROW EXECUTE FUNCTION public.feud_sync_legacy_survey();
