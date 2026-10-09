import { MEDALS, ordinal, pointsFor, type FinalState } from "@/lib/finalRound";

// Shared by phones, the TV and the host. Only cards that have come out are in
// state, and authors only once revealed. The host passes `mode` and `onSlot`
// to make the ladder tappable: free spots when placing, filled ones to swap.
export default function FinalRoundView({ state, large = false, mode, selected, onSlot }: {
  state: FinalState; large?: boolean; mode?: "place" | "swap"; selected?: number | null; onSlot?: (rank: number) => void;
}) {
  if (state.phase === "lobby") return <section className="space-y-3 rounded-3xl border border-rose-200 bg-white p-6 text-center">
    <p className="text-4xl" aria-hidden="true">💍</p>
    <h2 className={`${large ? "text-4xl" : "text-2xl"} font-bold text-rose-800`}>Marriage advice for Liv</h2>
    <p className={large ? "text-xl text-gray-600" : "text-gray-600"}>{state.entry_count} pieces of advice are in. Liv will rank them one at a time without knowing who wrote them, or what&rsquo;s still to come.</p>
  </section>;
  const current = state.entries.find((entry) => entry.no === state.current);
  const bySpot = new Map(state.entries.filter((entry) => entry.rank !== null).map((entry) => [entry.rank!, entry]));
  const spots = Array.from({ length: state.entry_count }, (_, i) => i + 1);
  const lastPlaced = current ? state.entries.find((entry) => entry.no === state.last_placed)?.rank : undefined;
  const swapped: number[] = state.phase === "ranking" && !current ? state.last_swap ?? [] : [];
  const revealed = state.entries.filter((entry) => entry.author).sort((a, b) => a.rank! - b.rank!);
  const swapsLeft = state.max_swaps - state.swaps_used;
  const heading = large ? "text-3xl" : "text-xl";

  const spotlight = current
    ? <section className="space-y-3 rounded-3xl border-2 border-violet-300 bg-violet-50 p-6 text-center">
      <p className={`${large ? "text-xl" : "text-sm"} font-bold uppercase tracking-widest text-violet-600`}>Advice {current.no} of {state.entry_count}</p>
      <p className={`${large ? "text-4xl" : "text-2xl"} break-words font-bold text-violet-900`}>&ldquo;{current.body}&rdquo;</p>
      <p className={large ? "text-xl text-violet-800" : "text-sm text-violet-800"}>Where does Liv rank it?</p>
    </section>
    : state.phase === "ranking"
      ? <section className="space-y-2 rounded-3xl border-2 border-violet-300 bg-violet-50 p-6 text-center">
        <p className="text-4xl" aria-hidden="true">🔄</p>
        <h2 className={`${heading} font-bold text-violet-900`}>Swap time!</h2>
        <p className={large ? "text-2xl text-violet-800" : "text-violet-800"}>Liv has <span className="font-bold">{swapsLeft} of {state.max_swaps}</span> swaps left.</p>
      </section>
      : <section className="space-y-2 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className={`${heading} font-bold text-amber-900`}>{revealed.length ? "The top five" : "Ranking locked 🔒"}</h2>
        {!revealed.length && <p className={large ? "text-xl text-amber-900" : "text-amber-900"}>Who wrote Liv&rsquo;s top {state.places}? Revealing from {ordinal(state.places)} up&hellip;</p>}
        <ol className="space-y-2">{revealed.map((entry) => <li key={entry.no} className={`flex items-center justify-between gap-3 ${large ? "text-2xl" : "text-base"}`}>
          <span><span aria-hidden="true">{MEDALS[entry.rank!]}</span> <span className="text-amber-800">#{entry.rank}</span> <span className="font-bold">{entry.author}</span> <span className="text-gray-600">· {entry.team}</span></span>
          <span className="font-bold text-amber-900">+{entry.points}</span>
        </li>)}</ol>
      </section>;

  // On the TV the ladder reads down two columns so the current card can stay big.
  const ladder = <ol className={large ? "grid grid-flow-col grid-cols-2 gap-x-4 gap-y-2" : "space-y-1.5"}
    style={large ? { gridTemplateRows: `repeat(${Math.ceil(spots.length / 2)}, auto)` } : undefined}>{spots.map((rank) => {
    const entry = bySpot.get(rank);
    const scoring = rank <= state.places;
    const tappable = !!onSlot && (mode === "place" ? !entry : mode === "swap" ? !!entry : false);
    const highlight = selected === rank ? "ring-4 ring-rose-500" : rank === lastPlaced || swapped.includes(rank) ? "ring-4 ring-violet-400" : "";
    const classes = `flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${large ? "text-xl" : "text-sm"} ${
      scoring ? "border-amber-300 bg-amber-50" : "border-rose-100 bg-white"} ${highlight} ${tappable ? "hover:border-rose-400" : ""}`;
    const content = <>
      <span className={`shrink-0 font-bold ${scoring ? "text-amber-800" : "text-rose-700"}`}>#{rank}</span>
      <span className="min-w-0 flex-1">
        {entry ? <span className={`block break-words text-gray-800 ${large ? "line-clamp-2" : ""}`}>{entry.body}</span>
          : <span className="block text-gray-400">{tappable ? "Tap to put it here" : "—"}</span>}
        {entry?.author && <span className={`mt-1 block font-semibold text-amber-900 ${large ? "text-lg" : "text-sm"}`}>{MEDALS[rank]} by {entry.author} · {entry.team}</span>}
      </span>
      {scoring && <span className={`shrink-0 rounded-full bg-amber-200 px-2 font-bold text-amber-900 ${large ? "text-base" : "text-xs"}`}>+{pointsFor(rank)}</span>}
    </>;
    return <li key={rank}>{tappable
      ? <button type="button" aria-pressed={selected === rank} onClick={() => onSlot(rank)} className={classes}>{content}</button>
      : <div className={classes}>{content}</div>}</li>;
  })}</ol>;

  return <div className={large ? "space-y-5" : "space-y-4"}>{spotlight}{ladder}</div>;
}
