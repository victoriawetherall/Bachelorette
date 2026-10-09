-- Round 5 "Final Round": Liv picks her favourite three pieces of anonymous
-- marriage advice. Authors are revealed 3rd, 2nd, 1st; their teams score
-- 5 / 3 / 1. Apply once after the guest-flow migration. Preserves saved advice.
ALTER TABLE public.quiz_advice ADD COLUMN display_no integer UNIQUE;
CREATE TABLE public.quiz_final (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  phase text NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby','reading','finished')),
  revealed_places integer NOT NULL DEFAULT 0 CHECK (revealed_places BETWEEN 0 AND 3),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.quiz_final DEFAULT VALUES;
CREATE TABLE public.quiz_final_awards (
  place integer PRIMARY KEY CHECK (place BETWEEN 1 AND 3),
  guest_id uuid NOT NULL UNIQUE REFERENCES public.quiz_advice(guest_id)
);
ALTER TABLE public.quiz_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_final_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_final, public.quiz_final_awards FROM PUBLIC, anon, authenticated;

-- Change the points here only.
CREATE FUNCTION public.quiz_final_points(p_place integer) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE p_place WHEN 1 THEN 5 WHEN 2 THEN 3 WHEN 3 THEN 1 ELSE 0 END $$;

-- Up to three places, fewer if fewer people wrote advice.
CREATE FUNCTION public.quiz_final_places() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT least(3,count(*))::integer FROM public.quiz_advice $$;

-- Places are revealed from the bottom: with 3 places, revealing 1 shows 3rd.
CREATE FUNCTION public.quiz_final_is_revealed(p_place integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT p_place > public.quiz_final_places()-(SELECT revealed_places FROM public.quiz_final WHERE singleton) $$;

-- Authors appear only for revealed places. Card text appears once the round starts.
CREATE FUNCTION public.quiz_final_state() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT jsonb_build_object('phase',f.phase,'revealed_places',f.revealed_places,
  'places',public.quiz_final_places(),'entry_count',(SELECT count(*) FROM public.quiz_advice),'updated_at',f.updated_at,
  'entries',CASE WHEN f.phase='lobby' THEN '[]'::jsonb ELSE (SELECT coalesce(jsonb_agg(jsonb_build_object('no',a.display_no,'body',a.body) ORDER BY a.display_no),'[]'::jsonb) FROM public.quiz_advice a) END,
  'awards',(SELECT coalesce(jsonb_agg(jsonb_build_object('place',w.place,'no',a.display_no,'revealed',public.quiz_final_is_revealed(w.place))
      ||CASE WHEN public.quiz_final_is_revealed(w.place) THEN jsonb_build_object('author',m.display_name,'team',t.name,'points',public.quiz_final_points(w.place)) ELSE '{}'::jsonb END
      ORDER BY w.place),'[]'::jsonb)
    FROM public.quiz_final_awards w JOIN public.quiz_advice a ON a.guest_id=w.guest_id
    JOIN public.quiz_team_members m ON m.guest_id=w.guest_id JOIN public.quiz_teams t ON t.id=m.team_id))
FROM public.quiz_final f WHERE f.singleton $$;

-- Who has written advice (names only, never matched to text), for chasing stragglers.
CREATE FUNCTION public.quiz_final_host_state(p_key text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  RETURN public.quiz_final_state()||jsonb_build_object(
    'missing',(SELECT coalesce(jsonb_agg(m.display_name ORDER BY m.display_name),'[]'::jsonb) FROM public.quiz_team_members m
      WHERE m.guest_id<>(SELECT liv_guest_id FROM public.feud_settings WHERE singleton)
      AND NOT EXISTS(SELECT 1 FROM public.quiz_advice a WHERE a.guest_id=m.guest_id)));
END $$;

CREATE FUNCTION public.quiz_final_action(p_key text,p_action text,p_place integer DEFAULT NULL,p_no integer DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_final%ROWTYPE; places integer; chosen uuid;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.quiz_final WHERE singleton FOR UPDATE;
  places:=public.quiz_final_places();
  IF p_action='start' AND game.phase='lobby' THEN
    IF places=0 THEN RAISE EXCEPTION 'No one has written any advice yet'; END IF;
    UPDATE public.quiz_advice a SET display_no=s.n
      FROM (SELECT guest_id,row_number() OVER (ORDER BY random()) AS n FROM public.quiz_advice) s WHERE s.guest_id=a.guest_id;
    UPDATE public.quiz_final SET phase='reading',updated_at=now() WHERE singleton;
  ELSIF p_action IN ('award','clear') AND game.phase='reading' AND game.revealed_places=0 THEN
    IF p_place IS NULL OR p_place NOT BETWEEN 1 AND places THEN RAISE EXCEPTION 'Choose 1st, 2nd or 3rd place'; END IF;
    IF p_action='award' THEN
      SELECT guest_id INTO chosen FROM public.quiz_advice WHERE display_no=p_no;
      IF chosen IS NULL THEN RAISE EXCEPTION 'Pick one of the advice cards'; END IF;
      -- A card holds one place; moving it frees its old place.
      DELETE FROM public.quiz_final_awards WHERE place=p_place OR guest_id=chosen;
      INSERT INTO public.quiz_final_awards VALUES(p_place,chosen);
    ELSE
      DELETE FROM public.quiz_final_awards WHERE place=p_place;
    END IF;
    UPDATE public.quiz_final SET updated_at=now() WHERE singleton;
  ELSIF p_action='reveal' AND game.phase='reading' THEN
    IF (SELECT count(*) FROM public.quiz_final_awards)<places THEN RAISE EXCEPTION 'Pick all % places before revealing',places; END IF;
    -- Revealing a place that is already showing is a harmless repeat.
    IF p_place IS NULL OR p_place<1 OR p_place>places OR p_place<places-game.revealed_places THEN
      RAISE EXCEPTION 'Reveal the places in order: 3rd, 2nd, then 1st';
    END IF;
    IF p_place=places-game.revealed_places THEN
      UPDATE public.quiz_final SET revealed_places=revealed_places+1,updated_at=now() WHERE singleton;
    END IF;
  ELSIF p_action='finish' AND game.phase='reading' AND game.revealed_places=places THEN
    UPDATE public.quiz_final SET phase='finished',updated_at=now() WHERE singleton;
  ELSE RAISE EXCEPTION 'That action is not available at this stage of the round';
  END IF;
END $$;

-- Same as before, plus: advice locks once the Final Round starts.
CREATE OR REPLACE FUNCTION public.quiz_advice_save(p_guest_id uuid, p_body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF (SELECT phase FROM public.quiz_final WHERE singleton FOR SHARE)<>'lobby' THEN
    RAISE EXCEPTION 'The Final Round has started, so advice is locked in';
  END IF;
  IF p_guest_id = (SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN
    RAISE EXCEPTION 'Nice try, Liv! This advice is for you';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiz_team_members WHERE guest_id = p_guest_id) THEN
    RAISE EXCEPTION 'Please select a guest who is playing the quiz';
  END IF;
  IF length(btrim(coalesce(p_body,''))) = 0 THEN
    DELETE FROM public.quiz_advice WHERE guest_id = p_guest_id;
  ELSIF length(btrim(p_body)) > 280 THEN
    RAISE EXCEPTION 'Please keep your advice to 280 characters';
  ELSE
    INSERT INTO public.quiz_advice (guest_id,body) VALUES (p_guest_id,btrim(p_body))
      ON CONFLICT (guest_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now();
  END IF;
END;
$$;

-- Same as before, plus the Final Round.
CREATE OR REPLACE FUNCTION public.quiz_progress() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT jsonb_build_object(
  'liv_guest_id',(SELECT liv_guest_id FROM public.feud_settings WHERE singleton),
  'feud',(SELECT phase FROM public.feud_game WHERE singleton),
  'family',(SELECT phase FROM public.quiz_live_rounds WHERE slug='family'),
  'fake',(SELECT phase FROM public.quiz_live_rounds WHERE slug='fake'),
  'ben',(SELECT phase FROM public.ben_game WHERE singleton),
  'final',(SELECT phase FROM public.quiz_final WHERE singleton)) $$;

-- Same as before, plus a 'final' column counting revealed places only.
CREATE OR REPLACE FUNCTION public.quiz_overall_scores() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT jsonb_agg(to_jsonb(scores)||jsonb_build_object('total',scores.feud+scores.fake+scores.stories+scores.ben+scores.family+scores.final) ORDER BY scores.feud+scores.fake+scores.stories+scores.ben+scores.family+scores.final DESC,scores.team_number)
FROM (
  SELECT t.id,t.name,t.team_number,
    coalesce((SELECT (team->>'points')::numeric FROM jsonb_array_elements(public.feud_state()->'teams')team WHERE (team->>'id')::uuid=t.id),0) AS feud,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='fake' AND r.correct GROUP BY g.points_per_correct),0) AS fake,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='stories' AND r.correct GROUP BY g.points_per_correct),0) AS stories,
    (SELECT count(*) FROM public.ben_predictions p JOIN public.ben_results r ON r.question_id=p.question_id AND r.liv_right=p.liv_right WHERE p.team_id=t.id) AS ben,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='family' AND r.correct GROUP BY g.points_per_correct),0) AS family,
    coalesce((SELECT sum(public.quiz_final_points(w.place)) FROM public.quiz_final_awards w JOIN public.quiz_team_members m ON m.guest_id=w.guest_id
      WHERE m.team_id=t.id AND public.quiz_final_is_revealed(w.place)),0) AS final
  FROM public.quiz_teams t
)scores $$;

REVOKE ALL ON FUNCTION public.quiz_final_points(integer),public.quiz_final_places(),public.quiz_final_is_revealed(integer),
  public.quiz_final_state(),public.quiz_final_host_state(text),public.quiz_final_action(text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_final_state(),public.quiz_final_host_state(text),public.quiz_final_action(text,text,integer,integer)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
