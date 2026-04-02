"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { primaryButtonClass, secondaryButtonClass, Surface } from "@/components/ui";
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
  { key: "fastestCorrectBonus", label: "Fastest correct bonus" },
  { key: "confidenceWager", label: "Confidence wager" },
  { key: "teamBonus", label: "Team bonus" },
  { key: "hints", label: "One hint per player" },
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
    enabledCategoryIds: categories.map((category) => category.id),
    fastestCorrectBonus: true,
    confidenceWager: true,
    teamBonus: true,
    hints: true,
  });

  const toggleCategory = (categoryId: string) => {
    setFormState((current) => {
      const enabledCategoryIds = current.enabledCategoryIds.includes(categoryId)
        ? current.enabledCategoryIds.filter((entry) => entry !== categoryId)
        : [...current.enabledCategoryIds, categoryId];

      return {
        ...current,
        enabledCategoryIds,
      };
    });
  };

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formState),
    });
    const payload = await response.json();

    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Couldn't create the room yet.");
      return;
    }

    router.push(`/game/${payload.roomCode}`);
  };

  return (
    <Surface className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Host Setup</p>
        <h2 className="text-3xl font-black text-white">Create a live family quiz room</h2>
        <p className="max-w-2xl text-sm text-slate-300">
          Choose the round count, timer pressure, and optional bonuses. Players join from their own phones with the room
          code.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white">Host name</span>
        <input
          className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/60"
          value={formState.hostName}
          onChange={(event) => setFormState((current) => ({ ...current, hostName: event.target.value }))}
          placeholder="Quizmaster"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white">Rounds</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
            value={formState.numberOfRounds}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                numberOfRounds: Number(event.target.value) as 5 | 10 | 15,
              }))
            }
          >
            {rounds.map((round) => (
              <option key={round} value={round}>
                {round} rounds
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-white">Answer timer</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
            value={formState.answerTimeLimitSeconds}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                answerTimeLimitSeconds: Number(event.target.value) as 10 | 15 | 20,
              }))
            }
          >
            {timeLimits.map((limit) => (
              <option key={limit} value={limit}>
                {limit} seconds
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-white">Category mode</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
            value={formState.categoryMode}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                categoryMode: event.target.value as "host_selects_each_round" | "random_from_selected_pool",
              }))
            }
          >
            <option value="host_selects_each_round">Host selects each round</option>
            <option value="random_from_selected_pool">Random from selected pool</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Enabled categories</p>
          <p className="text-sm text-slate-400">Keep it broad for demo games, or trim the pool for themed rounds.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const checked = formState.enabledCategoryIds.includes(category.id);
            return (
              <label
                key={category.id}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  checked
                    ? "border-orange-300/40 bg-orange-300/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-300"
                }`}
              >
                <span className="font-medium">
                  {category.icon} {category.name}
                </span>
                <input
                  className="sr-only"
                  checked={checked}
                  type="checkbox"
                  onChange={() => toggleCategory(category.id)}
                />
                <span className="text-xs uppercase tracking-[0.2em]">{checked ? "On" : "Off"}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {toggleOptions.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
          >
            <span className="font-medium">{label}</span>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                formState[key]
                  ? "bg-lime-300 text-slate-950"
                  : "bg-slate-800 text-slate-300"
              }`}
              onClick={() =>
                setFormState((current) => ({
                  ...current,
                  [key]: !current[key],
                }))
              }
            >
              {formState[key] ? "Enabled" : "Disabled"}
            </button>
          </label>
        ))}
      </div>

      {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          className={primaryButtonClass}
          disabled={isSubmitting || formState.enabledCategoryIds.length === 0}
          onClick={() => startTransition(() => void submit())}
          type="button"
        >
          {isSubmitting ? "Creating room..." : "Create room"}
        </button>
        <Link className={secondaryButtonClass} href="/">
          Back home
        </Link>
      </div>
    </Surface>
  );
}
