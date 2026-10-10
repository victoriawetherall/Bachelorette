import { MEDALS, ordinal, pointsFor, type FinalEntry, type FinalState } from "@/lib/finalRound";

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

  if (large) return <FinalTv state={state} current={current} bySpot={bySpot} spots={spots} revealed={revealed} swapsLeft={swapsLeft}
    flash={(rank) => rank === lastPlaced || swapped.includes(rank)} />;

  const spotlight = current
    ? <section className="space-y-3 rounded-3xl border-2 border-violet-300 bg-violet-50 p-6 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-violet-600">Advice {current.no} of {state.entry_count}</p>
      <p className="text-2xl break-words font-bold text-violet-900">&ldquo;{current.body}&rdquo;</p>
      <p className="text-sm text-violet-800">Where does Liv rank it?</p>
    </section>
    : state.phase === "ranking"
      ? <section className="space-y-2 rounded-3xl border-2 border-violet-300 bg-violet-50 p-6 text-center">
        <p className="text-4xl" aria-hidden="true">🔄</p>
        <h2 className="text-xl font-bold text-violet-900">Swap time!</h2>
        <p className="text-violet-800">Liv has <span className="font-bold">{swapsLeft} of {state.max_swaps}</span> swaps left.</p>
      </section>
      : <section className="space-y-2 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="text-xl font-bold text-amber-900">{revealed.length ? "The top five" : "Ranking locked 🔒"}</h2>
        {!revealed.length && <p className="text-amber-900">Who wrote Liv&rsquo;s top {state.places}? Revealing from {ordinal(state.places)} up&hellip;</p>}
        <ol className="space-y-2">{revealed.map((entry) => <li key={entry.no} className="flex items-center justify-between gap-3 text-base">
          <span><span aria-hidden="true">{MEDALS[entry.rank!]}</span> <span className="text-amber-800">#{entry.rank}</span> <span className="font-bold">{entry.author}</span> <span className="text-gray-600">· {entry.team}</span></span>
          <span className="font-bold text-amber-900">+{entry.points}</span>
        </li>)}</ol>
      </section>;

  const ladder = <ol className="space-y-1.5">{spots.map((rank) => {
    const entry = bySpot.get(rank);
    const scoring = rank <= state.places;
    const tappable = !!onSlot && (mode === "place" ? !entry : mode === "swap" ? !!entry : false);
    const highlight = selected === rank ? "ring-4 ring-rose-500" : rank === lastPlaced || swapped.includes(rank) ? "ring-4 ring-violet-400" : "";
    const classes = `flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left text-sm ${
      scoring ? "border-amber-300 bg-amber-50" : "border-rose-100 bg-white"} ${highlight} ${tappable ? "hover:border-rose-400" : ""}`;
    const content = <>
      <span className={`shrink-0 font-bold ${scoring ? "text-amber-800" : "text-rose-700"}`}>#{rank}</span>
      <span className="min-w-0 flex-1">
        {entry ? <span className="block break-words text-gray-800">{entry.body}</span>
          : <span className="block text-gray-400">{tappable ? "Tap to put it here" : "—"}</span>}
        {entry?.author && <span className="mt-1 block text-sm font-semibold text-amber-900">{MEDALS[rank]} by {entry.author} · {entry.team}</span>}
      </span>
      {scoring && <span className="shrink-0 rounded-full bg-amber-200 px-2 text-xs font-bold text-amber-900">+{pointsFor(rank)}</span>}
    </>;
    return <li key={rank}>{tappable
      ? <button type="button" aria-pressed={selected === rank} onClick={() => onSlot(rank)} className={classes}>{content}</button>
      : <div className={classes}>{content}</div>}</li>;
  })}</ol>;

  return <div className="space-y-4">{spotlight}{ladder}</div>;
}

// The TV: what's happening now on the left, Liv's ladder on the right with the
// scoring spots set apart. Ladder rows have fixed heights and clamp their text,
// so the board stays tidy however long the advice is; the full card is always
// in the spotlight.
function FinalTv({ state, current, bySpot, spots, revealed, swapsLeft, flash }: {
  state: FinalState; current?: FinalEntry; bySpot: Map<number, FinalEntry>; spots: number[];
  revealed: FinalEntry[]; swapsLeft: number; flash: (rank: number) => boolean;
}) {
  const top = spots.filter((rank) => rank <= state.places);
  const rest = spots.filter((rank) => rank > state.places);
  const half = Math.ceil(rest.length / 2);
  const latest = revealed[0];
  const quoteSize = (body: string) => body.length > 180 ? "text-4xl" : body.length > 100 ? "text-5xl" : "text-6xl";
  const lit = "ring-4 ring-violet-500 bg-violet-50";

  const spotlight = current
    ? <section className="flex h-full flex-col justify-between gap-8 rounded-[2rem] bg-violet-600 p-10 text-white shadow-xl">
      <p className="text-xl font-bold uppercase tracking-widest text-violet-200">Advice {current.no} of {state.entry_count}</p>
      <p className={`${quoteSize(current.body)} break-words font-bold leading-tight`}>&ldquo;{current.body}&rdquo;</p>
      <div className="space-y-3">
        <p className="text-3xl font-semibold">Where does Liv rank it? 🤔</p>
        <div className="flex gap-1.5" aria-label={`${bySpot.size} of ${state.entry_count} placed`}>{spots.map((n) =>
          <span key={n} className={`h-2.5 flex-1 rounded-full ${n <= bySpot.size ? "bg-white" : "bg-violet-400/60"}`} />)}</div>
      </div>
    </section>
    : state.phase === "ranking"
      ? <section className="flex h-full flex-col items-center justify-center gap-6 rounded-[2rem] bg-violet-600 p-10 text-center text-white shadow-xl">
        <h2 className="text-6xl font-bold">Swap time! 🔄</h2>
        <p className="text-2xl text-violet-100">Every card is on the board. Liv can trade any two spots.</p>
        <div className="flex gap-4">{Array.from({ length: state.max_swaps }, (_, i) => <span key={i}
          className={`flex h-24 w-24 items-center justify-center rounded-full text-5xl ${i < swapsLeft ? "bg-white shadow-lg" : "bg-violet-500 opacity-50 grayscale"}`}>🔄</span>)}</div>
        <p className="text-3xl font-bold">{swapsLeft ? `${swapsLeft} of ${state.max_swaps} swaps left` : "No swaps left!"}</p>
        {state.last_swap && <p className="rounded-full bg-violet-500 px-6 py-2 text-2xl font-semibold">Last swap: #{state.last_swap[0]} ⇄ #{state.last_swap[1]}</p>}
      </section>
      : <section className="flex h-full flex-col items-center justify-center gap-5 rounded-[2rem] bg-amber-400 p-10 text-center text-amber-950 shadow-xl">
        {latest ? <>
          <p className="text-8xl" aria-hidden="true">{MEDALS[latest.rank!]}</p>
          <p className="text-2xl font-bold uppercase tracking-widest">Liv&rsquo;s {ordinal(latest.rank!)} favourite</p>
          <p className={`${latest.body.length > 120 ? "text-2xl" : "text-3xl"} break-words font-semibold leading-snug`}>&ldquo;{latest.body}&rdquo;</p>
          <p className="text-6xl font-bold">{latest.author}</p>
          <p className="rounded-full bg-white px-6 py-2 text-3xl font-bold">+{latest.points} for {latest.team}</p>
        </> : <>
          <p className="text-8xl" aria-hidden="true">🔒</p>
          <h2 className="text-6xl font-bold">Ranking locked</h2>
          <p className="text-3xl font-semibold">Who wrote Liv&rsquo;s top {state.places}? Revealing from {ordinal(state.places)} up&hellip;</p>
        </>}
      </section>;

  const topRow = (rank: number) => {
    const entry = bySpot.get(rank);
    return <li key={rank} className={`flex h-24 items-center gap-4 rounded-2xl px-5 ${flash(rank) ? lit : entry ? "bg-white shadow-sm" : "border-2 border-dashed border-amber-300"}`}>
      <span className="w-14 shrink-0 text-center"><span className="block text-4xl leading-none" aria-hidden="true">{MEDALS[rank]}</span><span className="text-lg font-bold text-amber-800">#{rank}</span></span>
      <span className="min-w-0 flex-1">
        {entry ? <span className={`break-words text-xl text-gray-800 ${entry.author ? "line-clamp-1" : "line-clamp-2"}`}>{entry.body}</span>
          : <span className="block text-xl text-amber-700/60">Still up for grabs</span>}
        {entry?.author && <span className="block truncate text-xl font-bold text-amber-900">{entry.author} · {entry.team}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-2xl font-bold text-amber-950">+{pointsFor(rank)}</span>
    </li>;
  };
  const restRow = (rank: number) => {
    const entry = bySpot.get(rank);
    return <li key={rank} className={`flex h-14 items-center gap-3 rounded-xl px-4 text-lg ${flash(rank) ? lit : entry ? "bg-white/80" : "border-2 border-dashed border-rose-200"}`}>
      <span className="w-10 shrink-0 font-bold text-rose-400">#{rank}</span>
      <span className={`min-w-0 flex-1 truncate ${entry ? "text-gray-700" : "text-rose-300"}`}>{entry ? entry.body : "—"}</span>
    </li>;
  };

  return <div className="grid grid-cols-5 gap-6">
    <div className="col-span-2">{spotlight}</div>
    <div className="col-span-3 space-y-4">
      <section className="rounded-[2rem] bg-amber-100 p-4">
        <h2 className="mb-3 px-2 text-lg font-bold uppercase tracking-widest text-amber-800">Top {state.places} · these score</h2>
        <ol className="space-y-2">{top.map(topRow)}</ol>
      </section>
      {rest.length > 0 && <div className="grid grid-cols-2 gap-3 px-1">
        <ol className="space-y-2">{rest.slice(0, half).map(restRow)}</ol>
        <ol className="space-y-2">{rest.slice(half).map(restRow)}</ol>
      </div>}
    </div>
  </div>;
}
