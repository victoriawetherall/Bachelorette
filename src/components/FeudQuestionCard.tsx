import type { AnswerKey, FeudQuestion } from "@/lib/feud";

export default function FeudQuestionCard({ question, selected, correct, onSelect, disabled, distribution, large = false }: {
  question: FeudQuestion; selected?: AnswerKey | null; correct?: AnswerKey | null;
  onSelect?: (key: AnswerKey) => void; disabled?: boolean;
  distribution?: Partial<Record<AnswerKey, number>> | null; large?: boolean;
}) {
  return (
    <section className="space-y-5" aria-labelledby={`question-${question.id}`}>
      <h2 id={`question-${question.id}`} className={`${large ? "text-2xl md:text-4xl" : "text-xl"} font-bold leading-snug text-rose-900`}>
        {question.prompt}
      </h2>
      <div className={`grid gap-3 ${large ? "md:grid-cols-2" : ""}`}>
        {question.options.map((option) => {
          const isCorrect = correct === option.key;
          const isSelected = selected === option.key;
          const classes = `flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left ${large ? "text-lg md:text-2xl" : "text-sm"} ${
            isCorrect ? "border-emerald-600 bg-emerald-50 text-emerald-900" : isSelected ? "border-rose-500 bg-rose-100 text-rose-900" : "border-rose-100 bg-white text-gray-800"
          }`;
          const content = <>
            <span className="font-bold">{option.key}</span>
            <span className="min-w-0 flex-1 break-words">
              {option.text}
              {isCorrect && <span className="mt-2 block text-sm font-bold">✓ Liv&rsquo;s pick</span>}
              {distribution && <span className="mt-2 block text-sm">{distribution[option.key] ?? 0} pre-votes</span>}
            </span>
            {isSelected && !correct && <span className="font-bold" aria-label="Selected">✓</span>}
          </>;
          return onSelect ? (
            <button key={option.key} type="button" aria-pressed={isSelected} disabled={disabled} onClick={() => onSelect(option.key)}
              className={`${classes} transition hover:border-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-default disabled:hover:border-inherit`}>
              {content}
            </button>
          ) : <div key={option.key} className={classes}>{content}</div>;
        })}
      </div>
    </section>
  );
}
