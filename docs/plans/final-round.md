# Plan A: Final Round (blind marriage advice)

**Status:** plan, not built. Target: tonight's quiz (Fri Oct 9).

## The idea

While doing the Family Feud pre-quiz, each guest writes one piece of marriage
advice for Liv. In the Final Round, the TV shows every piece **anonymously**.
Liv calls out her favourite 3rd, 2nd and 1st. Harry taps them in. Then the
authors are revealed one place at a time, and their teams score **5 / 3 / 1**.

Liv never uses a screen (same rule as Family Feud: she shouts, Harry enters).
Authors stay hidden everywhere, including Harry's controls, until each
place is revealed. That matters because Harry's laptop may also be driving the TV.

## Two parts, two deploys

| Part | What | Why separate |
| --- | --- | --- |
| **A1. Collect advice** | Table, save function, form on the pre-quiz and the Quiz tab | Ship **first, this afternoon**, so guests have time to write before tonight |
| **A2. Run the round** | Host controls, guest view, basic TV view, scoring | Only needed by the end of the quiz |

## A1. Collect advice

### Database (`migrations/20261009180000_final-round.sql`, part 1)

```
quiz_advice
  guest_id    uuid PK  → quiz_team_members(guest_id)
  body        text     1–280 chars
  display_no  integer  NULL until the round starts, then a shuffled 1..N
  updated_at  timestamptz
```

Functions (same style as `feud_save_vote`: security definer, RLS on, no table grants):

- `quiz_advice_mine(p_guest_id)` returns `{ body, open }`
- `quiz_advice_save(p_guest_id, p_body)`
  - Rejects Liv ("You're the judge, Liv!").
  - Rejects once the Final Round has started.
  - Empty text deletes the entry. One entry per guest; re-saving overwrites.

### Guest UI

- **End of the pre-quiz** (`/quiz/pre-vote`): an advice card after question 20.
  It also appears once all 20 are answered, so people who already finished see it.
- **Quiz tab** (`/quiz`): an "Add your marriage advice 💍" card, whether or
  not pre-voting is still open. Advice has its own lock (the Final Round
  starting), not Family Feud's.
- Copy: "Liv won't know it's from you until she's picked her favourites."

Once deployed, post in the group chat that advice is open.

## A2. Run the round

### Database (part 2, same migration)

```
quiz_final            singleton
  phase              'lobby' | 'reading' | 'finished'
  revealed_places    0..3   (how many authors are on screen)
quiz_final_awards
  place              1..3 PK
  guest_id           unique → quiz_advice(guest_id)
```

Points live in one SQL function, `quiz_final_points(place)` → 5 / 3 / 1, so
they are easy to change. **Scale check:** Family Feud can be worth up to ~80
per team, so 5/3/1 is a tiebreaker-sized bonus. If you want the final to
matter more, change only that function (e.g. 20 / 10 / 5).

| Function | Who | Does |
| --- | --- | --- |
| `quiz_final_state()` | public | Phase, entries as `{no, body}` (only after start), awards as `{place, no}`, and for **revealed** places only, `author`, `team`, `points` |
| `quiz_final_host_state(p_key)` | host | Same, plus who has or hasn't written advice (names only, never text matched to names) |
| `quiz_final_action(p_key, action, place, no)` | host | `start`: locks advice and shuffles `display_no`. `award`/`clear` a place. `reveal_next`: requires all places filled (or fewer if fewer than 3 entries). `finish` |

`quiz_overall_scores()` is replaced to add a `final` column. It counts
**revealed** places only, so the leaderboard can't spoil the reveal.

### Screens

- **`/control/final`**: Start round. All cards are shown as tappable numbers.
  Tap a card, then "🥉 3rd / 🥈 2nd / 🥇 1st". Then "Reveal 3rd", "Reveal 2nd",
  "Reveal 1st", then Finish.
- **Guest (inside the new game flow, Plan B)**: read-only cards, so phones can
  read along. Podium names appear as they're revealed.
- **`/display/final`**: a basic numbered card grid, then a podium. Polish
  happens in the Quiz Master View plan.

### Night-of sequence

1. Harry starts the Final Round. Advice locks, and the TV shows the numbered,
   anonymous cards.
2. Harry (or Liv) reads them aloud.
3. Liv calls her 3rd, 2nd and 1st favourites. Harry taps each one in.
4. Harry reveals 3rd, then 2nd, then 1st. Each shows the author, team and points.
5. Finish. The overall leaderboard now includes the final.

## Tests

Add `tests/final.integration.cjs` (disposable Postgres, same as the others):
Liv is blocked, saving locks at start, public state never contains an author
before reveal, awards need distinct entries, reveal order, overall scores
include only revealed places, and repeat actions are safe.

## Cut list (if we run out of time tonight)

1. Drop the one-at-a-time reveal and reveal all three at once.
2. Drop the guest read-along view. The TV is enough.
3. Never cut: A1 (collection), anonymity, scoring into overall.

## Out of scope

Exporting/printing the advice for Liv afterwards (worth doing next week),
voting by guests, and editing advice after the round starts.
