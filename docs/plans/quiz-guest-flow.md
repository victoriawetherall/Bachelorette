# Plan B: "Let the games begin" guest flow

**Status:** plan, not built. Target: tonight's quiz (Fri Oct 9).

## The problem

Today each round has its own URL (`/quiz`, `/quiz/fake`, `/quiz/stories`,
`/quiz/ben`). Guests on phones would have to find or type the right one every
round. That won't work in a loud room.

## The fix

One button on the Quiz tab, **"Let the games begin 🎉"**, opens `/quiz/play`.
That single page does everything for the rest of the night:

1. **Pick your captain** (skipped if your team already has one).
2. **Waiting room**: "Round 1: Family Feud starts soon".
3. **Follows Harry automatically.** When Harry starts a round, every phone
   switches to it. When the round ends, phones go back to the waiting room
   for the next round. Guests never navigate.

Guests are already identified by the landing page, so `/quiz/play` uses the
same choose-your-name gate as every other guest page.

## Round order (new)

| # | Title | Existing slug / code | Change |
| --- | --- | --- | --- |
| 1 | Family Feud | `feud_*` | none |
| 2 | **Trivia** | `stories` | rename from "Story Time"; moves from 3 to 2 |
| 3 | **Facebook Archaeologist** | `fake` | rename from "Real or Fake"; moves from 2 to 3 |
| 4 | What Did Ben Say? | `ben_*` | none |
| 5 | **Final Round** | new (Plan A) | new |

Slugs stay as they are; only titles and order change. Renaming slugs would
touch saved data for no benefit. Title strings to update:
`QuizRoundNav`, `LiveQuizGuest`, `LiveQuizHost`, `LiveQuizDisplay`,
`OverallScores`, plus `UPDATE quiz_live_rounds SET title = …` in SQL.

## Which round is "live"?

Each round already stores its own `phase` (`lobby` … `finished`). Rather than
adding a "current round" switch Harry has to remember to flip, derive it:

> **The live round is the highest-numbered round that has left the lobby.**
> If that round is `finished`, guests wait for the next one.

This copes with Harry forgetting to press "Finish round" on round 1 before
starting round 2: round 2 wins because it's higher.

### Database (`migrations/20261009181000_guest-flow.sql`, after Plan A's)

- `quiz_progress()` (public) returns
  `[{ number, slug, title, phase }]` for all five rounds. It is one cheap call
  for phones to poll every 2s instead of five. It reads only phases, never
  answers.
- `quiz_pick_captain(p_guest_id, p_captain_id)`: any teammate can choose
  the captain (not only themselves). It checks both are on the same team, the
  captain isn't Liv, and the team doesn't already have one. Harry can still
  change captains from the host controls, as today.
- The two title `UPDATE`s.

## `/quiz/play` screens

**Step 1: Captain** (only if your team has no captain)

```
Team 3: Who's your captain?
The captain submits your team's answers for rounds 2–4.
[ Bri ] [ Deb ] [ Sue ]          ← teammates, Liv excluded
[ Confirm Deb as captain ]
```

If your team already has one: skip straight to step 2 and show
"Deb is your captain". Liv skips this step ("Your team's choosing a captain.
You're busy being the star.").

**Step 2: Waiting room** (no round live)

- "Up next: Round 2 · Trivia". Before round 1, the next round is Family Feud.
- Your team and captain.
- Overall scores, once at least one round is finished.
- Nudges, only while still relevant: "Finish your pre-quiz (14/20)" while
  Family Feud voting is open, and "Add your marriage advice" until the Final
  Round starts. Both link to the existing pages.

**Step 3: Live round** renders that round's existing guest component inside
the page:

| Round | Component | Prep needed |
| --- | --- | --- |
| Family Feud | `LiveFeud` | none, already a component |
| Trivia / Facebook | `LiveQuizGuest` | add an `embedded` prop that hides its own `<main>`, header nav and round links |
| Ben | `/quiz/ben` page body | extract into a `BenGuest` component; the page keeps working by rendering it |
| Final | `FinalGuest` | new, from Plan A |

Only the live round's component is mounted, so phones poll one round plus
`quiz_progress`.

## Quiz tab (`/quiz`) becomes the pre-game hub

- The big **"Let the games begin 🎉"** button at the top.
- Team card, pre-quiz progress button, and advice card (Plan A).
- Remove `QuizRoundNav` from guest pages. Host and display keep it. Old round
  URLs keep working as a backup, but nobody needs them.
- Add `/quiz/play` to the allowed `next` list in `src/app/page.tsx`, so a
  shared link survives the name picker.

## Tests

- Extend `tests/live-quiz.integration.cjs`: `quiz_pick_captain` rules (same
  team, not Liv, no overwrite) and `quiz_progress` returning phases only.
- Browser check at 390px: a guest goes Quiz tab → button → captain → waiting
  room. Harry starts round 1 and the phone switches. Finish, then the phone
  returns to "Up next: Trivia".

## Cut list (if short on time)

1. Keep the existing "I'll be our captain" self-claim instead of
   `quiz_pick_captain`.
2. Skip the overall scores in the waiting room.
3. Never cut: the auto-follow. It's the whole point.

## Out of scope here

The TV / Quiz Master View. That's the next plan, and it will reuse
`quiz_progress()` so the TV can auto-follow the same way.
