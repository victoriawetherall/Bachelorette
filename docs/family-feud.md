# Family Feud setup and running the quiz

## Current status

Both database migrations have been applied to the live InsForge backend.
Harry's `SQL/SQL1.sql` is identical to `20261008170000_quiz-teams.sql`, and
`SQL/SQL2.sql` is identical to `20261008183000_family-feud.sql`.
Read-only SDK verification on October 8, 2026 confirmed 20 questions, four teams,
the lobby phase, open pre-voting, zero revealed answers, and valid host and Liv
access codes. Do not rerun either migration: `relation "feud_questions" already
exists` is the result of rerunning the Family Feud setup.

The frontend has **not** been deployed. Deploy it before sharing the quiz link.

## Activate

1. Database setup is complete in `z9azv94k.ap-southeast.insforge.app`.
   Preserve the existing tables, saved predictions and access codes.
2. Deploy this frontend to the existing app using its existing InsForge URL and
   anonymous key. No new environment variables or service keys are needed.
3. Open `/quiz`, confirm the roster and pre-vote screen, then open `/control`
   and `/quiz/liv` with the access codes below. Avoid starting the live round
   during the connection check: starting closes voting and there is no reset
   button. The full rehearsal was performed in a separate test database.

The current InsForge CLI account cannot administer this project. Harry applied
the first two SQL files through the dashboard. The deployed trivia worktree
provided the existing server database connection for the compatibility update. Do not create a replacement project. Manually
applied migrations may be absent from CLI history; reconcile that history
before later automated migrations.

## Compatibility with the previously deployed trivia app

The release includes the existing production branch's server-side organiser
login, photo-upload routes and patched Next.js 15.5.27. Old links redirect:
`/trivia` → `/quiz`, `/admin/trivia` → `/control`, and `/present/trivia` → `/display`.

`20261008200000_preserve-survey-votes.sql` was applied transactionally on October
8 after isolated database tests. It preserved the existing legacy ballot and
copied its one eligible saved answer into the new quiz. Existing new-format
answers take precedence during import. A database trigger forwards changed
answers from already-open older survey pages and refuses them after pre-voting
closes. The original response remains intact. The migration validates identical
question text and option order before copying, so choices cannot be reassigned.

## Access codes

Private host and Liv codes are saved in `.quiz/access-codes.json` in this local
worktree. This folder is ignored by Git. The migration contains only their
SHA-256 hashes. Keep a private copy of the codes before deleting the worktree.

Give Liv only her code. Harry uses the host code, which can also enter Liv's
choice if she calls it out. These codes are separate from the existing organiser
password. Each screen remembers its code for the current browser tab session;
use its lock button to clear it. Never put codes in URLs or shared screenshots.

Guests keep the existing choose-your-name identity flow; this is an honour
system, not authenticated individual accounts. Anyone choosing a name can access
that person's saved predictions while using the app. Host and Liv commands are
separately protected in the database. Public game state does not include an
unrevealed Liv choice or aggregate vote distribution.

## Before the event

Send guests the app's `/quiz` link. Each guest selects their own name, checks their
team and answers the 20 questions under “Answer the pre-quiz”. Selections save
immediately. Guests can leave and return, and can change their choices until
pre-voting closes. The host can see every guest's completion count.

Liv is excluded from pre-voting because she chooses live. The default is one
point for each guest whose prediction matches her choice. Team 2 has three
eligible voters; the other teams have four. The host can choose “Adjust for
eligible team size” before starting to use `4 × matches / eligible voters`,
rounded to two decimals in cumulative totals. Missing votes count as zero.
Scoring cannot be changed after the round starts. Equal scores remain tied.

## Live sequence

1. Harry opens `/control`; share only the `/display` tab over Zoom.
2. Liv opens `/quiz/liv` and enters her code. Guests can follow `/quiz`.
3. Harry selects **Lock votes & start question 1**. All predictions lock.
4. Liv taps an option and **Lock in my choice**. Her answer stays hidden from
   the shared display. Harry can see that she is ready.
5. Harry selects **Reveal & score**. Her answer, vote counts, matching guest
   names and team totals appear automatically on the other screens.
6. Harry can show the leaderboard, then select **Next question**. Repeat through
   question 20 and select **Finish round**.

The host can let Liv choose again before a reveal, enter an answer on her behalf,
or correct a revealed answer. Corrections recalculate totals from saved votes.
Repeated reveal requests never add points twice. Refreshing restores the current
round; screens show a reconnect message if they cannot reach the backend.

## Content and verification

All 20 questions and A–D choices were imported, in CSV order, from Harry's
`Hen's Quiz - Sheet1.csv`. Only surrounding whitespace and a stray final quote
on question 15 were cleaned. The source CSV is untouched. Frontend content is
`src/data/feud-questions.json`; initial database content is in the migration.
If editing content before setup, keep both copies in sync.

`tests/feud.integration.cjs` creates its own disposable local PostgreSQL database
and applies both migrations. It checks content parity, vote upserts and locking,
role enforcement, hidden choices, raw and adjusted scores, repeated reveals,
corrections, stale controls, and all 20 questions through completion. Example:

```sh
node tests/feud.integration.cjs /absolute/local/postgres/socket 55468
```

Browser rehearsal uses the actual SQL functions behind a local HTTP adapter,
with synthetic votes and codes. Guest save/resume, locking, Liv selection, host
reveal, team scoring and presentation synchronization are verified there. This
is separate from a full browser check against the deployed frontend. Read-only
live InsForge SDK checks have since confirmed the game state and both access
codes; frontend deployment and its browser check remain pending.

Final local checks on October 8, 2026: the production Next.js build, TypeScript
check, whitespace check and PostgreSQL integration suite all passed. The browser
rehearsal reported no console errors and the pre-vote layout was checked at a
390px phone width. Temporary app and database servers were stopped afterward.
