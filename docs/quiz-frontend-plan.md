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

During the round, Liv chooses and locks one answer on her own screen. Harry
reveals it from the host controls. The guest and Zoom views show her pick, the
vote distribution, matching names and updated team totals. Harry advances to the
next question, can show the leaderboard, and can correct a revealed answer.

| Screen | Purpose |
| --- | --- |
| `/quiz` | Team, pre-vote progress and live reveals |
| `/quiz/pre-vote` | Individual saved predictions |
| `/quiz/liv` | Liv's private live choices |
| `/control` | Harry's controls, completion status and corrections |
| `/display` | Shared Zoom question, reveal and leaderboard |
| `/teams` and `/admin/teams` | Roster and organiser copy tools |

Default scoring is one point per matching guest. Liv does not pre-vote, leaving
three eligible voters on Team 2 and four on the other teams. Before starting,
the host can choose adjusted scoring: `4 × matches / eligible voters`.
Missing votes score zero. Ties remain tied. No rank conversion is implemented.

Host and Liv access codes are checked by the database. Unrevealed choices and
vote distributions are withheld from public game state. Guest identity retains
the existing choose-your-name model. See [Family Feud setup](family-feud.md)
for deployment status, access codes, operating steps and verification.

## Later rounds

Real or Fake, Story Time and the Partner Round still need their questions,
correct-answer content and scoring rules before implementation. For these
rounds, one captain per team will submit the shared answer; the other teammates
will see the current team selection. Captain selection and live team-answer
submission are not part of the Family Feud implementation.
