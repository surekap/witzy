"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { primaryButtonClass, secondaryButtonClass, StatPill } from "@/components/ui";
import { classNames } from "@/lib/utils/classnames";
import type { AnswerKey, Category, RoomStateView } from "@/types/game";

/* ── Helpers ──────────────────────────────────────────────── */

function getSecondsLeft(endsAt: string | null, now: number): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
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

function TimerPill({ endsAt, now }: { endsAt: string | null; now: number }) {
  const secs = getSecondsLeft(endsAt, now);
  if (secs === null) {
    return (
      <div className="timer-pill ok" style={{ fontSize: "0.875rem" }}>
        Waiting
      </div>
    );
  }
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
  const [now, setNow] = useState(0);

  const deferredLeaderboard = useDeferredValue(roomState?.leaderboard ?? []);

  const refreshState = useEffectEvent(async () => {
    const response = await fetch(`/api/rooms/${roomCode}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Couldn't load this room.");
      return;
    }
    setRoomState(payload);
    setError(null);
  });

  useEffect(() => { void refreshState(); }, []);

  useEffect(() => {
    const pollMs = roomState?.currentRound?.status === "active" ? 900 : 1500;
    const id = window.setInterval(() => void refreshState(), pollMs);
    return () => window.clearInterval(id);
  }, [roomState?.currentRound?.status]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const runAction = async (url: string, body?: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "That action didn't work.");
      return;
    }
    setRoomState(payload);
    setError(null);
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
              value={`${roomState.room.config.answerTimeLimitSeconds}s`}
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
          {" · "}Join at{" "}
          <span style={{ fontWeight: 600, color: "var(--coral)" }}>{roomState.room.joinUrl}</span>
        </p>

        {error ? <p className="alert-error">{error}</p> : null}
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
                <TimerPill endsAt={currentRound.endsAt} now={now} />
              </div>

              {/* Player question */}
              {currentRound.status === "active" && playerQuestion && roomState.viewer.role === "player" ? (
                <PlayerQuestionPanel
                  key={playerQuestion.assignedQuestionId}
                  playerQuestion={playerQuestion}
                  roomCode={roomCode}
                  runAction={runAction}
                  wageringEnabled={roomState.room.config.confidenceWager}
                  hintsEnabled={roomState.room.config.hints}
                />
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
}: {
  playerQuestion: NonNullable<RoomStateView["playerQuestion"]>;
  roomCode: string;
  runAction: (url: string, body?: unknown) => Promise<void>;
  wageringEnabled: boolean;
  hintsEnabled: boolean;
}) {
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerKey | null>(
    playerQuestion.submittedAnswer ?? null,
  );
  const [confidenceMode, setConfidenceMode] = useState<"safe" | "bold">(
    (playerQuestion.confidenceMode as "safe" | "bold" | null) ?? "safe",
  );
  const [hintRequested, setHintRequested] = useState(playerQuestion.hintUsed);

  const hiddenKeys = hintRequested ? playerQuestion.hintRemoves : [];
  const options = (Object.entries(playerQuestion.options) as Array<[AnswerKey, string]>).filter(
    ([k]) => !hiddenKeys.includes(k),
  );

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
        <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-muted)" }}>
          {playerQuestion.title}
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
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(([key, value]) => (
          <button
            key={key}
            className={classNames("answer-tile", selectedAnswer === key ? "selected" : "")}
            disabled={playerQuestion.locked}
            onClick={() => setSelectedAnswer(key)}
            type="button"
          >
            <span className="answer-tile-key">{key.toUpperCase()}</span>
            <span>{value}</span>
          </button>
        ))}
      </div>

      {/* Wagering + hint */}
      <div className="flex flex-wrap gap-3">
        {wageringEnabled ? (
          <button
            className={confidenceMode === "bold" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            disabled={playerQuestion.locked}
            onClick={() => setConfidenceMode(confidenceMode === "safe" ? "bold" : "safe")}
            type="button"
          >
            Confidence: {confidenceMode === "bold" ? "Bold ⚡" : "Safe"}
          </button>
        ) : null}

        {hintsEnabled ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={playerQuestion.locked || hintRequested || playerQuestion.hintsRemaining <= 0}
            onClick={() => setHintRequested(true)}
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
        disabled={!selectedAnswer || playerQuestion.locked}
        onClick={() =>
          startTransition(async () => {
            await runAction(`/api/rooms/${roomCode}/answers`, {
              assignedQuestionId: playerQuestion.assignedQuestionId,
              answerKey: selectedAnswer,
              confidenceMode,
              useHint: hintRequested,
            });
          })
        }
        type="button"
      >
        {playerQuestion.locked ? "Answer locked ✓" : "Lock in answer"}
      </button>
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
