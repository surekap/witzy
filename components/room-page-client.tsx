"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";

import { primaryButtonClass, secondaryButtonClass, StatPill } from "@/components/ui";
import { RoomInvite } from "@/components/room-invite";
import { classNames } from "@/lib/utils/classnames";
import type { AnswerKey, Category, CurrentRoundView, QuestionDifficulty, RoomStateView } from "@/types/game";

/* ── Helpers ──────────────────────────────────────────────── */

// Server time at `monotonicAt` (performance.now), from the response with the smallest round trip.
type Clock = { serverNow: number; monotonicAt: number; rtt: number };
const HEARTBEAT_MS = 15_000; // keep well under PRESENCE_TIMEOUT_MS (lib/game/timing.ts)
const serverTime = (clock: Clock) => clock.serverNow + performance.now() - clock.monotonicAt;

// Ticks 10x a second for the one small component that shows it, so the room page itself never re-renders for the clock.
function useServerNow(clock: RefObject<Clock>) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(serverTime(clock.current));
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 100);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [clock]);
  return now;
}

// True once server time passes `iso`; re-renders the caller only when that flips.
function useReached(clock: RefObject<Clock>, iso: string | null | undefined) {
  const [reached, setReached] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const check = () => { if (serverTime(clock.current) >= Date.parse(iso)) { setReached(iso); window.clearInterval(id); } };
    const first = window.setTimeout(check, 0);
    const id = window.setInterval(check, 100);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [clock, iso]);
  return Boolean(iso) && reached === iso;
}

function getAvatarClass(color: string) {
  const map: Record<string, string> = {
    amber:  "avatar-amber",
    coral:  "avatar-coral",
    rose:   "avatar-rose",
    lime:   "avatar-lime",
    violet: "avatar-violet",
    sky:    "avatar-sky",
    cyan:   "avatar-cyan",
  };
  return map[color] ?? "avatar-cyan";
}

const basePointsByDifficulty: Record<QuestionDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

function formatDifficulty(difficulty: QuestionDifficulty) {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

function RoundTimer({ clock, round }: { clock: RefObject<Clock>; round: CurrentRoundView }) {
  const now = useServerNow(clock);
  if (now === null || !round.endsAt || !round.startedAt) return <div className="timer-pill ok" style={{ fontSize: "0.875rem" }}>Waiting</div>;
  if (now < Date.parse(round.startedAt)) return <div className="timer-pill ok" style={{ fontSize: "0.875rem" }}>Get ready</div>;
  const secs = Math.max(0, Math.ceil((Date.parse(round.endsAt) - now) / 1000));
  const urgency = secs <= 4 ? "urgent" : secs <= 9 ? "warn" : "ok";
  return (
    <div className={`timer-pill ${urgency}`}>
      {secs}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.75rem",
          fontWeight: 700,
          opacity: 0.6,
          marginLeft: 2,
        }}
      >
        s
      </span>
    </div>
  );
}

/* ── Root component ───────────────────────────────────────── */

export function RoomPageClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [roomState, setRoomState] = useState<RoomStateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [realtime, setRealtime] = useState(false);
  const clock = useRef<Clock>({ serverNow: 0, monotonicAt: 0, rtt: Infinity });
  const lastRevision = useRef(-1);
  const lastServerNow = useRef(0);
  const refreshing = useRef(false);
  const refreshQueued = useRef(false);
  const roundStatus = roomState?.currentRound?.status;
  const hasStarted = useReached(clock, roomState?.currentRound?.startedAt);
  const hasExpired = useReached(clock, roomState?.currentRound?.endsAt);

  const applyState = (payload: RoomStateView, requestStarted: number) => {
    const revision = payload.revision ?? 0;
    if (revision < lastRevision.current || (revision === lastRevision.current && payload.serverNow < lastServerNow.current)) return;
    lastRevision.current = revision;
    lastServerNow.current = payload.serverNow;
    const received = performance.now();
    const rtt = received - requestStarted;
    // The lowest-latency response gives the truest offset; adopt a slower one only to stop a stale offset drifting.
    if (rtt < clock.current.rtt || received - clock.current.monotonicAt > 60_000) {
      clock.current = { serverNow: payload.serverNow + rtt / 2, monotonicAt: received, rtt };
    }
    setRoomState(payload);
    setError(null);
  };

  const deferredLeaderboard = useDeferredValue(roomState?.leaderboard ?? []);

  const fetchState = async () => {
    const requestStarted = performance.now();
    try {
      const response = await fetch(`/api/rooms/${roomCode}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Couldn't load this room.");
        return;
      }
      applyState(payload, requestStarted);
    } catch {
      setError("Connection interrupted. Reconnecting; an unconfirmed answer can be retried.");
    }
  };

  // One fetch at a time; a request that arrives meanwhile queues exactly one follow-up so the newest change is never dropped.
  const refreshState = useEffectEvent(async () => {
    if (refreshing.current) {
      refreshQueued.current = true;
      return;
    }
    refreshing.current = true;
    do {
      refreshQueued.current = false;
      await fetchState();
    } while (refreshQueued.current);
    refreshing.current = false;
  });

  useEffect(() => {
    const id = window.setTimeout(() => void refreshState(), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Phones sleep tabs and drop networks; catch up the moment the player is back.
  useEffect(() => {
    const wake = () => { if (document.visibilityState === "visible") void refreshState(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, []);

  useEffect(() => {
    // Past the deadline nothing bumps the revision, so poll until the server has locked the round.
    const pollMs = roundStatus === "active" && hasExpired ? 1000 : realtime ? 5000 : roundStatus === "active" ? 900 : 1500;
    const id = window.setInterval(() => void refreshState(), pollMs);
    return () => window.clearInterval(id);
  }, [roundStatus, hasExpired, realtime]);

  useEffect(() => {
    const token = roomState?.subscriptionToken;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    // Test mode uses in-memory rooms and must never contact a live deployment.
    if (!token || !url || process.env.NEXT_PUBLIC_WITZY_TEST_MODE === "1") return;
    const client = new ConvexClient(url, { logger: false });
    const stop = client.onUpdate(makeFunctionReference<"query", { roomCode: string; token: string }, number>("rooms:watchRevision"), { roomCode, token }, (revision) => {
      setRealtime(true);
      if (revision > lastRevision.current) void refreshState();
    }, () => setRealtime(false));
    const connectionCheck = window.setInterval(() => {
      if (!client.connectionState().isWebSocketConnected) setRealtime(false);
    }, 3000);
    return () => { window.clearInterval(connectionCheck); stop(); void client.close(); };
  }, [roomCode, roomState?.subscriptionToken]);

  useEffect(() => {
    if (roomState?.viewer.role !== "player") return;
    const beat = () => { void fetch(`/api/rooms/${roomCode}/heartbeat`, { method: "POST" }).catch(() => undefined); };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [roomCode, roomState?.viewer.role]);

  const runAction = async (url: string, body?: unknown) => {
    const started = performance.now();
    try {
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "That action didn't work.");
      return;
    }
    applyState(payload, started);
    } catch {
      setError("We couldn't confirm that action. Check your connection and retry.");
    }
  };

  /* ── Error / loading ── */
  if (error && !roomState) {
    return (
      <div className="surface space-y-4">
        <p className="section-eyebrow" style={{ color: "var(--berry)" }}>Room error</p>
        <h2 className="section-title">{error}</h2>
        <div className="flex gap-3">
          <Link className={secondaryButtonClass} href="/join">Join a room</Link>
          <Link className={primaryButtonClass} href="/host">Host a game</Link>
        </div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="surface space-y-3">
        <p className="section-eyebrow">Loading</p>
        <h2 className="section-title">Syncing quiz state…</h2>
      </div>
    );
  }

  const isHost = roomState.viewer.role === "host";
  const currentRound = roomState.currentRound;
  const playerQuestion = roomState.playerQuestion;
  const activeCategoryId = selectedCategoryId || roomState.categories[0]?.id || "";

  return (
    <div className="space-y-6">
      {/* ── Room header ── */}
      <header className="surface space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" style={{ textDecoration: "none" }}>
              <Image src="/media/logo.png" alt="Witzy" width={32} height={32} className="rounded-lg" unoptimized />
            </Link>
            <div>
              <p className="section-eyebrow">
                Room {roomState.room.roomCode}
                <span
                  style={{
                    marginLeft: "0.5rem",
                    padding: "0.125rem 0.5rem",
                    borderRadius: 9999,
                    fontSize: "0.6875rem",
                    fontWeight: 800,
                    backgroundColor:
                      isHost
                        ? "var(--coral-light)"
                        : "color-mix(in oklch, var(--ink) 7%, transparent)",
                    color: isHost ? "var(--coral)" : "var(--ink-muted)",
                  }}
                >
                  {roomState.viewer.role}
                </span>
              </p>
              <h1 className="section-title" style={{ fontSize: "1.25rem" }}>
                {roomState.room.status === "lobby"
                  ? "Players are joining…"
                  : roomState.room.status === "finished"
                    ? "Final scores are in"
                    : "Live quiz in progress"}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatPill
              label="Round"
              value={`${roomState.room.currentRoundNumber} / ${roomState.room.config.numberOfRounds}`}
            />
            <StatPill
              label="Timer"
              value={typeof roomState.room.config.answerTimeLimitSeconds === "number" ? `${roomState.room.config.answerTimeLimitSeconds}s` : roomState.room.config.answerTimeLimitSeconds}
              accent="amber"
            />
            <StatPill
              label="Mode"
              value={
                roomState.room.config.categoryMode === "host_selects_each_round"
                  ? "Host pick"
                  : "Random"
              }
              accent="forest"
            />
          </div>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
          Host: <strong style={{ color: "var(--ink)" }}>{roomState.room.hostName}</strong>
        </p>

        {error ? <p className="alert-error">{error}</p> : null}
        {isHost && roomState.room.status === "lobby" ? <RoomInvite roomCode={roomCode} /> : null}
      </header>

      {/* ── Main two-column layout ── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* ── Left: game panels ── */}
        <div className="space-y-6">
          {/* LOBBY */}
          {roomState.room.status === "lobby" ? (
            <div className="surface space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">Lobby</p>
                  <h2 className="section-title">Waiting for everyone to join</h2>
                </div>
                {isHost ? (
                  <button
                    className={primaryButtonClass}
                    onClick={() => startTransition(async () => { await runAction(`/api/rooms/${roomCode}/start`); })}
                    type="button"
                  >
                    Start game
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--ink-muted)",
                      padding: "0.5rem 1rem",
                      borderRadius: 9999,
                      border: "1.5px solid var(--ink-faint)",
                      backgroundColor: "var(--card)",
                    }}
                  >
                    Waiting for host…
                  </span>
                )}
              </div>
              <PlayersList players={roomState.players} leaderboard={roomState.leaderboard} viewerId={roomState.viewer.playerId} />
            </div>
          ) : null}

          {/* ROUND LAUNCHER (game in_progress, no active round yet) */}
          {roomState.room.status === "in_progress" && !currentRound ? (
            <div className="surface space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">Round launcher</p>
                  <h2 className="section-title">Ready for round one</h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)", marginTop: "0.25rem" }}>
                    {isHost
                      ? "Pick a category, then launch the synchronized question set."
                      : "The host is choosing the opening category."}
                  </p>
                </div>
                {isHost ? (
                  <div className="flex flex-wrap gap-3">
                    {roomState.room.config.categoryMode === "host_selects_each_round" ? (
                      <select
                        className="form-input"
                        style={{ width: "auto" }}
                        value={activeCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                      >
                        {roomState.categories.map((cat: Category) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      className={primaryButtonClass}
                      onClick={() =>
                        startTransition(async () => {
                          await runAction(`/api/rooms/${roomCode}/rounds/start`, {
                            categoryId:
                              roomState.room.config.categoryMode === "host_selects_each_round"
                                ? activeCategoryId
                                : undefined,
                          });
                        })
                      }
                      type="button"
                    >
                      Start round 1
                    </button>
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--ink-muted)",
                      padding: "0.5rem 1rem",
                      borderRadius: 9999,
                      border: "1.5px solid var(--ink-faint)",
                    }}
                  >
                    Waiting for round 1…
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {/* ACTIVE ROUND */}
          {currentRound && roomState.room.status !== "lobby" ? (
            <div className="surface space-y-5">
              {/* Round header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">
                    {currentRound.categoryName} · Round {currentRound.roundNumber}
                  </p>
                  <h2 className="section-title">
                    {currentRound.status === "active"
                      ? "Questions are live"
                      : currentRound.status === "locked"
                        ? "Answers locked"
                        : "Round reveal"}
                  </h2>
                </div>
                {currentRound.status === "active" ? <RoundTimer clock={clock} round={currentRound} /> : <span className="timer-pill ok">Complete</span>}
              </div>

              {/* Player question */}
              {currentRound.status === "active" && !hasStarted ? (
                <p role="status" className="section-title">Get ready...</p>
              ) : currentRound.status === "active" && playerQuestion && roomState.viewer.role === "player" ? (
                <PlayerQuestionPanel
                  key={playerQuestion.assignedQuestionId}
                  playerQuestion={playerQuestion}
                  roomCode={roomCode}
                  runAction={runAction}
                  wageringEnabled={roomState.room.config.confidenceWager}
                  hintsEnabled={roomState.room.config.hints}
                  timeExpired={hasExpired}
                  equalBasePoints={roomState.room.config.equalBasePoints ?? false}
                  compactAnswers={Object.values(playerQuestion.options).every((option) => (option?.length ?? 0) <= 28)}
                />
              ) : null}

              {/* Joined mid-round: no question yet */}
              {hasStarted && currentRound.status === "active" && roomState.viewer.role === "player" && !playerQuestion ? (
                <p className="spectator-notice">You joined during this round. You&apos;ll get your own question in the next one.</p>
              ) : null}

              {/* Host live stats */}
              {currentRound.status === "active" && isHost ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <StatPill label="Answered" value={currentRound.answerStats.answeredPlayers} />
                    <StatPill label="Total" value={currentRound.answerStats.totalPlayers} accent="amber" />
                    <StatPill
                      label="Status"
                      value={
                        currentRound.answerStats.answeredPlayers === currentRound.answerStats.totalPlayers
                          ? "All in"
                          : "Waiting"
                      }
                      accent="forest"
                    />
                  </div>
                  <button
                    className={secondaryButtonClass}
                    onClick={() =>
                      startTransition(async () => { await runAction(`/api/rooms/${roomCode}/rounds/lock`); })
                    }
                    type="button"
                  >
                    Lock round now
                  </button>
                </div>
              ) : null}

              {/* Spectator */}
              {currentRound.status === "active" && roomState.viewer.role === "spectator" ? (
                <p className="spectator-notice">
                  Join the room as a player to receive your personalized question.
                </p>
              ) : null}

              {/* Locked state */}
              {currentRound.status === "locked" ? (
                <div className="space-y-4">
                  <p
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: 14,
                      border: "1.5px solid var(--ink-faint)",
                      backgroundColor: "color-mix(in oklch, var(--ink) 4%, transparent)",
                      fontSize: "0.9375rem",
                      color: "var(--ink-muted)",
                    }}
                  >
                    Answers locked.{" "}
                    {isHost
                      ? "Reveal the results when you're ready."
                      : "Waiting for the host to reveal the round."}
                  </p>
                  {isHost ? (
                    <button
                      className={primaryButtonClass}
                      onClick={() =>
                        startTransition(async () => { await runAction(`/api/rooms/${roomCode}/rounds/reveal`); })
                      }
                      type="button"
                    >
                      Reveal round
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ROUND REVEAL */}
          {roomState.revealedRound ? (
            <div className="surface space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">Round reveal</p>
                  <h2 className="section-title">
                    {roomState.revealedRound.categoryName} — round {roomState.revealedRound.roundNumber}
                  </h2>
                </div>

                {isHost &&
                  roomState.room.status !== "finished" &&
                  roomState.revealedRound.roundNumber < roomState.room.config.numberOfRounds ? (
                  <div className="flex flex-wrap gap-3">
                    {roomState.room.config.categoryMode === "host_selects_each_round" ? (
                      <select
                        className="form-input"
                        style={{ width: "auto" }}
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                      >
                        {roomState.categories.map((cat: Category) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      className={primaryButtonClass}
                      onClick={() =>
                        startTransition(async () => {
                          await runAction(`/api/rooms/${roomCode}/rounds/start`, {
                            categoryId:
                              roomState.room.config.categoryMode === "host_selects_each_round"
                                ? activeCategoryId
                                : undefined,
                          });
                        })
                      }
                      type="button"
                    >
                      Next round →
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {roomState.revealedRound.results.map((result) => (
                  <article
                    key={result.playerId}
                    className={`result-card ${result.isCorrect ? "correct" : "incorrect"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)" }}>
                          {result.displayName}
                        </p>
                        <h3
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: "1.0625rem",
                            color: "var(--ink)",
                            marginTop: "0.125rem",
                          }}
                        >
                          {result.questionTitle}
                        </h3>
                        <p style={{ fontSize: "0.875rem", color: "var(--ink-muted)", marginTop: "0.25rem" }}>
                          {result.questionPrompt}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.125rem",
                          padding: "0.5rem 0.875rem",
                          borderRadius: 12,
                          border: "1.5px solid var(--ink-faint)",
                          backgroundColor: "var(--card)",
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize: "1.125rem",
                          color: result.isCorrect ? "var(--forest)" : "var(--berry)",
                          minWidth: 70,
                          textAlign: "center",
                        }}
                      >
                        {result.pointsAwarded >= 0 ? "+" : ""}{result.pointsAwarded}
                        <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6 }}>pts</span>
                      </div>
                    </div>

                    <div className="grid gap-2 mt-3 sm:grid-cols-3">
                      {[
                        {
                          label: "Difficulty",
                          value: `${formatDifficulty(result.assignedDifficulty)} (${roomState.room.config.equalBasePoints ? 2 : basePointsByDifficulty[result.assignedDifficulty]} pts)`,
                          color: "var(--ink)",
                        },
                        {
                          label: "Result",
                          value: result.isCorrect ? "Correct ✓" : "Incorrect",
                          color: result.isCorrect ? "var(--forest)" : "var(--berry)",
                        },
                        {
                          label: "Correct answer",
                          value: result.correctAnswerText,
                          color: "var(--ink)",
                        },
                        {
                          label: "Bonuses",
                          value: [
                            result.fastestCorrect ? "Fastest +1" : null,
                            result.hintUsed ? "Hint used" : null,
                            result.confidenceMode === "bold" ? "Bold wager" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "None",
                          color: "var(--ink-muted)",
                        },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          style={{
                            padding: "0.625rem 0.875rem",
                            borderRadius: 10,
                            border: "1.5px solid var(--ink-faint)",
                            backgroundColor: "var(--card)",
                          }}
                        >
                          <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)" }}>
                            {label}
                          </p>
                          <p style={{ fontSize: "0.875rem", fontWeight: 600, color, marginTop: "0.125rem" }}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {result.explanation ? (
                      <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", marginTop: "0.75rem", lineHeight: 1.55 }}>
                        {result.explanation}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {/* GAME COMPLETE */}
          {roomState.room.status === "finished" ? (
            <div
              className="surface space-y-5"
              style={{ textAlign: "center", borderColor: "var(--warm)", borderWidth: 2, backgroundColor: "color-mix(in oklch, var(--warm) 10%, var(--card))" }}
            >
              <p className="section-eyebrow">Game complete</p>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
                  letterSpacing: "-0.02em",
                  color: "var(--ink)",
                }}
              >
                {roomState.finalWinner
                  ? `${roomState.finalWinner.displayName} wins! 🎉`
                  : "Quiz finished!"}
              </h2>
              <div className="flex flex-wrap justify-center gap-3">
                <Link className={primaryButtonClass} href="/host">Play again</Link>
                <button className={secondaryButtonClass} onClick={() => router.refresh()} type="button">
                  Refresh room
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Right: leaderboard + players ── */}
        <div className="space-y-5">
          {/* Late joiners can still scan in during play */}
          {isHost && roomState.room.status === "in_progress" ? (
            <div className="surface">
              <RoomInvite roomCode={roomCode} compact />
            </div>
          ) : null}

          {/* Leaderboard */}
          <div className="surface space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-eyebrow">Standings</p>
                <h2 className="section-title" style={{ fontSize: "1.25rem" }}>Leaderboard</h2>
              </div>
              {roomState.finalWinner ? (
                <span
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: 9999,
                    backgroundColor: "var(--warm)",
                    color: "var(--warm-deep)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "0.8125rem",
                    border: "2px solid var(--ink)",
                  }}
                >
                  🏆 {roomState.finalWinner.displayName}
                </span>
              ) : null}
            </div>

            <ol className="space-y-2">
              {deferredLeaderboard.map((entry) => {
                const isViewer = entry.playerId === roomState.viewer.playerId;
                return (
                  <li key={entry.playerId} className={`lb-row${isViewer ? " viewer" : ""}`}>
                    <span
                      className={classNames(
                        "rank-badge",
                        entry.rank === 1 ? "gold" : entry.rank === 2 ? "silver" : "",
                      )}
                    >
                      {entry.rank}
                    </span>
                    <span className={classNames("avatar avatar-sm", getAvatarClass(entry.avatarColor))}>
                      {entry.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "0.9375rem",
                          color: "var(--ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {entry.displayName}
                        {isViewer ? (
                          <span style={{ fontSize: "0.625rem", fontWeight: 800, marginLeft: "0.375rem", color: "var(--coral)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            You
                          </span>
                        ) : null}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                        {entry.ageBand.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: "1.125rem",
                        color: entry.rank === 1 ? "var(--warm-deep)" : "var(--ink)",
                      }}
                    >
                      {entry.totalPoints}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Players panel */}
          <div className="surface space-y-4">
            <p className="section-eyebrow">Players</p>
            <PlayersList players={roomState.players} leaderboard={roomState.leaderboard} viewerId={roomState.viewer.playerId} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Player question panel ────────────────────────────────── */

function PlayerQuestionPanel({
  playerQuestion,
  roomCode,
  runAction,
  wageringEnabled,
  hintsEnabled,
  timeExpired,
  equalBasePoints,
  compactAnswers,
}: {
  playerQuestion: NonNullable<RoomStateView["playerQuestion"]>;
  roomCode: string;
  runAction: (url: string, body?: unknown) => Promise<void>;
  wageringEnabled: boolean;
  hintsEnabled: boolean;
  timeExpired: boolean;
  equalBasePoints: boolean;
  compactAnswers: boolean;
}) {
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerKey | null>(
    playerQuestion.submittedAnswer ?? null,
  );
  const [confidenceMode, setConfidenceMode] = useState<"safe" | "bold">(
    (playerQuestion.confidenceMode as "safe" | "bold" | null) ?? "safe",
  );
  const hintRequested = playerQuestion.hintUsed;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUsingHint, setIsUsingHint] = useState(false);
  const [isFlaggingQuestion, setIsFlaggingQuestion] = useState(false);
  const [hasFlaggedQuestion, setHasFlaggedQuestion] = useState(false);
  const [flagMessage, setFlagMessage] = useState<string | null>(null);

  // Dropping two wrong options only leaves a fair 50/50 when there are four to start with.
  const canHint = hintsEnabled && Object.keys(playerQuestion.options).length === 4;
  const hiddenKeys = hintRequested ? playerQuestion.hintRemoves : [];
  const options = (Object.entries(playerQuestion.options) as Array<[AnswerKey, string]>).filter(
    ([k]) => !hiddenKeys.includes(k),
  );

  const submit = () =>
    startTransition(async () => {
      setIsSubmitting(true);
      try {
        await runAction(`/api/rooms/${roomCode}/answers`, {
          assignedQuestionId: playerQuestion.assignedQuestionId,
          answerKey: selectedAnswer,
          confidenceMode,
          useHint: hintRequested,
        });
      } finally { setIsSubmitting(false); }
    });

  // A chosen answer that was not locked in is sent when the clock reaches zero; the server's grace window covers the trip.
  const submitAtDeadline = useEffectEvent(() => {
    if (selectedAnswer && !playerQuestion.locked && !isSubmitting) submit();
  });
  useEffect(() => {
    if (timeExpired) submitAtDeadline();
  }, [timeExpired]);

  return (
    <div className="space-y-5">
      {/* Media */}
      {playerQuestion.mediaUrl && playerQuestion.modality === "image" ? (
        <Image
          alt={playerQuestion.mediaAltText ?? ""}
          className="w-full rounded-2xl"
          style={{ border: "1.5px solid var(--ink-faint)" }}
          height={480}
          src={playerQuestion.mediaUrl}
          unoptimized
          width={800}
        />
      ) : null}
      {playerQuestion.mediaUrl && playerQuestion.modality === "audio" ? (
        <audio className="w-full" controls preload="metadata" src={playerQuestion.mediaUrl}>
          Your browser does not support audio playback.
        </audio>
      ) : null}

      {/* Question text */}
      <div>
        <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
          Difficulty:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {formatDifficulty(playerQuestion.assignedDifficulty)}
          </strong>
          {" · "}Worth{" "}
          <strong style={{ color: "var(--ink)" }}>
            {equalBasePoints ? 2 : basePointsByDifficulty[playerQuestion.assignedDifficulty]} pts
          </strong>
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
          {playerQuestion.prompt}
        </h3>
      </div>

      {/* Answer tiles */}
      <div className={compactAnswers ? "grid grid-cols-2 gap-3" : "grid gap-3 sm:grid-cols-2"}>
        {options.map(([key, value]) => (
          <button
            key={key}
            className={classNames("answer-tile", selectedAnswer === key ? "selected" : "")}
            disabled={playerQuestion.locked || timeExpired || isSubmitting}
            onClick={() => setSelectedAnswer(key)}
            type="button"
          >
            <span className="answer-tile-key">{key.toUpperCase()}</span>
            <span className="min-w-0 break-words">{value}</span>
          </button>
        ))}
      </div>

      {/* Wagering + hint */}
      <div className="flex flex-wrap gap-3">
        {wageringEnabled ? (
          <button
            className={confidenceMode === "bold" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            disabled={playerQuestion.locked || timeExpired || isSubmitting}
            onClick={() => setConfidenceMode(confidenceMode === "safe" ? "bold" : "safe")}
            type="button"
          >
            Confidence: {confidenceMode === "bold" ? "Bold ⚡" : "Safe"}
          </button>
        ) : null}

        {canHint ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={playerQuestion.locked || timeExpired || hintRequested || isUsingHint || playerQuestion.hintsRemaining <= 0}
            onClick={async () => {
              setIsUsingHint(true);
              setSelectedAnswer(null);
              try { await runAction(`/api/rooms/${roomCode}/hints`, { assignedQuestionId: playerQuestion.assignedQuestionId }); }
              finally { setIsUsingHint(false); }
            }}
            type="button"
          >
            {hintRequested
              ? "Hint applied"
              : playerQuestion.hintsRemaining > 0
                ? "Use 50/50 hint"
                : "No hints left"}
          </button>
        ) : null}
      </div>

      {/* Submit */}
      <button
        className={primaryButtonClass}
        disabled={!selectedAnswer || playerQuestion.locked || timeExpired || isSubmitting || isUsingHint}
        onClick={submit}
        type="button"
      >
        {playerQuestion.locked ? "Answer locked ✓" : isSubmitting ? "Sending answer..." : timeExpired ? "Time's up - confirming answers" : "Lock in answer"}
      </button>

      <button
        className={secondaryButtonClass}
        disabled={isFlaggingQuestion || hasFlaggedQuestion}
        onClick={() =>
          startTransition(async () => {
            setFlagMessage(null);
            setIsFlaggingQuestion(true);

            try {
              const response = await fetch(`/api/rooms/${roomCode}/flags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  assignedQuestionId: playerQuestion.assignedQuestionId,
                }),
              });
              const payload = (await response.json()) as { alreadyFlagged?: boolean; error?: string };

              if (!response.ok) {
                setFlagMessage(payload.error ?? "Couldn't flag that question.");
                return;
              }

              setHasFlaggedQuestion(true);
              setFlagMessage(
                payload.alreadyFlagged
                  ? "You already flagged this question."
                  : "Thanks. We logged this question for review.",
              );
            } finally {
              setIsFlaggingQuestion(false);
            }
          })
        }
        type="button"
      >
        {hasFlaggedQuestion
          ? "Flagged for review"
          : isFlaggingQuestion
            ? "Flagging..."
            : "Flag as incorrect"}
      </button>

      {flagMessage ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
          {flagMessage}
        </p>
      ) : null}
    </div>
  );
}

/* ── Players list ─────────────────────────────────────────── */

function PlayersList({
  players,
  leaderboard,
  viewerId,
}: {
  players: RoomStateView["players"];
  leaderboard: RoomStateView["leaderboard"];
  viewerId?: string | null;
}) {
  return (
    <ul className="space-y-2">
      {players.map((player) => {
        const rank = leaderboard.find((e) => e.playerId === player.id)?.rank ?? null;
        const isViewer = player.id === viewerId;
        return (
          <li key={player.id} className={`lb-row${isViewer ? " viewer" : ""}`}>
            <span className={classNames("avatar avatar-sm", getAvatarClass(player.avatarColor))}>
              {player.displayName.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {player.displayName}
                {isViewer ? (
                  <span style={{ fontSize: "0.625rem", fontWeight: 800, marginLeft: "0.375rem", color: "var(--coral)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    You
                  </span>
                ) : null}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                {player.ageBand.replaceAll("_", " ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={player.isConnected ? "badge-online" : "badge-offline"}>
                {player.isConnected ? "Online" : "Away"}
              </span>
              {rank ? (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--ink-muted)",
                  }}
                >
                  #{rank}
                </span>
              ) : null}
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "0.9375rem",
                  color: "var(--ink)",
                }}
              >
                {player.totalPoints}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
