# Quiz frontend plan and current implementation

Harry confirmed that other live rounds should use one shared answer per team.
Family Feud uses individual predictions submitted before the event. On October
8, Harry supplied `Hen's Quiz - Sheet1.csv` and confirmed that Liv chooses each
answer live, one question at a time. There is no fixed answer key.

## Implemented: Family Feud

The Quiz tab shows the saved four-team roster and each guest's pre-vote progress.
Guests answer the 20 supplied questions individually. Every selection saves to
the backend; refresh resumes at the first unanswered question. Guests can review
or change predictions until the host closes voting or starts the round.

During the round, the room sees the question and four options on the shared
display. Liv calls out her answer, and Harry taps it on the host controls and
confirms. Confirming reveals it immediately. Liv has no separate screen. The guest and Zoom views then show
her pick, the vote distribution, matching names and updated team totals. Harry advances to the
next question, can show the leaderboard, and can correct a revealed answer.

| Screen | Purpose |
| --- | --- |
| `/quiz` | Team, pre-vote progress and live reveals |
| `/quiz/pre-vote` | Individual saved predictions |
| `/control` | Harry's controls, completion status and corrections |
| `/display` | Shared Zoom question, reveal and leaderboard |
| `/teams` and `/admin/teams` | Roster and organiser copy tools |

Default scoring is one point per matching guest. Liv does not pre-vote, leaving
three eligible voters on Team 2 and four on the other teams. Before starting,
the host can choose adjusted scoring: `4 × matches / eligible voters`.
Missing votes score zero. Ties remain tied. No rank conversion is implemented.

The host access code is checked by the database. Unrevealed choices and
vote distributions are withheld from public game state. Guest identity retains
the existing choose-your-name model. See [Family Feud setup](family-feud.md)
for deployment status, access codes, operating steps and verification.

## Rounds 2–4 (implemented locally on October 9)

The committed Family Feud and Ben base is on `trivia-2`. The additional work is
on `codex/quiz-rounds-2-4`; the original stash and other worktrees were preserved.
The new frontend and the two new migrations have not been deployed/applied to
the live game. Production verification found Family Feud in the lobby with one
saved individual prediction and the existing Ben tables present.

| Round | Guest | Host | Shared display |
| --- | --- | --- | --- |
| 2 · Real or Fake | `/quiz/fake` | `/control/fake` | `/display/fake` |
| 3 · Story Time | `/quiz/stories` | `/control/stories` | `/display/stories` |
| 4 · What Did Ben Say? | `/quiz/ben` | `/control/ben` | `/display/ben` |
| Overall leaderboard | `/quiz/scoreboard` | `/control/scoreboard` | `/display/scoreboard` |

Each team chooses one captain for all three team rounds. A guest can volunteer
when their team has no captain; the host can choose or change a captain through
the Real or Fake or Story Time controls. Liv cannot captain because she answers
live in the Ben round. Teammates see their saved shared answer; only the captain
can submit or update it. This retains the existing choose-your-name honour
system, rather than introducing individual accounts.

Real or Fake uses all ten supplied sets of three real Facebook posts and one
fake. The four A–D positions were shuffled once during preparation and persist
across refresh and every player's screen. Asset names are opaque, with a common
extension. All views load the original files directly because Vercel's image
optimizer rejects the neutral `.asset` URLs. The UI renders posts at the same
width while preserving proportions. The
posts are normalized to 680px-wide PNGs with metadata stripped, so format and
resolution don't give away the fake; no text or artwork was edited.
The private source mapping lives in ignored `.quiz/facebook-assets.json`.
The answer key lives only in database seed SQL, never in client question data.

Story Time has a host question editor with accepted answers, inclusion switches,
and edits before starting. Its actual event questions still need to be entered:
no personal stories or answers were invented. Teams submit free text. The host
locks submissions, reveals the accepted answer, then judges each submitted team
answer as correct or incorrect. The host must judge submitted answers before
advancing. Missing answers earn zero. Revealed questions can be reviewed and
their rulings corrected later; scores recalculate automatically.

The existing 16-question Ben round is preserved: teams predict whether Liv will
match Ben, the host locks calls, Liv answers aloud, Ben's answer is revealed,
and the host rules right/wrong. The new migration restricts submissions to the
shared captain. One point is awarded per correct team prediction.

Defaults for Real or Fake and Story Time are one point per correct team. The
host can choose 1–10 points before starting and exclude questions/image sets.
Scoring and content are fixed once the round starts. The overall leaderboard
sums all four round totals, including Family Feud's selected scoring mode.
Equal totals share a rank. These defaults can be revised when Harry supplies
different scoring rules; individual Family Feud matches naturally carry more
potential points than one shared answer per team.

### Activate together

1. Confirm the existing teams, Family Feud and Ben migrations are already
   applied. Do not rerun old setup SQL or reset the saved votes.
2. Apply `migrations/20261009143000_live-quiz-rounds.sql`, then
   `migrations/20261009143100_facebook-content.sql`, each transactionally.
   Reload the PostgREST schema cache (`NOTIFY pgrst, 'reload schema'`) if
   applying manually. The first migration changes Ben's submission rules, so
   pair it with this frontend release before guests play the Ben round.
3. Deploy this branch to the existing Vercel app with its existing environment
   variables. No new project or secret is needed. The same private host code
   opens all control screens; codes are never passed in URLs.
4. Add the actual Story Time questions at `/control/stories`, choose captains,
   and check the round points. Share the corresponding `/display/...` tab
   over Zoom. Keep host controls private.
5. Start a round, collect captain answers, lock them, then reveal. Judge Story
   Time answers or Liv's Ben answer as applicable. Use the overall display
   between rounds. There is deliberately no destructive reset of saved play.

### Verification

The production Next.js build, TypeScript check and whitespace check passed.
The original Family Feud and Ben integration suites passed, as did the new
`tests/live-quiz.integration.cjs` suite using disposable PostgreSQL. The new
suite verifies private data grants, captain claims/changes, denied non-captain
submissions, teammate visibility, stale actions, locking/reopening, hidden
answers, repeat reveals, missing votes, skipping, Story Time judging and
corrections, and combined scores across all four rounds.

The browser rehearsal used the real SQL functions through
`tests/quiz-rehearsal.cjs` with synthetic data. It verified guest deep links,
captain selection, all four neutral images loading at a 390px phone width,
Facebook submission/reveal/scoring, Story Time question entry and judging,
Ben captain predictions/reveals/rulings, and the combined leaderboard. No
browser console errors were observed. Synthetic stories exist only in the
disposable rehearsal database, not in the migration or live backend.
