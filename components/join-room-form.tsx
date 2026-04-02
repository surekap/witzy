"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { primaryButtonClass, secondaryButtonClass, Surface } from "@/components/ui";

const avatarColors = ["amber", "cyan", "rose", "lime", "violet", "sky"];
type JoinRoomState = {
  roomCode: string;
  displayName: string;
  ageBand: "6_to_8" | "9_to_11" | "12_to_14" | "15_plus";
  difficultyMode: "easy" | "medium" | "hard" | "adaptive";
  avatarColor: string;
};

export function JoinRoomForm({ initialRoomCode }: { initialRoomCode: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<JoinRoomState>({
    roomCode: initialRoomCode,
    displayName: "Player",
    ageBand: "9_to_11",
    difficultyMode: "adaptive",
    avatarColor: "cyan",
  });

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/rooms/${formState.roomCode.toUpperCase()}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: formState.displayName,
        ageBand: formState.ageBand,
        difficultyMode: formState.difficultyMode,
        avatarColor: formState.avatarColor,
      }),
    });
    const payload = await response.json();

    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Couldn't join that room.");
      return;
    }

    router.push(`/game/${payload.roomCode}`);
  };

  return (
    <Surface className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Join Room</p>
        <h2 className="text-3xl font-black text-white">Hop into the next quiz round</h2>
        <p className="max-w-2xl text-sm text-slate-300">
          Join from any phone or tablet, choose the age band that fits, and the game will tune the questions to your
          challenge level.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white">Room code</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white uppercase placeholder:text-slate-500 focus:border-cyan-300/60"
            value={formState.roomCode}
            onChange={(event) =>
              setFormState((current) => ({ ...current, roomCode: event.target.value.toUpperCase() }))
            }
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white">Display name</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-300/60"
            value={formState.displayName}
            onChange={(event) => setFormState((current) => ({ ...current, displayName: event.target.value }))}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white">Age band</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
            value={formState.ageBand}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                ageBand: event.target.value as "6_to_8" | "9_to_11" | "12_to_14" | "15_plus",
              }))
            }
          >
            <option value="6_to_8">6 to 8</option>
            <option value="9_to_11">9 to 11</option>
            <option value="12_to_14">12 to 14</option>
            <option value="15_plus">15 plus</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white">Difficulty</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
            value={formState.difficultyMode}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                difficultyMode: event.target.value as "easy" | "medium" | "hard" | "adaptive",
              }))
            }
          >
            <option value="adaptive">Adaptive</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <div className="space-y-2">
          <span className="text-sm font-semibold text-white">Avatar color</span>
          <div className="flex flex-wrap gap-2">
            {avatarColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormState((current) => ({ ...current, avatarColor: color }))}
                className={`h-11 w-11 rounded-full border-2 transition ${
                  formState.avatarColor === color ? "border-white scale-110" : "border-transparent"
                } ${
                  color === "amber"
                    ? "bg-amber-400"
                    : color === "cyan"
                      ? "bg-cyan-400"
                      : color === "rose"
                        ? "bg-rose-400"
                        : color === "lime"
                          ? "bg-lime-400"
                          : color === "violet"
                            ? "bg-violet-400"
                            : "bg-sky-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          className={primaryButtonClass}
          disabled={isSubmitting}
          onClick={() => startTransition(() => void submit())}
          type="button"
        >
          {isSubmitting ? "Joining..." : "Join the game"}
        </button>
        <Link className={secondaryButtonClass} href="/">
          Back home
        </Link>
      </div>
    </Surface>
  );
}
