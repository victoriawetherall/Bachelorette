import { predictionLabel, type BenState } from "@/lib/ben";

export function BenScoreboard({ state, large = false }: { state: BenState; large?: boolean }) {
  const teams = [...state.teams].sort((a, b) => b.points - a.points || a.team_number - b.team_number);
  const judged = state.phase === "judged" && state.liv_right !== null;
  const showPicks = !["lobby", "question", "leaderboard", "finished"].includes(state.phase);
  return (
    <section className="space-y-3" aria-label="Team scores">
      <h2 className={`${large ? "text-2xl" : "text-lg"} font-bold text-rose-800`}>{state.phase === "finished" ? "Final scores 🏆" : "Team scores"}</h2>
      <ol className={`grid gap-3 sm:grid-cols-2 ${large ? "lg:grid-cols-4" : ""}`}>
        {teams.map((team) => {
          const scored = judged && team.prediction === state.liv_right;
          return (
            <li key={team.id} className={`rounded-2xl border-2 bg-white ${large ? "p-5" : "p-4"} ${scored ? "border-emerald-500 bg-emerald-50" : "border-rose-200"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`${large ? "text-xl" : ""} font-semibold text-rose-800`}>{team.name}</span>
                <span className={`${large ? "text-4xl" : "text-2xl"} font-bold tabular-nums text-rose-700`}>{team.points} <span className="text-xs font-medium">pts</span></span>
              </div>
              {state.phase === "question" && <p className="mt-2 text-sm text-gray-600">{team.submitted ? "Locked in 🔒" : "Thinking…"}</p>}
              {showPicks && <p className={`mt-2 ${large ? "text-lg" : "text-sm"} text-gray-700`}>{predictionLabel(team.prediction)}{scored && <span className="font-bold text-emerald-700"> · +1</span>}</p>}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-gray-600">{state.judged_count} of {state.total_questions} questions judged · 1 point per correct call</p>
    </section>
  );
}

export function BenQuestionCard({ state, large = false }: { state: BenState; large?: boolean }) {
  return (
    <section className={`space-y-4 rounded-3xl border border-rose-200 bg-white ${large ? "p-8" : "p-5"}`}>
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Question {state.question_number} of {state.total_questions} · We asked Ben…</p>
      <h2 className={`${large ? "text-3xl md:text-5xl" : "text-xl"} font-bold leading-snug text-rose-900`}>{state.prompt}</h2>
      {state.ben_answer && <div className={`rounded-2xl bg-violet-50 ${large ? "p-6" : "p-4"}`}>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">Ben said 🤵</p>
        <p className={`${large ? "text-2xl md:text-4xl" : "text-lg"} mt-1 font-semibold text-violet-900`}>&ldquo;{state.ben_answer}&rdquo;</p>
      </div>}
      {state.liv_right !== null && <p className={`rounded-2xl p-4 text-center font-bold ${large ? "text-3xl md:text-5xl" : "text-xl"} ${state.liv_right ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
        {state.liv_right ? "Liv nailed it! ✅" : "Liv missed it! ❌"}
      </p>}
    </section>
  );
}

const STATUS: Record<BenState["phase"], string> = {
  lobby: "",
  question: "Teams: will Liv match Ben’s answer? Lock in your call!",
  locked: "Calls are locked. Over to you, Liv…",
  reveal: "Here’s what Ben actually said…",
  judged: "Teams that called it get a point!",
  leaderboard: "",
  finished: "",
};

export default function BenLive({ state, large = false }: { state: BenState; large?: boolean }) {
  if (state.phase === "leaderboard" || state.phase === "finished") return <BenScoreboard state={state} large={large} />;
  if (state.phase === "lobby") return (
    <section className="space-y-3 rounded-3xl border border-rose-200 bg-white p-6 text-center">
      <p className="text-4xl" aria-hidden="true">🤵💍</p>
      <h2 className={`${large ? "text-4xl" : "text-2xl"} font-bold text-rose-800`}>How well does Liv know Ben?</h2>
      <p className={`${large ? "text-xl" : ""} text-gray-600`}>We asked Ben {state.total_questions} questions. Liv answers each one live. Your team calls it: will she get it right or wrong?</p>
    </section>
  );
  return (
    <div className="space-y-5">
      <BenQuestionCard state={state} large={large} />
      <p role="status" className={`rounded-2xl bg-rose-100 p-3 text-center font-semibold text-rose-800 ${large ? "text-xl" : ""}`}>{STATUS[state.phase]}</p>
      <BenScoreboard state={state} large={large} />
    </div>
  );
}
