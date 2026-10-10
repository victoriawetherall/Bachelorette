# Liv’s hens quiz teams

The constrained random draw was made once. Each team has four people, one of
the school friends and one of Liv, Deb, Vic or Sue.

| Team | Guests |
| --- | --- |
| The Reverse Cowgirls | Georgia P, Sue, Lisa, Claudia |
| The Rough Riders | Bri, Liv, Lucy, Bec |
| The Bareback Broncos | Matilda, Deb, Nicole, Georgie S |
| The Brokeback Mountaineers | Nancy, Vic, Bella, Batsho |

Harry confirmed that Georgia P and “Georgie P” are the same person.

## App

- `/teams`: guests use the existing name selection, then see their team and
  the full roster. The roster is also inside the Quiz tab and linked from the returning-guest screen.
- `/admin/teams`: the existing organiser password opens the roster and a copy
  button for pasting it into the group chat.
- Both pages load the same saved InsForge roster. There is no random draw in
  the browser and no guest-facing assignment mutation.

The roster uses `guest_id` for identity and quiz-specific `display_name` for
the supplied names. Existing guest nicknames remain intact: GP → Georgia P,
G-Shez → Georgie S, Matil → Matilda, The Bride → Liv. Existing RSVPs and photos
keep their foreign keys.

## Backend status

Use the app’s existing backend, `https://z9azv94k.ap-southeast.insforge.app`.
Harry executed `migrations/20261008170000_quiz-teams.sql` successfully on
October 8, 2026. The public SDK read and the local production app have been
verified against that live backend: all four teams load, all 16 guest IDs
match existing guests, and the signed-in guest sees their correct team.

The SQL was applied manually rather than through the CLI migration runner.
Do not execute it again. Once the CLI is linked, reconcile its migration
history with the existing schema before running pending migrations.
Do not create a replacement project.

Commands for checking the project and its recorded migration history:

```sh
npx -y @insforge/cli current --json
npx -y @insforge/cli memory list
npx -y @insforge/cli db migrations list
```

The migration resolves all 16 existing guests, refuses missing or ambiguous
matches, creates four teams, seeds the draw, and checks the balance. InsForge
applies migrations atomically. Database constraints allow each guest only one team and
each team at most four seats. Anonymous and signed-in guests have read access
only; assignments require project administrator access.

The nested public SDK read verified against the live backend and used by both
pages is:

```ts
insforge.database.from("quiz_teams")
  .select("id, name, team_number, quiz_team_members(guest_id, display_name, seat_number)")
  .order("team_number", { ascending: true });
```

For later quiz scoring, attach submissions to the existing guest ID and use
`quiz_team_members.team_id` to aggregate them. The Family Feud implementation uses this relationship; see
[Family Feud setup](family-feud.md).
