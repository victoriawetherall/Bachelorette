import { FEUD_QUESTIONS, type FeudState } from "@/lib/feud";
import FeudQuestionCard from "./FeudQuestionCard";
import FeudScoreboard from "./FeudScoreboard";

export default function LiveFeud({ state, large = false }: { state: FeudState; large?: boolean }) {
  const question = FEUD_QUESTIONS.find((item) => item.id === state.current_question_id);
  if (state.phase === "leaderboard" || state.phase === "finished") return <FeudScoreboard state={state} large={large} />;
  if (state.phase === "lobby") return (
    <section className="space-y-5 rounded-3xl border border-rose-200 bg-white p-6 text-center">
      <p className="text-4xl" aria-hidden="true">🪩</p>
      <h2 className="text-2xl font-bold text-rose-800">Who&rsquo;s ready?</h2>
      <p className="text-gray-600">{state.voting_open ? "Get your pre-votes in. Liv will choose her answers live!" : "Pre-votes are locked in. The quiz is about to begin!"}</p>
      <div className="grid grid-cols-2 gap-3">
        {state.teams.map((team) => <div key={team.id} className="rounded-xl bg-rose-50 p-3 text-sm"><p className="font-bold text-rose-800">{team.name}</p><p className="mt-1 text-gray-600">{team.completed_voters}/{team.eligible_voters} finished</p></div>)}
      </div>
    </section>
  );
  if (!question) return <p role="alert">This question couldn&rsquo;t be loaded.</p>;
  return (
    <div className={large ? "space-y-4" : "space-y-6"}>
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">Question {question.id} of {state.total_questions}</p>
      <FeudQuestionCard key={question.id} question={question} large={large} stagger={large && state.phase === "question"} celebrate={state.phase === "reveal"} correct={state.chosen_option} distribution={state.distribution} />
      <p role="status" className="rounded-2xl bg-rose-100 p-3 text-center font-semibold text-rose-800">
        {state.phase === "question" ? "Liv is choosing her answer…" : state.phase === "locked" ? "Liv’s choice is locked in. Ready for the reveal?" : "Who picked the same answer as Liv?"}
      </p>
      {state.phase === "reveal" && <FeudScoreboard state={state} showMatches large={large} />}
    </div>
  );
}
