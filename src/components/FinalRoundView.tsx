import { MEDALS, ORDINALS, type FinalState } from "@/lib/finalRound";

// Shared by phones, the TV and the host. Authors only exist in state once revealed.
export default function FinalRoundView({ state, large = false, selected, onSelect }: {
  state: FinalState; large?: boolean; selected?: number | null; onSelect?: (no: number) => void;
}) {
  if (state.phase === "lobby") return <section className="space-y-3 rounded-3xl border border-rose-200 bg-white p-6 text-center">
    <p className="text-4xl" aria-hidden="true">💍</p>
    <h2 className={`${large ? "text-4xl" : "text-2xl"} font-bold text-rose-800`}>Marriage advice for Liv</h2>
    <p className={large ? "text-xl text-gray-600" : "text-gray-600"}>{state.entry_count} pieces of advice are in. Liv will pick her favourites without knowing who wrote them.</p>
  </section>;
  const revealed = state.awards.filter((award) => award.revealed).sort((a, b) => a.place - b.place);
  return <div className={large ? "space-y-6" : "space-y-4"}>
    {revealed.length > 0 && <section className="space-y-2 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
      <h2 className={`${large ? "text-3xl" : "text-xl"} font-bold text-amber-900`}>The podium</h2>
      <ol className="space-y-2">{revealed.map((award) => <li key={award.place} className={`flex items-center justify-between gap-3 ${large ? "text-2xl" : "text-base"}`}>
        <span><span aria-hidden="true">{MEDALS[award.place]}</span> <span className="font-bold">{award.author}</span> <span className="text-gray-600">· {award.team}</span></span>
        <span className="font-bold text-amber-900">+{award.points}</span>
      </li>)}</ol>
    </section>}
    <div className={`grid gap-3 ${large ? "md:grid-cols-3" : ""}`}>
      {state.entries.map((entry) => {
        const award = state.awards.find((item) => item.no === entry.no);
        const isSelected = selected === entry.no;
        const classes = `w-full rounded-2xl border-2 p-4 text-left ${large ? "text-xl" : "text-sm"} ${
          award ? "border-amber-400 bg-amber-50" : isSelected ? "border-rose-500 bg-rose-100" : "border-rose-100 bg-white"}`;
        const content = <>
          <p className="flex items-center justify-between font-bold text-rose-700"><span>#{entry.no}</span>{award && <span>{MEDALS[award.place]} {ORDINALS[award.place]}</span>}</p>
          <p className="mt-2 break-words text-gray-800">{entry.body}</p>
          {award?.author && <p className="mt-2 text-sm font-semibold text-amber-900">by {award.author}</p>}
        </>;
        return onSelect
          ? <button key={entry.no} type="button" aria-pressed={isSelected} onClick={() => onSelect(entry.no)} className={`${classes} hover:border-rose-400`}>{content}</button>
          : <div key={entry.no} className={classes}>{content}</div>;
      })}
    </div>
  </div>;
}
