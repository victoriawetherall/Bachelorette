# Plan C: Quiz Master View (the TV)

**Status:** built on `trivia-2`, not yet deployed. All four build-order pieces
are done, nothing cut. Checked at 1920×1080 and 1280×720 against the local
rehearsal: no scrolling in any phase. Scores show inside each round's own view
rather than a separate bottom strip, and Family Feud only shows them from the
reveal onwards. Long content (Trivia stories, 15 advice cards) shrinks to fit.

## Setup on the night

The laptop plugs into the TV as a **second screen (extended display)**.
Everyone is in the room; no Zoom.

| Screen | Page | Who sees it |
| --- | --- | --- |
| TV | **`/tv`** (new), full screen | The whole room |
| Laptop | `/control/...` (existing host pages) | Harry only; shows answers |
| Phones | `/quiz/play` | Guests |

## The problem today

- The TV has one page per round (`/display`, `/display/family`, …). Harry would
  switch tabs on the TV in front of everyone, and the round links show on screen.
- The pages scroll like websites. On a 16:9 TV the team scores fall below the
  fold, and the text is sized for a laptop, not the back of the room.
- Nothing fills the gaps: no welcome screen, no "Round 2 up next", no final
  champion moment.

## The fix: one `/tv` page that runs itself

Like the phones, `/tv` follows whatever round Harry has started, using the
same `quiz_progress()` call and `currentRound()` rule as `/quiz/play`.
Harry opens it once, drags it to the TV and presses full screen. He never
touches it again.

**Safe by construction:** `/tv` only calls the public functions phones already
use (`feud_state`, `quiz_live_state`, `ben_state`, `quiz_final_state`,
`quiz_overall_scores`). It never has the host code, so it cannot show an answer
key, a Trivia story or a Final Round author before the reveal.

### What the TV shows

| Moment | TV screen |
| --- | --- |
| **Before round 1** | Welcome slide: "Liv's Hens Quiz", the site address, the four teams with members and captains, and pre-quiz progress per team |
| **Round live** | That round's existing big-screen view in a TV frame: a header strip ("Round 2 · Trivia · Question 3 of 10") and the question filling the screen, with team scores in a strip along the bottom |
| **Between rounds** | Overall leaderboard plus an "Up next: Round 3 · Facebook Archaeologist" card with that round's one-line rules |
| **After the Final Round** | Champion slide: the winning team, big, then the final standings |

### TV-specific layout rules

- Fills one 1920×1080 screen **with no scrolling**, in every phase of every
  round. This is the main acceptance check.
- No guest bottom nav, no round links, no buttons except a small "Go full
  screen" button that hides itself once full screen.
- Text readable from about 4 m: question text ≥ 48px, options ≥ 32px,
  scores ≥ 40px. Use `clamp()` so a laptop preview still fits.
- Reuse the existing `large` components (`LiveFeud`, `QuizLive`, `BenLive`,
  `FinalRoundView`, `OverallScores`). Fix overflow per round where needed
  rather than rewriting them. Known tight spots: Facebook's four post images
  (2×2 grid capped to the available height) and Trivia's story reveal (long
  text; shrink to fit).

## Small host-side changes

1. **"Open TV ↗"** on every host page points to `/tv`, replacing the per-round
   display links.
2. **LIVE badge** in the host round links on whichever round is live, so
   Harry's laptop always shows where the room is.
3. **Opening the game without a deploy.** The Quiz tab's "Quiz · coming soon"
   button becomes **"Let the games begin 🎉"** automatically once Harry
   presses **Close pre-voting** on `/control`. Sequence: close pre-voting, so
   guests can tap in, pick captains and reach the waiting room. Then
   **Lock votes & start question 1**. No code change is needed at quiz time.

Old `/display/...` pages stay as a backup; nothing is removed.

## Build order and time

| # | Piece | Rough size |
| --- | --- | --- |
| 1 | `/tv` shell: auto-follow, TV frame, full-screen button, between-rounds and welcome slides | main piece |
| 2 | Per-round fit checks at 1920×1080; fix overflow (Facebook grid, Trivia story) | small per round |
| 3 | Champion slide | small |
| 4 | Host "Open TV" links, LIVE badge, Quiz-tab button switch | small |

No database changes are needed: everything uses functions already live.

## Night-of run sheet

1. HDMI into the TV, set **Extend** (not Mirror).
2. Open `liv-bachelorette.vercel.app/tv`, drag the window to the TV and press
   **Go full screen**.
3. On the laptop, open `/control` and enter the host code.
4. When ready: **Close pre-voting**. Tell everyone to open the Quiz tab and
   tap **Let the games begin**. Captains get picked.
5. **Lock votes & start question 1.** The TV and phones switch to Family Feud.
6. Between rounds, the TV shows the leaderboard by itself. Open the next
   round's controls from the host round links (the LIVE badge shows where you
   are) and start it.
7. After the Final Round's Finish, the TV shows the champions.

## Cut list (if short on time)

1. Champion slide. The overall leaderboard already says who won.
2. LIVE badge on host links.
3. Never cut: auto-follow, no-scroll fit, no secrets on the TV.

## Nice to have later

QR code on the welcome slide, confetti on reveals, sound effects, and a
"press F for full screen" shortcut.
