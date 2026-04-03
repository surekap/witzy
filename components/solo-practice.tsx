"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useState } from "react";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { AnswerKey, Category, Question } from "@/types/game";

interface SoloQuestionPayload {
  category: Category;
  question: Question;
}

export function SoloPractice({ categories }: { categories: Category[] }) {
  const [ageBand, setAgeBand] = useState<"6_to_8" | "9_to_11" | "12_to_14" | "15_plus">("9_to_11");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [current, setCurrent] = useState<SoloQuestionPayload | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerKey | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = askedIds.length > 0 || current !== null;

  const resetSession = () => {
    setAskedIds([]);
    setCurrent(null);
    setSelectedAnswer(null);
    setSubmitted(false);
    setCorrectCount(0);
    setError(null);
  };

  const fetchQuestion = async () => {
    setError(null);
    const response = await fetch("/api/solo/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        ageBand,
        askedQuestionIds: askedIds,
        difficultyMode: "adaptive",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Couldn't load the next question.");
      return;
    }
    setCurrent(payload);
    setSelectedAnswer(null);
    setSubmitted(false);
    setAskedIds((ids) => [...ids, payload.question.id]);
  };

  const submitAnswer = () => {
    if (!current || !selectedAnswer) return;
    setSubmitted(true);
    if (selectedAnswer === current.question.correctAnswer) {
      setCorrectCount((n) => n + 1);
    }
  };

  const questionNumber = Math.min(askedIds.length, 10);
  const isComplete = askedIds.length >= 10 && submitted;
  const isCorrect = submitted && selectedAnswer === current?.question.correctAnswer;

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <header className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
          <Image src="/media/logo.png" alt="Witzy" width={32} height={32} className="rounded-lg" unoptimized />
        </Link>
        <div>
          <p className="section-eyebrow">Practice mode</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            Practice on your own
          </h1>
        </div>
      </header>

      {/* ── Settings + score ── */}
      <div className="surface space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-eyebrow">Settings</p>
            <h2 className="section-title" style={{ fontSize: "1.1875rem" }}>
              10-question solo session
            </h2>
          </div>
          {askedIds.length > 0 ? (
            <div
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0.5rem 1.25rem",
                borderRadius: 9999,
                border: "2px solid var(--ink)",
                backgroundColor:
                  correctCount > askedIds.length / 2
                    ? "var(--forest-light)"
                    : "var(--card)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "1.5rem",
                  lineHeight: 1,
                  color: correctCount > askedIds.length / 2 ? "var(--forest)" : "var(--ink)",
                }}
              >
                {correctCount} / {questionNumber}
              </span>
              <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-muted)" }}>
                correct
              </span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="field-label" style={{ fontSize: "0.8125rem" }}>Category</span>
            <select
              className="form-input mt-1"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                resetSession();
              }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label" style={{ fontSize: "0.8125rem" }}>Age band</span>
            <select
              className="form-input mt-1"
              value={ageBand}
              onChange={(e) => {
                setAgeBand(e.target.value as "6_to_8" | "9_to_11" | "12_to_14" | "15_plus");
                resetSession();
              }}
            >
              <option value="6_to_8">6 – 8 years</option>
              <option value="9_to_11">9 – 11 years</option>
              <option value="12_to_14">12 – 14 years</option>
              <option value="15_plus">15 +</option>
            </select>
          </label>

          <div className="flex items-end">
            {hasStarted ? (
              <button
                className={secondaryButtonClass}
                onClick={resetSession}
                type="button"
                style={{ width: "100%" }}
              >
                Start over
              </button>
            ) : (
              <button
                className={primaryButtonClass}
                onClick={() => startTransition(() => void fetchQuestion())}
                type="button"
                style={{ width: "100%" }}
              >
                Start practice
              </button>
            )}
          </div>
        </div>

        {error ? <p className="alert-error">{error}</p> : null}
      </div>

      {/* ── Question panel ── */}
      {current ? (
        <div className="surface space-y-5">
          {/* Category + difficulty badge */}
          <div className="flex items-center justify-between gap-3">
            <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-muted)" }}>
              {current.category.icon} {current.category.name}
            </p>
            <span
              style={{
                padding: "0.3125rem 0.75rem",
                borderRadius: 9999,
                border: "1.5px solid var(--ink-faint)",
                backgroundColor: "var(--card)",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ink-muted)",
              }}
            >
              {current.question.difficulty}
            </span>
          </div>

          {/* Media */}
          {current.question.mediaUrl && current.question.modality === "image" ? (
            <Image
              alt={current.question.mediaAltText ?? ""}
              className="w-full rounded-2xl"
              style={{ border: "1.5px solid var(--ink-faint)" }}
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

          {/* Title + prompt */}
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-muted)" }}>
              {current.question.title}
            </p>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(1.25rem, 3vw, 1.5rem)",
                lineHeight: 1.25,
                color: "var(--ink)",
                marginTop: "0.375rem",
              }}
            >
              {current.question.prompt}
            </h3>
          </div>

          {/* Answer tiles */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.entries(current.question.options) as Array<[AnswerKey, string]>).map(
              ([key, value]) => {
                const isSelected = selectedAnswer === key;
                const isThisCorrect = key === current.question.correctAnswer;
                const showResult = submitted;

                let tileClass = "answer-tile";
                let style: React.CSSProperties = {};

                if (showResult) {
                  if (isThisCorrect) {
                    style = {
                      backgroundColor: "var(--forest-light)",
                      borderColor: "var(--forest)",
                      boxShadow: `0 2px 0 color-mix(in oklch, var(--forest) 30%, transparent)`,
                    };
                  } else if (isSelected && !isThisCorrect) {
                    style = {
                      backgroundColor: "var(--berry-light)",
                      borderColor: "var(--berry)",
                      boxShadow: `0 2px 0 color-mix(in oklch, var(--berry) 30%, transparent)`,
                    };
                  }
                } else if (isSelected) {
                  tileClass = "answer-tile selected";
                }

                return (
                  <button
                    key={key}
                    className={tileClass}
                    style={style}
                    disabled={submitted}
                    onClick={() => setSelectedAnswer(key)}
                    type="button"
                  >
                    <span className="answer-tile-key">{key.toUpperCase()}</span>
                    <span>{value}</span>
                    {showResult && isThisCorrect ? (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          color: "var(--forest)",
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              },
            )}
          </div>

          {/* Actions */}
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
              <button
                className={secondaryButtonClass}
                onClick={() => startTransition(() => void fetchQuestion())}
                type="button"
              >
                Continue →
              </button>
            ) : null}
          </div>

          {/* Result explanation */}
          {submitted ? (
            <div
              style={{
                padding: "1rem 1.25rem",
                borderRadius: 14,
                border: `1.5px solid ${isCorrect ? "color-mix(in oklch, var(--forest) 40%, transparent)" : "color-mix(in oklch, var(--berry) 35%, transparent)"}`,
                backgroundColor: isCorrect ? "var(--forest-light)" : "var(--berry-light)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: isCorrect ? "var(--forest)" : "var(--berry)",
                }}
              >
                {isCorrect ? "Correct! ✓" : "Not quite."}
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--ink)", marginTop: "0.25rem" }}>
                Correct answer:{" "}
                <strong>{current.question.options[current.question.correctAnswer]}</strong>
              </p>
              {current.question.explanation ? (
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--ink-muted)",
                    marginTop: "0.5rem",
                    lineHeight: 1.55,
                  }}
                >
                  {current.question.explanation}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Completion screen ── */}
      {isComplete ? (
        <div
          className="surface"
          style={{
            textAlign: "center",
            borderColor: "var(--warm)",
            borderWidth: 2,
            backgroundColor: "color-mix(in oklch, var(--warm) 10%, var(--card))",
          }}
        >
          <p className="section-eyebrow">Practice complete</p>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginTop: "0.5rem",
            }}
          >
            {correctCount} / 10 correct
          </h2>
          <p style={{ fontSize: "1.0625rem", color: "var(--ink-muted)", marginTop: "0.5rem" }}>
            {correctCount >= 8
              ? "Excellent work! 🎉"
              : correctCount >= 5
                ? "Good effort — keep practising!"
                : "Keep going, you'll get there!"}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <Link className={primaryButtonClass} href="/solo">
              Play again
            </Link>
            <Link className={secondaryButtonClass} href="/">
              Back home
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
