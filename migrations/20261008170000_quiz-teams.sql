-- Fixed draw for Liv's hens quiz. Keep existing guests, RSVPs and photos intact.
-- InsForge applies this entire migration in a transaction.
CREATE TABLE public.quiz_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_number smallint NOT NULL UNIQUE CHECK (team_number BETWEEN 1 AND 4),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 60)
);

CREATE TABLE public.quiz_team_members (
  guest_id uuid PRIMARY KEY REFERENCES public.guests(id) ON DELETE RESTRICT,
  team_id uuid NOT NULL REFERENCES public.quiz_teams(id) ON DELETE RESTRICT,
  display_name text NOT NULL UNIQUE CHECK (length(trim(display_name)) BETWEEN 1 AND 60),
  seat_number smallint NOT NULL CHECK (seat_number BETWEEN 1 AND 4),
  UNIQUE (team_id, seat_number)
);

-- Name selection is the existing guest flow. All guests may read the roster;
-- only project administrators may change assignments, even after upload sign-in.
ALTER TABLE public.quiz_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_team_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_teams, public.quiz_team_members FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.quiz_teams, public.quiz_team_members TO anon, authenticated;
CREATE POLICY quiz_teams_read ON public.quiz_teams
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY quiz_team_members_read ON public.quiz_team_members
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.quiz_teams (team_number, name)
VALUES (1, 'Team 1'), (2, 'Team 2'), (3, 'Team 3'), (4, 'Team 4');

-- Resolve both the supplied names and the nicknames observed in the existing
-- backend. Fail atomically on a missing/ambiguous match instead of creating a
-- duplicate guest or attaching someone's RSVP/photos to the wrong person.
DO $quiz$
DECLARE
  assignment record;
  matching_ids uuid[];
BEGIN
  FOR assignment IN
    SELECT * FROM (VALUES
      (1, 1, 'Georgia P', ARRAY['Georgia P', 'Georgie P', 'GP']),
      (1, 2, 'Sue', ARRAY['Sue']),
      (1, 3, 'Lisa', ARRAY['Lisa']),
      (1, 4, 'Claudia', ARRAY['Claudia']),
      (2, 1, 'Bri', ARRAY['Bri']),
      (2, 2, 'Liv', ARRAY['Liv', 'The Bride']),
      (2, 3, 'Lucy', ARRAY['Lucy']),
      (2, 4, 'Bec', ARRAY['Bec']),
      (3, 1, 'Matilda', ARRAY['Matilda', 'Matil']),
      (3, 2, 'Deb', ARRAY['Deb']),
      (3, 3, 'Nicole', ARRAY['Nicole']),
      (3, 4, 'Georgie S', ARRAY['Georgie S', 'G-Shez']),
      (4, 1, 'Nancy', ARRAY['Nancy']),
      (4, 2, 'Vic', ARRAY['Vic']),
      (4, 3, 'Bella', ARRAY['Bella']),
      (4, 4, 'Batsho', ARRAY['Batsho'])
    ) AS draw(team_number, seat_number, display_name, guest_names)
  LOOP
    SELECT array_agg(guest.id) INTO matching_ids
    FROM public.guests AS guest
    WHERE lower(trim(guest.name)) IN (
      SELECT lower(alias) FROM unnest(assignment.guest_names) AS alias
    );

    IF coalesce(cardinality(matching_ids), 0) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one existing guest for %, found %',
        assignment.display_name, coalesce(cardinality(matching_ids), 0);
    END IF;

    INSERT INTO public.quiz_team_members (guest_id, team_id, display_name, seat_number)
    SELECT matching_ids[1], team.id, assignment.display_name, assignment.seat_number
    FROM public.quiz_teams AS team WHERE team.team_number = assignment.team_number;
  END LOOP;

  IF (SELECT count(*) FROM public.quiz_team_members) <> 16 OR EXISTS (
    SELECT team.id FROM public.quiz_teams AS team
    LEFT JOIN public.quiz_team_members AS member ON member.team_id = team.id
    GROUP BY team.id HAVING count(member.guest_id) <> 4
  ) THEN
    RAISE EXCEPTION 'The draw must contain four teams of four unique guests';
  END IF;

  IF (SELECT count(DISTINCT team_id) FROM public.quiz_team_members
      WHERE display_name IN ('Nancy', 'Bri', 'Matilda', 'Georgia P')) <> 4 THEN
    RAISE EXCEPTION 'The school friends must be on separate teams';
  END IF;

  IF (SELECT count(DISTINCT team_id) FROM public.quiz_team_members
      WHERE display_name IN ('Liv', 'Deb', 'Vic', 'Sue')) <> 4 THEN
    RAISE EXCEPTION 'Liv, Deb, Vic and Sue must be on separate teams';
  END IF;
END;
$quiz$;
