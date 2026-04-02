"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";

const avatarColors = ["amber", "coral", "lime", "violet", "sky", "cyan", "rose"] as const;
type AvatarColor = (typeof avatarColors)[number];

type JoinRoomState = {
  roomCode: string;
  displayName: string;
  ageBand: "6_to_8" | "9_to_11" | "12_to_14" | "15_plus";
  difficultyMode: "easy" | "medium" | "hard" | "adaptive";
  avatarColor: AvatarColor;
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
      headers: { "Content-Type": "application/json" },
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
    <div className="space-y-8">
      {/* ── Page header ── */}
      <header className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
          <Image src="/media/logo.png" alt="Kids Quiz Live" width={32} height={32} className="rounded-lg" unoptimized />
        </Link>
        <div>
          <p className="section-eyebrow">Join a room</p>
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
            Hop into the quiz
          </h1>
        </div>
      </header>

      <div className="surface space-y-7">
        {/* ── Room code + name ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Room code</span>
            <input
              className="form-input"
              style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "1.25rem", fontWeight: 700 }}
              value={formState.roomCode}
              onChange={(e) =>
                setFormState((s) => ({ ...s, roomCode: e.target.value.toUpperCase() }))
              }
              placeholder="ABCD"
              maxLength={8}
            />
          </label>
          <label className="block">
            <span className="field-label">Your name</span>
            <input
              className="form-input"
              value={formState.displayName}
              onChange={(e) => setFormState((s) => ({ ...s, displayName: e.target.value }))}
              placeholder="Player"
            />
          </label>
        </div>

        {/* ── Age + difficulty ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Age band</span>
            <select
              className="form-input mt-1"
              value={formState.ageBand}
              onChange={(e) =>
                setFormState((s) => ({
                  ...s,
                  ageBand: e.target.value as "6_to_8" | "9_to_11" | "12_to_14" | "15_plus",
                }))
              }
            >
              <option value="6_to_8">6 – 8 years</option>
              <option value="9_to_11">9 – 11 years</option>
              <option value="12_to_14">12 – 14 years</option>
              <option value="15_plus">15 +</option>
            </select>
          </label>

          <label className="block">
            <span className="field-label">Difficulty</span>
            <select
              className="form-input mt-1"
              value={formState.difficultyMode}
              onChange={(e) =>
                setFormState((s) => ({
                  ...s,
                  difficultyMode: e.target.value as "easy" | "medium" | "hard" | "adaptive",
                }))
              }
            >
              <option value="adaptive">Adaptive (recommended)</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>

        {/* ── Avatar color ── */}
        <div>
          <p className="field-label">Avatar colour</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {avatarColors.map((color) => {
              const selected = formState.avatarColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormState((s) => ({ ...s, avatarColor: color }))}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: selected ? "3px solid var(--ink)" : "2.5px solid transparent",
                    boxShadow: selected ? "0 0 0 2px var(--card), 0 0 0 4px var(--ink)" : "none",
                    outline: "none",
                    cursor: "pointer",
                    transform: selected ? "scale(1.15)" : "scale(1)",
                    transition: "transform 120ms, box-shadow 120ms",
                    flexShrink: 0,
                  }}
                  className={`avatar-${color}`}
                  aria-label={`Avatar colour: ${color}`}
                  aria-pressed={selected}
                />
              );
            })}
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 mt-4">
            <div
              className={`avatar avatar-md avatar-${formState.avatarColor}`}
              aria-hidden="true"
            >
              {formState.displayName.charAt(0).toUpperCase() || "P"}
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  color: "var(--ink)",
                }}
              >
                {formState.displayName || "Player"}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
                {formState.ageBand.replaceAll("_", " ")} · {formState.difficultyMode}
              </p>
            </div>
          </div>
        </div>

        {error ? <p className="alert-error">{error}</p> : null}

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            className={primaryButtonClass}
            disabled={isSubmitting || !formState.roomCode || !formState.displayName}
            onClick={() => startTransition(() => void submit())}
            type="button"
          >
            {isSubmitting ? "Joining…" : "Join the game"}
          </button>
          <Link className={secondaryButtonClass} href="/">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
