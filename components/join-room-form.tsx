"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { joinRoomSchema } from "@/lib/game/validators";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { classNames } from "@/lib/utils/classnames";

const avatarColors = ["amber", "coral", "lime", "violet", "sky", "cyan", "rose"] as const;
const ageBands = [
  { value: "6_to_8", label: "6–8" },
  { value: "9_to_11", label: "9–11" },
  { value: "12_to_14", label: "12–14" },
  { value: "15_plus", label: "15+" },
] as const;
const profileKey = "witzy-join-profile-v1";

type Profile = z.infer<typeof joinRoomSchema>;
const ageLabel = (profile: Profile) => ageBands.find((band) => band.value === profile.ageBand)?.label;

export function JoinRoomForm({ initialRoomCode }: { initialRoomCode: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  // undefined until localStorage has been read, so the form never flashes before the one-tap button.
  const [saved, setSaved] = useState<Profile | null | undefined>(undefined);
  const [someoneElse, setSomeoneElse] = useState(false);
  const [name, setName] = useState("");
  const [ageBand, setAgeBand] = useState<Profile["ageBand"] | null>(null);
  const [difficultyMode, setDifficultyMode] = useState<Profile["difficultyMode"]>("adaptive");
  const [avatarColor, setAvatarColor] = useState<(typeof avatarColors)[number]>("cyan");

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const profile = joinRoomSchema.safeParse(JSON.parse(localStorage.getItem(profileKey) ?? "null"));
        setSaved(profile.success ? profile.data : null);
        // Typing a room code by hand is not the one-tap path, so offer the saved details as a filled-in form.
        if (profile.success && !initialRoomCode) {
          setName(profile.data.displayName);
          setAgeBand(profile.data.ageBand);
        }
      } catch { setSaved(null); /* Storage may be unavailable on shared/private devices. */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, [initialRoomCode]);

  const join = async (profile: Profile) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomCode.toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Couldn't join that room.");
        return;
      }
      try {
        if (remember) localStorage.setItem(profileKey, JSON.stringify(profile));
        else localStorage.removeItem(profileKey);
      } catch { /* Joining does not depend on browser storage. */ }
      router.push(`/game/${payload.roomCode}`);
    } catch { setError("Couldn't connect. Please try again."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
          <Image src="/media/logo.png" alt="Witzy" width={32} height={32} className="rounded-lg" unoptimized />
        </Link>
        <div>
          <p className="section-eyebrow">{initialRoomCode ? `Room ${roomCode}` : "Join a room"}</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.5rem, 4vw, 2.25rem)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ink)" }}>
            Hop into the quiz
          </h1>
        </div>
      </header>

      {saved === undefined ? null : saved && initialRoomCode && !someoneElse ? (
        <div className="surface space-y-4">
          <button className={classNames(primaryButtonClass, "btn-lg w-full")} disabled={isSubmitting} onClick={() => void join(saved)} type="button">
            {isSubmitting ? "Joining…" : `Join as ${saved.displayName} · ${ageLabel(saved)}`}
          </button>
          <button className="underline" onClick={() => setSomeoneElse(true)} type="button">Someone else?</button>
          {error ? <p className="alert-error">{error}</p> : null}
        </div>
      ) : (
        <form
          className="surface space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (ageBand) void join({ displayName: name.trim(), ageBand, difficultyMode, avatarColor });
          }}
        >
          {initialRoomCode ? null : (
            <label className="block">
              <span className="field-label">Room code</span>
              <input
                autoFocus
                className="form-input"
                style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "1.25rem", fontWeight: 700 }}
                maxLength={8}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                placeholder="ABCD"
                required
                value={roomCode}
              />
            </label>
          )}
          <label className="block">
            <span className="field-label">Your name</span>
            <input
              autoComplete="given-name"
              autoFocus={Boolean(initialRoomCode)}
              className="form-input"
              maxLength={30}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <fieldset>
            <legend className="field-label">Your age</legend>
            <div className="grid grid-cols-4 gap-2">
              {ageBands.map(({ value, label }) => (
                <label key={value} className={classNames("cat-pill px-1! focus-within:ring-2", ageBand === value && "active")}>
                  <input checked={ageBand === value} className="sr-only" name="ageBand" onChange={() => setAgeBand(value)} required type="radio" />
                  <span className="mx-auto whitespace-nowrap">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">More options</summary>
            <div className="space-y-4 pt-2">
              <label className="block">
                <span className="field-label">Difficulty</span>
                <select className="form-input" onChange={(event) => setDifficultyMode(event.target.value as Profile["difficultyMode"])} value={difficultyMode}>
                  <option value="adaptive">Adaptive (recommended)</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <div>
                <p className="field-label">Avatar colour</p>
                <div className="flex flex-wrap gap-3">
                  {avatarColors.map((color) => (
                    <button
                      key={color}
                      aria-label={`Avatar colour: ${color}`}
                      aria-pressed={avatarColor === color}
                      className={classNames("avatar avatar-md", `avatar-${color}`, avatarColor === color && "ring-2 ring-offset-2 ring-[var(--ink)]")}
                      onClick={() => setAvatarColor(color)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>
          {error ? <p className="alert-error">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button className={primaryButtonClass} disabled={isSubmitting} type="submit">{isSubmitting ? "Joining…" : "Join the game"}</button>
            <Link className={secondaryButtonClass} href="/">Back home</Link>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
            Remember my name and age on this device
          </label>
        </form>
      )}
    </div>
  );
}
