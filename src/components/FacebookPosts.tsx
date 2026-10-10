"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import type { LiveState } from "@/lib/liveQuiz";

function ExpandedPost({ option, correct, onClose }: {
  option: LiveState["options"][number]; correct: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const viewer = dialog.current!;
    // A modal dialog stays above FitToScreen's transform and browser fullscreen.
    viewer.showModal();
    return () => viewer.close();
  }, []);

  return <dialog ref={dialog} aria-labelledby={titleId} style={{ margin: 0 }} onClose={() => {
    // Ignore a queued close event if an effect has already reopened the dialog.
    if (!dialog.current?.open) onClose();
  }}
    className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-neutral-950 p-0 text-white backdrop:bg-neutral-950">
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
        <h2 id={titleId} className="text-2xl font-bold md:text-3xl">Post {option.key}{correct && <span className="text-emerald-300"> · This was the fake!</span>}</h2>
        <button type="button" onClick={() => dialog.current?.close()}
          className="rounded-xl bg-white px-5 py-3 text-lg font-bold text-neutral-900 hover:bg-rose-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-rose-400">
          Back to all posts <span className="ml-2 text-sm font-normal text-neutral-600">Esc</span>
        </button>
      </header>
      <div className="relative m-2 min-h-0 flex-1 md:mx-6 md:mb-6">
        <Image src={option.image!} alt={`Facebook post ${option.key}`} fill sizes="100vw" unoptimized className="object-contain" />
      </div>
    </div>
  </dialog>;
}

export default function FacebookPosts({ state, large, selected, onSelect, disabled }: {
  state: LiveState; large: boolean; selected?: string | null; onSelect?: (key: string) => void; disabled: boolean;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const canExpand = large && !onSelect;
  const expanded = canExpand ? state.options.find((option) => option.key === expandedKey) : null;
  const revealed = state.phase === "reveal";

  return <>
    <div className={`grid gap-4 ${large ? "md:grid-cols-2" : ""}`}>
      {state.options.map((option) => {
        const correct = revealed && state.correct_answer === option.key;
        const expand = canExpand && !!option.image;
        return <button key={option.key} type="button" disabled={!expand && (disabled || !onSelect)}
          aria-pressed={expand ? undefined : selected === option.key} aria-haspopup={expand ? "dialog" : undefined}
          aria-label={expand ? `View Facebook post ${option.key} full size${correct ? " · This was the fake!" : ""}` : undefined}
          onClick={() => expand ? setExpandedKey(option.key) : onSelect?.(option.key)}
          className={`overflow-hidden rounded-xl border-2 text-left disabled:cursor-default focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-rose-600 ${expand ? "cursor-zoom-in" : ""} ${correct ? "border-emerald-500" : selected === option.key ? "border-rose-600" : "border-rose-100"}`}>
          <span className={`block px-3 py-2 font-bold ${correct ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-800"}`}>{option.key}{correct && " · This was the fake!"}{selected === option.key && !revealed && " · Your team’s pick"}</span>
          {/* Vercel's optimizer rejects the neutral .asset URLs; serve the normalized originals, as in the zoom view. */}
          <Image src={option.image!} alt={`Facebook post ${option.key}`} width={680} height={240} unoptimized className={large ? "block h-auto max-h-72 w-full bg-neutral-800 object-contain" : "block h-auto w-full"} />
        </button>;
      })}
    </div>
    {canExpand && <p className="text-center text-sm font-semibold text-rose-700">Click a post to view it full size.</p>}
    {expanded?.image && <ExpandedPost option={expanded} correct={revealed && state.correct_answer === expanded.key} onClose={() => setExpandedKey(null)} />}
  </>;
}
