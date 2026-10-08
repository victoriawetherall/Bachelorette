-- Accept individual answers and partial ballots without deleting existing votes.
-- Apply transactionally as project_admin; existing rows and game state are preserved.
CREATE OR REPLACE FUNCTION public.trivia_valid_survey(p_answers jsonb) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN false ELSE
   (SELECT count(*) FROM jsonb_object_keys(p_answers)) > 0
   AND NOT EXISTS (
     SELECT 1 FROM jsonb_each(p_answers) a
     LEFT JOIN public.trivia_questions q ON q.id=a.key
     WHERE NOT (
       CASE WHEN q.id IS NOT NULL AND jsonb_typeof(a.value)='number'
                 AND (a.value #>> '{}') ~ '^[0-9]+$'
       THEN (a.value #>> '{}')::numeric BETWEEN 0 AND jsonb_array_length(q.options)-1
       ELSE false END
     )
   )
 END;
$$;

CREATE OR REPLACE FUNCTION public.trivia_submit_survey(p_guest_id uuid, p_answers jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE voting_open boolean;
BEGIN
  SELECT survey_open INTO voting_open FROM public.trivia_session WHERE id='liv-weekend' FOR UPDATE;
  IF NOT voting_open THEN RAISE EXCEPTION 'Survey closed'; END IF;
  IF NOT public.trivia_valid_survey(p_answers) THEN RAISE EXCEPTION 'Invalid survey'; END IF;
  INSERT INTO public.trivia_votes (guest_id,answers) VALUES (p_guest_id,p_answers)
  ON CONFLICT (guest_id) DO UPDATE
    SET answers=public.trivia_votes.answers || excluded.answers,updated_at=now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trivia_valid_survey(jsonb), public.trivia_submit_survey(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trivia_valid_survey(jsonb), public.trivia_submit_survey(uuid,jsonb) TO project_admin;
