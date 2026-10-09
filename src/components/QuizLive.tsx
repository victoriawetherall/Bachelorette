import { formatPoints } from "@/lib/feud";
import Image from "next/image";
import { type LiveState } from "@/lib/liveQuiz";

export function LiveScores({ state, large = false }: { state: LiveState; large?: boolean }) {
  return <section aria-label="Round scores" className="space-y-3">
    <h2 className={`${large ? "text-3xl" : "text-xl"} font-bold text-rose-800`}>{state.phase === "finished" ? "Round complete! 🏆" : "Round scores"}</h2>
    <ol className={`grid gap-3 sm:grid-cols-2 ${large ? "lg:grid-cols-4" : ""}`}>
      {[...state.teams].sort((a, b) => b.points - a.points || a.team_number - b.team_number).map((team) => <li key={team.id} className={`rounded-2xl border-2 p-4 ${team.correct ? "border-emerald-500 bg-emerald-50" : "border-rose-200 bg-white"}`}>
        <p className="font-semibold text-rose-800">{team.name}</p><p className="text-3xl font-bold text-rose-700">{formatPoints(team.points)} <span className="text-sm">pts</span></p>
        {["question", "locked"].includes(state.phase) && <p className="mt-2 text-sm text-gray-600">{team.submitted ? "Answer saved 🔒" : "Thinking…"}</p>}
        {state.phase === "reveal" && <p className="mt-2 text-sm text-gray-700 break-words">{team.answer ?? "No answer"}{team.correct ? ` · +${state.points_per_correct}` : team.submitted && team.correct === null ? " · Waiting for Harry’s ruling" : ""}</p>}
      </li>)}
    </ol>
    <p className="text-sm text-gray-600">{state.revealed_count} of {state.total_questions} revealed · {state.points_per_correct} {state.points_per_correct === 1 ? "point" : "points"} per correct team</p>
  </section>;
}

export default function QuizLive({ state, large = false, selected, onSelect, disabled = true }: {
  state: LiveState; large?: boolean; selected?: string | null; onSelect?: (key: string) => void; disabled?: boolean;
}) {
  if (["leaderboard", "finished"].includes(state.phase)) return <LiveScores state={state} large={large} />;
  if (state.phase === "lobby") return <section className="space-y-3 rounded-3xl border border-rose-200 bg-white p-6 text-center">
    <p className="text-4xl" aria-hidden="true">{state.slug === "fake" ? "🕵️" : "📖"}</p>
    <h2 className={`${large ? "text-4xl" : "text-2xl"} font-bold text-rose-800`}>{state.title}</h2>
    <p className="text-gray-600">{state.slug === "fake" ? "Three real Facebook posts. One fake. Can your team spot it?" : "The stories, the memories, the questionable decisions… How well do you know Liv?"}</p>
    <p className="text-sm text-rose-700">{state.total_questions ? `${state.total_questions} questions · Waiting for Harry to start` : "Harry is preparing the questions."}</p>
  </section>;
  const revealed = state.phase === "reveal";
  return <div className="space-y-5">
    <section className="space-y-4 rounded-3xl border border-rose-200 bg-white p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Question {state.question_number} of {state.total_questions}</p>
      <h2 className={`${large ? "text-3xl md:text-4xl" : "text-xl"} font-bold text-rose-900`}>{state.prompt}</h2>
      {state.slug === "fake" && <div className={`grid gap-4 ${large ? "md:grid-cols-2" : ""}`}>
        {state.options.map((option) => {
          const correct = revealed && state.correct_answer === option.key;
          return <button key={option.key} type="button" disabled={disabled || !onSelect} aria-pressed={selected === option.key} onClick={() => onSelect?.(option.key)} className={`overflow-hidden rounded-xl border-2 text-left disabled:cursor-default ${correct ? "border-emerald-500" : selected === option.key ? "border-rose-600" : "border-rose-100"}`}>
            <span className={`block px-3 py-2 font-bold ${correct ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-800"}`}>{option.key}{correct && " · This was the fake!"}{selected === option.key && !revealed && " · Your team’s pick"}</span>
            <Image src={option.image} alt={`Facebook post ${option.key}`} width={680} height={240} sizes="(max-width: 700px) 90vw, 600px" quality={80} className="block h-auto w-full" />
          </button>;
        })}
      </div>}
      {revealed && state.slug === "stories" && <div className="rounded-2xl bg-violet-50 p-4"><p className="text-sm font-semibold text-violet-700">The answer</p><p className="mt-1 whitespace-pre-wrap text-xl font-bold text-violet-900">{state.correct_answer}</p></div>}
    </section>
    <p role="status" className="rounded-xl bg-rose-100 p-3 text-center font-semibold text-rose-800">{state.phase === "question" ? "Talk it through. Captains, submit your team’s answer!" : state.phase === "locked" ? "Answers are locked. Waiting for Harry’s reveal…" : "The answer is out!"}</p>
    <LiveScores state={state} large={large} />
  </div>;
}
