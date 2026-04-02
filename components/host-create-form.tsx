"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { Category } from "@/types/game";

const rounds = [5, 10, 15] as const;
const timeLimits = [10, 15, 20] as const;

type HostCreateState = {
  hostName: string;
  numberOfRounds: 5 | 10 | 15;
  answerTimeLimitSeconds: 10 | 15 | 20;
  categoryMode: "host_selects_each_round" | "random_from_selected_pool";
  enabledCategoryIds: string[];
  fastestCorrectBonus: boolean;
  confidenceWager: boolean;
  teamBonus: boolean;
  hints: boolean;
};

const toggleOptions = [
  { key: "fastestCorrectBonus", label: "Fastest correct bonus", hint: "+1 for the quickest right answer" },
  { key: "confidenceWager", label: "Confidence wager", hint: "Bold: +1 if right, −1 if wrong" },
  { key: "teamBonus", label: "Team bonus", hint: "+1 for everyone if all are correct" },
  { key: "hints", label: "One hint per player", hint: "50/50 option that caps max points" },
] as const;

export function HostCreateForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<HostCreateState>({
    hostName: "Quizmaster",
    numberOfRounds: 5,
    answerTimeLimitSeconds: 15,
    categoryMode: "host_selects_each_round",
    enabledCategoryIds: categories.map((c) => c.id),
    fastestCorrectBonus: true,
    confidenceWager: true,
    teamBonus: true,
    hints: true,
  });

  const toggleCategory = (id: string) => {
    setFormState((cur) => ({
      ...cur,
      enabledCategoryIds: cur.enabledCategoryIds.includes(id)
        ? cur.enabledCategoryIds.filter((x) => x !== id)
        : [...cur.enabledCategoryIds, id],
    }));
  };

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formState),
    });
    const payload = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Couldn't create the room.");
      return;
    }

    router.push(`/game/${payload.roomCode}`);
  };

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <header className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
          <Image src="/media/logo.png" alt="Kids Quiz Live" width={32} height={32} className="rounded-lg" unoptimized />
        </Link>
        <div>
          <p className="section-eyebrow">Host setup</p>
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
            Create a live quiz room
          </h1>
        </div>
      </header>

      <div className="surface space-y-8">
        {/* ── Host name ── */}
        <label className="block">
          <span className="field-label">Your name</span>
          <input
            className="form-input"
            value={formState.hostName}
            onChange={(e) => setFormState((s) => ({ ...s, hostName: e.target.value }))}
            placeholder="Quizmaster"
          />
        </label>

        {/* ── Round settings ── */}
        <div>
          <p className="field-label mb-3">Round settings</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="field-label" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>Rounds</span>
              <select
                className="form-input mt-1"
                value={formState.numberOfRounds}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, numberOfRounds: Number(e.target.value) as 5 | 10 | 15 }))
                }
              >
                {rounds.map((r) => (
                  <option key={r} value={r}>{r} rounds</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>Answer timer</span>
              <select
                className="form-input mt-1"
                value={formState.answerTimeLimitSeconds}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    answerTimeLimitSeconds: Number(e.target.value) as 10 | 15 | 20,
                  }))
                }
              >
                {timeLimits.map((t) => (
                  <option key={t} value={t}>{t} seconds</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>Category mode</span>
              <select
                className="form-input mt-1"
                value={formState.categoryMode}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    categoryMode: e.target.value as "host_selects_each_round" | "random_from_selected_pool",
                  }))
                }
              >
                <option value="host_selects_each_round">Host picks each round</option>
                <option value="random_from_selected_pool">Random from pool</option>
              </select>
            </label>
          </div>
        </div>

        {/* ── Categories ── */}
        <div>
          <p className="field-label">Enabled categories</p>
          <p className="field-hint mb-3">
            {formState.enabledCategoryIds.length} of {categories.length} selected
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const active = formState.enabledCategoryIds.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  className={`cat-pill${active ? " active" : ""}`}
                >
                  <span>
                    {cat.icon} {cat.name}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={active}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  <span className="cat-pill-badge">{active ? "On" : "Off"}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Optional mechanics ── */}
        <div>
          <p className="field-label mb-3">Optional mechanics</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {toggleOptions.map(({ key, label, hint }) => (
              <div key={key} className="feature-row">
                <div>
                  <p className="feature-row-label">{label}</p>
                  <p className="field-hint" style={{ marginTop: 0 }}>{hint}</p>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm ${formState[key] ? "btn-primary" : "btn-secondary"}`}
                  onClick={() =>
                    setFormState((s) => ({ ...s, [key]: !s[key] }))
                  }
                >
                  {formState[key] ? "On" : "Off"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="alert-error">{error}</p> : null}

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            className={primaryButtonClass}
            disabled={isSubmitting || formState.enabledCategoryIds.length === 0}
            onClick={() => startTransition(() => void submit())}
            type="button"
          >
            {isSubmitting ? "Creating room…" : "Create room"}
          </button>
          <Link className={secondaryButtonClass} href="/">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
