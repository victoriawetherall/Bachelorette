-- "Let the games begin": one guest page that follows the live round.
-- Apply once after the family-trivia migration. Preserves all saved play.

-- Every round's phase in one call, so phones poll once instead of per round.
CREATE FUNCTION public.quiz_progress() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT jsonb_build_object(
  'liv_guest_id',(SELECT liv_guest_id FROM public.feud_settings WHERE singleton),
  'feud',(SELECT phase FROM public.feud_game WHERE singleton),
  'family',(SELECT phase FROM public.quiz_live_rounds WHERE slug='family'),
  'fake',(SELECT phase FROM public.quiz_live_rounds WHERE slug='fake'),
  'ben',(SELECT phase FROM public.ben_game WHERE singleton)) $$;

-- Any teammate can choose the captain (not only themselves). Harry can still
-- change it with quiz_set_captain.
CREATE FUNCTION public.quiz_pick_captain(p_guest_id uuid,p_captain_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE my_team uuid; existing uuid;
BEGIN
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id=p_guest_id;
  IF my_team IS NULL OR NOT EXISTS(SELECT 1 FROM public.quiz_team_members WHERE guest_id=p_captain_id AND team_id=my_team) THEN
    RAISE EXCEPTION 'Choose someone on your own team';
  END IF;
  IF p_captain_id=(SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN
    RAISE EXCEPTION 'Choose a teammate other than Liv as captain';
  END IF;
  PERFORM 1 FROM public.quiz_teams WHERE id=my_team FOR UPDATE;
  SELECT guest_id INTO existing FROM public.quiz_team_captains WHERE team_id=my_team;
  IF existing IS NOT NULL AND existing<>p_captain_id THEN RAISE EXCEPTION 'Your team already has a captain. Ask Harry to change it'; END IF;
  INSERT INTO public.quiz_team_captains VALUES(my_team,p_captain_id) ON CONFLICT(team_id) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.quiz_progress(),public.quiz_pick_captain(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_progress(),public.quiz_pick_captain(uuid,uuid) TO anon, authenticated;

-- New running order: 1 Family Feud, 2 Trivia, 3 Facebook Archaeologist, 4 Ben.
UPDATE public.quiz_live_rounds SET title='Trivia' WHERE slug='family';
UPDATE public.quiz_live_rounds SET title='Facebook Archaeologist' WHERE slug='fake';

NOTIFY pgrst, 'reload schema';
