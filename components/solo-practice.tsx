"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { primaryButtonClass, secondaryButtonClass, StatPill } from "@/components/ui";
import type { AnswerKey, Category, Question } from "@/types/game";
import type { PracticeAccountProfile, PracticeLifetimeProgress } from "@/types/practice";

interface SoloQuestionPayload {
  category: Category;
  question: Question;
  lifetimeProgress: PracticeLifetimeProgress;
}

interface SoloAnswerPayload {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: AnswerKey;
  correctAnswerText: string;
  explanation: string;
  lifetimeProgress: PracticeLifetimeProgress;
}

interface SoloFlagPayload {
  questionId: string;
  alreadyFlagged: boolean;
}

function formatPercent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

export function SoloPractice({
  categories,
  initialAccount,
}: {
  categories: Category[];
  initialAccount: PracticeAccountProfile | null;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount);
  const [lifetimeProgress, setLifetimeProgress] = useState(initialAccount?.lifetimeProgress ?? null);
  const [ageBand, setAgeBand] = useState<"6_to_8" | "9_to_11" | "12_to_14" | "15_plus">("9_to_11");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [current, setCurrent] = useState<SoloQuestionPayload | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerKey | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SoloAnswerPayload | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [isFlaggingQuestion, setIsFlaggingQuestion] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);
  const [flagMessage, setFlagMessage] = useState<string | null>(null);
  const hasStarted = askedIds.length > 0 || current !== null;

  const resetSession = () => {
    setAskedIds([]);
    setCurrent(null);
    setSelectedAnswer(null);
    setSubmitted(false);
    setResult(null);
    setCorrectCount(0);
    setError(null);
    setFlagMessage(null);
  };

  const handleAuth = async (path: "/api/account/register" | "/api/account/login") => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setAuthError(payload.error ?? "Couldn't sign you in.");
        return;
      }

      setAccount(payload.account);
      setLifetimeProgress(payload.account.lifetimeProgress);
      setUsername("");
      setPassword("");
      resetSession();
      router.refresh();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/account/logout", { method: "POST" });
      setAccount(null);
      setLifetimeProgress(null);
      setAuthError(null);
      resetSession();
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const fetchQuestion = async () => {
    if (!account) {
      setError("Create a local account or sign in to start tracking progress.");
      return;
    }

    setError(null);
    setIsLoadingQuestion(true);

    try {
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
      setLifetimeProgress(payload.lifetimeProgress);
      setSelectedAnswer(null);
      setSubmitted(false);
      setResult(null);
      setFlagMessage(null);
      setAskedIds((ids) => [...ids, payload.question.id]);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const submitAnswer = async () => {
    if (!current || !selectedAnswer) {
      return;
    }

    setError(null);
    setIsSavingAnswer(true);

    try {
      const response = await fetch("/api/solo/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: current.question.id,
          answerKey: selectedAnswer,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Couldn't save that answer.");
        return;
      }

      setSubmitted(true);
      setResult(payload);
      setLifetimeProgress(payload.lifetimeProgress);

      if (payload.isCorrect) {
      setCorrectCount((count) => count + 1);
      }
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const flagQuestion = async () => {
    if (!current) {
      return;
    }

    setError(null);
    setFlagMessage(null);
    setIsFlaggingQuestion(true);

    try {
      const response = await fetch("/api/solo/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: current.question.id,
        }),
      });
      const payload = (await response.json()) as SoloFlagPayload & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Couldn't flag that question.");
        return;
      }

      setFlaggedQuestionIds((questionIds) =>
        questionIds.includes(payload.questionId) ? questionIds : [...questionIds, payload.questionId],
      );
      setFlagMessage(
        payload.alreadyFlagged
          ? "You already flagged this question."
          : "Thanks. We logged this question for review.",
      );
    } finally {
      setIsFlaggingQuestion(false);
    }
  };

  const questionNumber = Math.min(askedIds.length, 10);
  const isComplete = askedIds.length >= 10 && submitted;
  const isCorrect = submitted && result?.isCorrect;
  const canStartPractice = Boolean(account && categoryId);
  const currentQuestionAlreadyFlagged = current ? flaggedQuestionIds.includes(current.question.id) : false;

  return (
    <div className="space-y-8">
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

      {!account ? (
        <div className="surface space-y-5">
          <div>
            <p className="section-eyebrow">Local account</p>
            <h2 className="section-title" style={{ fontSize: "1.1875rem" }}>
              Save progress on this device
            </h2>
            <p style={{ fontSize: "0.9375rem", color: "var(--ink-muted)", marginTop: "0.5rem", lineHeight: 1.6 }}>
              Practice mode now tracks mastered questions and weak areas over time. Create a simple local account or sign in to keep that history.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label" style={{ fontSize: "0.8125rem" }}>Username</span>
              <input
                className="form-input mt-1"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="A kid-friendly name"
                type="text"
                value={username}
              />
            </label>

            <label className="block">
              <span className="field-label" style={{ fontSize: "0.8125rem" }}>Password</span>
              <input
                className="form-input mt-1"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Simple local password"
                type="password"
                value={password}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className={primaryButtonClass}
              disabled={isAuthenticating || username.trim().length < 2 || password.length < 4}
              onClick={() => startTransition(() => void handleAuth("/api/account/register"))}
              type="button"
            >
              {isAuthenticating ? "Saving..." : "Create account"}
            </button>
            <button
              className={secondaryButtonClass}
              disabled={isAuthenticating || username.trim().length < 2 || password.length < 4}
              onClick={() => startTransition(() => void handleAuth("/api/account/login"))}
              type="button"
            >
              {isAuthenticating ? "Checking..." : "Log in"}
            </button>
          </div>

          {authError ? <p className="alert-error">{authError}</p> : null}
        </div>
      ) : (
        <div className="surface space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-eyebrow">Lifetime progress</p>
              <h2 className="section-title" style={{ fontSize: "1.1875rem" }}>
                {account.username} practice record
              </h2>
              <p style={{ fontSize: "0.9375rem", color: "var(--ink-muted)", marginTop: "0.5rem", lineHeight: 1.6 }}>
                Correctly answered questions stay retired. Misses feed the next question picks so practice leans into the areas that still need work.
              </p>
            </div>

            <button
              className={secondaryButtonClass}
              disabled={isLoggingOut}
              onClick={() => startTransition(() => void logout())}
              type="button"
            >
              {isLoggingOut ? "Signing out..." : "Log out"}
            </button>
          </div>

          {lifetimeProgress ? (
            <>
              <div className="flex flex-wrap gap-3">
                <StatPill accent="forest" label="Mastered" value={lifetimeProgress.masteredCount} />
                <StatPill accent="coral" label="Answered" value={lifetimeProgress.totalAnswered} />
                <StatPill accent="amber" label="Accuracy" value={formatPercent(lifetimeProgress.accuracyRate)} />
                <StatPill accent="coral" label="Streak" value={lifetimeProgress.currentStreak} />
              </div>

              {lifetimeProgress.weakAreas.length > 0 ? (
                <div>
                  <p className="field-label" style={{ fontSize: "0.8125rem" }}>Needs more practice</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {lifetimeProgress.weakAreas.map((area) => (
                      <span key={area} className="progress-chip">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="field-label" style={{ fontSize: "0.8125rem" }}>By category</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {lifetimeProgress.categoryProgress.map((entry) => {
                    const attempts = entry.correctCount + entry.incorrectCount;

                    return (
                      <div
                        key={entry.categoryId}
                        style={{
                          padding: "0.95rem 1rem",
                          borderRadius: 14,
                          border: "1.5px solid var(--ink-faint)",
                          backgroundColor: "color-mix(in oklch, var(--card) 92%, var(--canvas))",
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p style={{ fontWeight: 700, color: "var(--ink)" }}>
                            {entry.icon} {entry.categoryName}
                          </p>
                          <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                            {entry.masteredCount} mastered
                          </span>
                        </div>
                        <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", marginTop: "0.4rem" }}>
                          {attempts === 0
                            ? "No lifetime attempts yet."
                            : `${entry.correctCount} correct, ${entry.incorrectCount} incorrect`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

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
              onChange={(event) => {
                setCategoryId(event.target.value);
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
              onChange={(event) => {
                setAgeBand(event.target.value as "6_to_8" | "9_to_11" | "12_to_14" | "15_plus");
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
                disabled={!canStartPractice || isLoadingQuestion}
                onClick={() => startTransition(() => void fetchQuestion())}
                type="button"
                style={{ width: "100%" }}
              >
                {isLoadingQuestion ? "Loading..." : "Start practice"}
              </button>
            )}
          </div>
        </div>

        {!account ? (
          <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)" }}>
            Sign in above to unlock lifetime progress and personalized question rotation.
          </p>
        ) : null}

        {error ? <p className="alert-error">{error}</p> : null}
      </div>

      {current ? (
        <div className="surface space-y-5">
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

          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.entries(current.question.options) as Array<[AnswerKey, string]>).map(
              ([key, value]) => {
                const isSelected = selectedAnswer === key;
                const isThisCorrect = key === result?.correctAnswer;
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

          <div className="flex flex-wrap gap-3">
            <button
              className={primaryButtonClass}
              disabled={!selectedAnswer || submitted || isSavingAnswer}
              onClick={() => startTransition(() => void submitAnswer())}
              type="button"
            >
              {isSavingAnswer ? "Saving..." : "Lock answer"}
            </button>
            <button
              className={secondaryButtonClass}
              disabled={!current || isFlaggingQuestion || currentQuestionAlreadyFlagged}
              onClick={() => startTransition(() => void flagQuestion())}
              type="button"
            >
              {currentQuestionAlreadyFlagged
                ? "Flagged for review"
                : isFlaggingQuestion
                  ? "Flagging..."
                  : "Flag as incorrect"}
            </button>
            {submitted && !isComplete ? (
              <button
                className={secondaryButtonClass}
                disabled={isLoadingQuestion}
                onClick={() => startTransition(() => void fetchQuestion())}
                type="button"
              >
                {isLoadingQuestion ? "Loading..." : "Continue →"}
              </button>
            ) : null}
          </div>
          {flagMessage ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
              {flagMessage}
            </p>
          ) : null}

          {submitted && result ? (
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
                Correct answer: <strong>{result.correctAnswerText}</strong>
              </p>
              {result.explanation ? (
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--ink-muted)",
                    marginTop: "0.5rem",
                    lineHeight: 1.55,
                  }}
                >
                  {result.explanation}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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
              ? "Excellent work!"
              : correctCount >= 5
                ? "Good effort — keep practising!"
                : "Keep going, you'll get there!"}
          </p>
          {lifetimeProgress ? (
            <p style={{ fontSize: "0.9375rem", color: "var(--ink-muted)", marginTop: "0.75rem" }}>
              Lifetime: {lifetimeProgress.masteredCount} mastered, {formatPercent(lifetimeProgress.accuracyRate)} accuracy.
            </p>
          ) : null}
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
