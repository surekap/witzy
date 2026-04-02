"use client";

import Image from "next/image";
import { startTransition, useState } from "react";

import { primaryButtonClass, secondaryButtonClass, Surface } from "@/components/ui";
import type { AnswerKey, Category, Question } from "@/types/game";

interface SoloQuestionPayload {
  category: Category;
  question: Question;
}

export function SoloPractice({ categories }: { categories: Category[] }) {
  const [ageBand, setAgeBand] = useState<"6_to_8" | "9_to_11" | "12_to_14" | "15_plus">("9_to_11");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([]);
  const [current, setCurrent] = useState<SoloQuestionPayload | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerKey | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestion = async () => {
    setError(null);
    const response = await fetch("/api/solo/next", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        categoryId,
        ageBand,
        askedQuestionIds,
        difficultyMode: "adaptive",
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Couldn't load the next solo question.");
      return;
    }

    setCurrent(payload);
    setSelectedAnswer(null);
    setSubmitted(false);
    setAskedQuestionIds((currentIds) => [...currentIds, payload.question.id]);
  };

  const submitAnswer = () => {
    if (!current || !selectedAnswer) {
      return;
    }

    setSubmitted(true);
    if (selectedAnswer === current.question.correctAnswer) {
      setCorrectCount((count) => count + 1);
    }
  };

  const isComplete = askedQuestionIds.length >= 10 && submitted;

  return (
    <div className="space-y-6">
      <Surface className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Solo Practice</p>
            <h2 className="text-3xl font-black text-white">Test the question engine in single-player mode</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            Score: {correctCount} / {Math.min(askedQuestionIds.length, 10)}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-white">Category</span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-white">Age band</span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
              value={ageBand}
              onChange={(event) =>
                setAgeBand(event.target.value as "6_to_8" | "9_to_11" | "12_to_14" | "15_plus")
              }
            >
              <option value="6_to_8">6 to 8</option>
              <option value="9_to_11">9 to 11</option>
              <option value="12_to_14">12 to 14</option>
              <option value="15_plus">15 plus</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              className={primaryButtonClass}
              disabled={askedQuestionIds.length >= 10 && submitted}
              onClick={() => startTransition(() => void fetchQuestion())}
              type="button"
            >
              {current ? (askedQuestionIds.length >= 10 && submitted ? "Practice complete" : "Load another") : "Start practice"}
            </button>
          </div>
        </div>

        {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      </Surface>

      {current ? (
        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">{current.category.name}</p>
              <h3 className="text-2xl font-black text-white">{current.question.title}</h3>
            </div>
            <p className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              {current.question.difficulty}
            </p>
          </div>

          {current.question.mediaUrl && current.question.modality === "image" ? (
            <Image
              alt={current.question.mediaAltText ?? ""}
              className="w-full rounded-[24px] border border-white/10 bg-white/5"
              height={480}
              src={current.question.mediaUrl}
              unoptimized
              width={800}
            />
          ) : null}

          {current.question.mediaUrl && current.question.modality === "audio" ? (
            <audio className="w-full" controls src={current.question.mediaUrl}>
              Your browser does not support audio playback.
            </audio>
          ) : null}

          <p className="text-lg text-slate-100">{current.question.prompt}</p>

          <div className="grid gap-3 md:grid-cols-2">
            {(Object.entries(current.question.options) as Array<[AnswerKey, string]>).map(([key, value]) => (
              <button
                key={key}
                className={`rounded-[24px] border px-4 py-4 text-left text-base font-semibold transition ${
                  selectedAnswer === key
                    ? "border-orange-300/40 bg-orange-300/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-300/10"
                }`}
                onClick={() => setSelectedAnswer(key)}
                type="button"
              >
                <span className="mr-2 text-sm uppercase tracking-[0.2em] text-white/50">{key}</span>
                {value}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className={primaryButtonClass}
              disabled={!selectedAnswer || submitted}
              onClick={submitAnswer}
              type="button"
            >
              Lock answer
            </button>
            {submitted && !isComplete ? (
              <button className={secondaryButtonClass} onClick={() => startTransition(() => void fetchQuestion())} type="button">
                Next question
              </button>
            ) : null}
          </div>

          {submitted ? (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">
                {selectedAnswer === current.question.correctAnswer ? "Correct!" : "Not quite this time."}
              </p>
              <p>
                Correct answer:{" "}
                <span className="font-semibold text-cyan-200">
                  {current.question.options[current.question.correctAnswer]}
                </span>
              </p>
              <p className="mt-2 text-slate-300">{current.question.explanation}</p>
            </div>
          ) : null}
        </Surface>
      ) : null}

      {isComplete ? (
        <Surface className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Practice Complete</p>
          <h3 className="text-3xl font-black text-white">Finished 10 questions</h3>
          <p className="text-lg text-slate-300">You scored {correctCount} out of 10.</p>
        </Surface>
      ) : null}
    </div>
  );
}
