-- Round 5 "Final Round", take two: Liv blind-ranks the marriage advice. Cards
-- come out one at a time in a shuffled order and Liv gives each one a free spot
-- from #1 (favourite) to #N without seeing what's still to come. Once every
-- card is placed she may make up to three swaps. The top five score 5/4/3/2/1
-- for the writer's team; authors are revealed 5th up to 1st.
-- Apply once after the final-round migration. Saved advice is kept; the round
-- goes back to the lobby.

-- Liv's spot for each card (NULL until placed). Deferrable so a swap can
-- exchange two spots in one statement.
ALTER TABLE public.quiz_advice ADD COLUMN rank integer
  CONSTRAINT quiz_advice_rank_key UNIQUE DEFERRABLE INITIALLY IMMEDIATE;
UPDATE public.quiz_advice SET display_no = NULL;

ALTER TABLE public.quiz_final DROP CONSTRAINT quiz_final_phase_check, DROP CONSTRAINT quiz_final_revealed_places_check;
UPDATE public.quiz_final SET phase = 'lobby', revealed_places = 0, updated_at = now() WHERE singleton;
ALTER TABLE public.quiz_final
  ADD CONSTRAINT quiz_final_phase_check CHECK (phase IN ('lobby','ranking','reveal','finished')),
  ADD CONSTRAINT quiz_final_revealed_places_check CHECK (revealed_places BETWEEN 0 AND 5);

-- Each swap, newest last, so Harry can undo a mis-tap.
CREATE TABLE public.quiz_final_swaps (
  n integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rank_a integer NOT NULL,
  rank_b integer NOT NULL
);
ALTER TABLE public.quiz_final_swaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_final_swaps FROM PUBLIC, anon, authenticated;

-- Change the points and swaps here only.
CREATE OR REPLACE FUNCTION public.quiz_final_points(p_place integer) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_place BETWEEN 1 AND 5 THEN 6 - p_place ELSE 0 END $$;
CREATE FUNCTION public.quiz_final_max_swaps() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;

-- Up to five scoring places, fewer if fewer people wrote advice.
CREATE OR REPLACE FUNCTION public.quiz_final_places() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT least(5,count(*))::integer FROM public.quiz_advice $$;

-- Authors show only after the ranking is locked, from the bottom of the top
-- five up: with 5 places, revealing 1 shows 5th.
CREATE OR REPLACE FUNCTION public.quiz_final_is_revealed(p_place integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT coalesce(f.phase IN ('reveal','finished') AND p_place BETWEEN 1 AND public.quiz_final_places()
  AND p_place > public.quiz_final_places() - f.revealed_places, false)
FROM public.quiz_final f WHERE f.singleton $$;

-- Cards appear only once they've come out: everything placed so far plus the
-- current card. Future cards stay hidden everywhere, including from the host.
CREATE OR REPLACE FUNCTION public.quiz_final_state() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ WITH cur AS (SELECT min(display_no) AS no FROM public.quiz_advice WHERE rank IS NULL)
SELECT jsonb_build_object('phase',f.phase,'revealed_places',f.revealed_places,
  'places',public.quiz_final_places(),'entry_count',(SELECT count(*) FROM public.quiz_advice),'updated_at',f.updated_at,
  'current',CASE WHEN f.phase='ranking' THEN (SELECT no FROM cur) END,
  'last_placed',(SELECT max(display_no) FROM public.quiz_advice WHERE rank IS NOT NULL),
  'swaps_used',(SELECT count(*) FROM public.quiz_final_swaps),'max_swaps',public.quiz_final_max_swaps(),
  'last_swap',(SELECT jsonb_build_array(rank_a,rank_b) FROM public.quiz_final_swaps ORDER BY n DESC LIMIT 1),
  'entries',(SELECT coalesce(jsonb_agg(jsonb_build_object('no',a.display_no,'body',a.body,'rank',a.rank)
      ||CASE WHEN public.quiz_final_is_revealed(a.rank) THEN jsonb_build_object('author',m.display_name,'team',t.name,'points',public.quiz_final_points(a.rank)) ELSE '{}'::jsonb END
      ORDER BY a.display_no),'[]'::jsonb)
    FROM public.quiz_advice a JOIN public.quiz_team_members m ON m.guest_id=a.guest_id JOIN public.quiz_teams t ON t.id=m.team_id
    WHERE a.display_no <= coalesce((SELECT no FROM cur),a.display_no)))
FROM public.quiz_final f WHERE f.singleton $$;

DROP FUNCTION public.quiz_final_action(text,text,integer,integer);
CREATE FUNCTION public.quiz_final_action(p_key text,p_action text,p_rank integer DEFAULT NULL,p_other integer DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_final%ROWTYPE; total integer; places integer; current_no integer; last_swap public.quiz_final_swaps%ROWTYPE;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.quiz_final WHERE singleton FOR UPDATE;
  SELECT count(*) INTO total FROM public.quiz_advice;
  places:=public.quiz_final_places();
  SELECT min(display_no) INTO current_no FROM public.quiz_advice WHERE rank IS NULL;
  IF p_action='start' AND game.phase='lobby' THEN
    IF total=0 THEN RAISE EXCEPTION 'No one has written any advice yet'; END IF;
    UPDATE public.quiz_advice a SET display_no=s.n,rank=NULL
      FROM (SELECT guest_id,row_number() OVER (ORDER BY random()) AS n FROM public.quiz_advice) s WHERE s.guest_id=a.guest_id;
    DELETE FROM public.quiz_final_swaps;
    UPDATE public.quiz_final SET phase='ranking',revealed_places=0 WHERE singleton;
  ELSIF p_action='place' AND game.phase='ranking' AND current_no IS NOT NULL THEN
    IF p_rank IS NULL OR p_rank NOT BETWEEN 1 AND total THEN RAISE EXCEPTION 'Pick a spot from #1 to #%',total; END IF;
    IF EXISTS(SELECT 1 FROM public.quiz_advice WHERE rank=p_rank) THEN RAISE EXCEPTION 'Spot #% is already taken',p_rank; END IF;
    UPDATE public.quiz_advice SET rank=p_rank WHERE display_no=current_no;
  ELSIF p_action='swap' AND game.phase='ranking' AND current_no IS NULL THEN
    IF (SELECT count(*) FROM public.quiz_final_swaps)>=public.quiz_final_max_swaps() THEN
      RAISE EXCEPTION 'Liv has used all % swaps',public.quiz_final_max_swaps();
    END IF;
    IF p_rank IS NULL OR p_other IS NULL OR p_rank=p_other OR least(p_rank,p_other)<1 OR greatest(p_rank,p_other)>total THEN
      RAISE EXCEPTION 'Pick two different spots to swap';
    END IF;
    UPDATE public.quiz_advice SET rank=CASE WHEN rank=p_rank THEN p_other ELSE p_rank END WHERE rank IN (p_rank,p_other);
    INSERT INTO public.quiz_final_swaps(rank_a,rank_b) VALUES(p_rank,p_other);
  ELSIF p_action='undo' AND game.phase='ranking' THEN
    -- Takes back the last swap or, if there are none, the last card placed.
    SELECT * INTO last_swap FROM public.quiz_final_swaps ORDER BY n DESC LIMIT 1;
    IF FOUND THEN
      UPDATE public.quiz_advice SET rank=CASE WHEN rank=last_swap.rank_a THEN last_swap.rank_b ELSE last_swap.rank_a END
        WHERE rank IN (last_swap.rank_a,last_swap.rank_b);
      DELETE FROM public.quiz_final_swaps WHERE n=last_swap.n;
    ELSIF EXISTS(SELECT 1 FROM public.quiz_advice WHERE rank IS NOT NULL) THEN
      UPDATE public.quiz_advice SET rank=NULL WHERE display_no=(SELECT max(display_no) FROM public.quiz_advice WHERE rank IS NOT NULL);
    ELSE RAISE EXCEPTION 'Nothing to undo yet';
    END IF;
  ELSIF p_action='lock' AND game.phase='ranking' AND current_no IS NULL THEN
    UPDATE public.quiz_final SET phase='reveal' WHERE singleton;
  ELSIF p_action='reveal' AND game.phase='reveal' THEN
    -- Revealing a place that is already showing is a harmless repeat.
    IF p_rank IS NULL OR p_rank<1 OR p_rank>places OR p_rank<places-game.revealed_places THEN
      RAISE EXCEPTION 'Reveal the places in order, from #% up to #1',places;
    END IF;
    IF p_rank=places-game.revealed_places THEN
      UPDATE public.quiz_final SET revealed_places=revealed_places+1 WHERE singleton;
    END IF;
  ELSIF p_action='finish' AND game.phase='reveal' AND game.revealed_places=places THEN
    UPDATE public.quiz_final SET phase='finished' WHERE singleton;
  ELSE RAISE EXCEPTION 'That action is not available at this stage of the round';
  END IF;
  UPDATE public.quiz_final SET updated_at=now() WHERE singleton;
END $$;

-- Same as before, with 'final' now counting revealed top-five spots.
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
    coalesce((SELECT sum(public.quiz_final_points(a.rank)) FROM public.quiz_advice a JOIN public.quiz_team_members m ON m.guest_id=a.guest_id
      WHERE m.team_id=t.id AND public.quiz_final_is_revealed(a.rank)),0) AS final
  FROM public.quiz_teams t
)scores $$;

-- The 3-place awards are replaced by quiz_advice.rank.
DROP TABLE public.quiz_final_awards;

REVOKE ALL ON FUNCTION public.quiz_final_max_swaps(),public.quiz_final_action(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_final_action(text,text,integer,integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
