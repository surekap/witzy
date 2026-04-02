"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import {
  cardClass,
  primaryButtonClass,
  secondaryButtonClass,
  StatPill,
  Surface,
} from "@/components/ui";
import { classNames } from "@/lib/utils/classnames";
import type { AnswerKey, Category, RoomStateView } from "@/types/game";

function getTimerText(endsAt: string | null, now: number) {
  if (!endsAt) {
    return "Waiting";
  }

  const diff = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  return `${diff}s`;
}

function getAvatarClass(color: string) {
  switch (color) {
    case "amber":
      return "bg-amber-400";
    case "rose":
      return "bg-rose-400";
    case "lime":
      return "bg-lime-400";
    case "violet":
      return "bg-violet-400";
    case "sky":
      return "bg-sky-400";
    default:
      return "bg-cyan-400";
  }
}

export function RoomPageClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [roomState, setRoomState] = useState<RoomStateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [now, setNow] = useState(0);

  const deferredLeaderboard = useDeferredValue(roomState?.leaderboard ?? []);

  const refreshState = useEffectEvent(async () => {
    const response = await fetch(`/api/rooms/${roomCode}`, {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Couldn't load this room.");
      return;
    }

    setRoomState(payload);
    setError(null);
  });

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    const pollInterval = roomState?.currentRound?.status === "active" ? 900 : 1500;
    const interval = window.setInterval(() => {
      void refreshState();
    }, pollInterval);

    return () => window.clearInterval(interval);
  }, [roomState?.currentRound?.status]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  const runAction = async (url: string, body?: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

  if (error && !roomState) {
    return (
      <Surface className="space-y-4">
        <p className="text-sm uppercase tracking-[0.28em] text-rose-200/80">Room error</p>
        <h2 className="text-3xl font-black text-white">{error}</h2>
        <div className="flex gap-3">
          <Link className={secondaryButtonClass} href="/join">
            Join a room
          </Link>
          <Link className={primaryButtonClass} href="/host">
            Host a game
          </Link>
        </div>
      </Surface>
    );
  }

  if (!roomState) {
    return (
      <Surface>
        <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Loading room</p>
        <h2 className="text-3xl font-black text-white">Syncing the latest quiz state...</h2>
      </Surface>
    );
  }

  const isHost = roomState.viewer.role === "host";
  const currentRound = roomState.currentRound;
  const playerQuestion = roomState.playerQuestion;
  const activeCategoryId = selectedCategoryId || roomState.categories[0]?.id || "";

  return (
    <div className="space-y-6">
      <Surface className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">
              Room {roomState.room.roomCode} · {roomState.viewer.role}
            </p>
            <h1 className="text-3xl font-black text-white">
              {roomState.room.status === "lobby"
                ? "Players are joining the lobby"
                : roomState.room.status === "finished"
                  ? "Final scores are in"
                  : "Live family quiz in progress"}
            </h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Host: {roomState.room.hostName}. Share this join link with players:{" "}
              <span className="font-semibold text-cyan-200">{roomState.room.joinUrl}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatPill label="Round" value={`${roomState.room.currentRoundNumber}/${roomState.room.config.numberOfRounds}`} />
            <StatPill label="Timer" value={`${roomState.room.config.answerTimeLimitSeconds}s`} accent="cyan" />
            <StatPill label="Mode" value={roomState.room.config.categoryMode === "host_selects_each_round" ? "Host pick" : "Random"} accent="lime" />
          </div>
        </div>

        {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      </Surface>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          {roomState.room.status === "lobby" ? (
            <Surface className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Lobby</p>
                  <h2 className="text-2xl font-black text-white">Everyone assembles here before the first round</h2>
                </div>
                {isHost ? (
                  <button
                    className={primaryButtonClass}
                    onClick={() =>
                      startTransition(async () => {
                        await runAction(`/api/rooms/${roomCode}/start`);
                      })
                    }
                    type="button"
                  >
                    Start game
                  </button>
                ) : (
                  <p className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                    Waiting for the host to begin
                  </p>
                )}
              </div>

              <PlayersList players={roomState.players} leaderboard={roomState.leaderboard} />
            </Surface>
          ) : null}

          {roomState.room.status === "in_progress" && !currentRound ? (
            <Surface className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Round Launcher</p>
                  <h2 className="text-2xl font-black text-white">The game is live and ready for round one</h2>
                  <p className="text-sm text-slate-300">
                    {isHost
                      ? "Pick a category if you're guiding each round, then launch the first synchronized question set."
                      : "The host is choosing the opening category now."}
                  </p>
                </div>
                {isHost ? (
                  <div className="flex flex-wrap gap-3">
                    {roomState.room.config.categoryMode === "host_selects_each_round" ? (
                      <select
                        className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
                        value={activeCategoryId}
                        onChange={(event) => setSelectedCategoryId(event.target.value)}
                      >
                        {roomState.categories.map((category: Category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
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
                      Start next round
                    </button>
                  </div>
                ) : (
                  <p className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                    Waiting for round one
                  </p>
                )}
              </div>
            </Surface>
          ) : null}

          {currentRound && roomState.room.status !== "lobby" ? (
            <Surface className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">
                    {currentRound.categoryName} · Round {currentRound.roundNumber}
                  </p>
                  <h2 className="text-2xl font-black text-white">
                    {currentRound.status === "active"
                      ? "Questions are live"
                      : currentRound.status === "locked"
                        ? "Answers locked"
                        : "Round reveal"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-lg font-black text-white">
                  {getTimerText(currentRound.endsAt, now)}
                </div>
              </div>

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

              {currentRound.status === "active" && isHost ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatPill label="Answered" value={currentRound.answerStats.answeredPlayers} />
                    <StatPill label="Players" value={currentRound.answerStats.totalPlayers} accent="cyan" />
                    <StatPill label="Next reveal" value={currentRound.answerStats.answeredPlayers === currentRound.answerStats.totalPlayers ? "Ready" : "Waiting"} accent="lime" />
                  </div>
                  <button
                    className={secondaryButtonClass}
                    onClick={() =>
                      startTransition(async () => {
                        await runAction(`/api/rooms/${roomCode}/rounds/lock`);
                      })
                    }
                    type="button"
                  >
                    Lock round now
                  </button>
                </div>
              ) : null}

              {currentRound.status === "active" && roomState.viewer.role === "spectator" ? (
                <p className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-slate-200">
                  Join the room as a player to receive your personalized question.
                </p>
              ) : null}

              {currentRound.status === "locked" ? (
                <div className="space-y-4">
                  <p className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-slate-200">
                    Answers are locked. {isHost ? "Reveal the results when you're ready." : "Waiting for the host to reveal the round."}
                  </p>
                  {isHost ? (
                    <button
                      className={primaryButtonClass}
                      onClick={() =>
                        startTransition(async () => {
                          await runAction(`/api/rooms/${roomCode}/rounds/reveal`);
                        })
                      }
                      type="button"
                    >
                      Reveal round
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Surface>
          ) : null}

          {roomState.revealedRound ? (
            <Surface className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Round Reveal</p>
                  <h2 className="text-2xl font-black text-white">
                    {roomState.revealedRound.categoryName} results for round {roomState.revealedRound.roundNumber}
                  </h2>
                </div>
                {isHost &&
                roomState.room.status !== "finished" &&
                roomState.revealedRound.roundNumber < roomState.room.config.numberOfRounds ? (
                  <div className="flex flex-wrap gap-3">
                    {roomState.room.config.categoryMode === "host_selects_each_round" ? (
                      <select
                        className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-3 text-white"
                        value={selectedCategoryId}
                        onChange={(event) => setSelectedCategoryId(event.target.value)}
                      >
                        {roomState.categories.map((category: Category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
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
                      Start next round
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                {roomState.revealedRound.results.map((result) => (
                  <article key={result.playerId} className={cardClass}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-white/50">{result.displayName}</p>
                        <h3 className="text-xl font-black text-white">{result.questionTitle}</h3>
                        <p className="text-sm text-slate-300">{result.questionPrompt}</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
                        {result.pointsAwarded >= 0 ? "+" : ""}
                        {result.pointsAwarded} pts
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                        Result:{" "}
                        <span className={result.isCorrect ? "font-semibold text-lime-200" : "font-semibold text-rose-200"}>
                          {result.isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </p>
                      <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                        Correct answer: <span className="font-semibold text-cyan-200">{result.correctAnswerText}</span>
                      </p>
                      <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                        Bonuses:{" "}
                        <span className="font-semibold text-white">
                          {result.fastestCorrect ? "Fastest +1" : "No speed bonus"}
                          {result.hintUsed ? " · Hint used" : ""}
                          {result.confidenceMode === "bold" ? " · Bold wager" : ""}
                        </span>
                      </p>
                    </div>
                    <p className="mt-4 text-sm text-slate-300">{result.explanation}</p>
                  </article>
                ))}
              </div>
            </Surface>
          ) : null}
        </div>

        <div className="space-y-6">
          <Surface className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Leaderboard</p>
                <h2 className="text-2xl font-black text-white">Public standings</h2>
              </div>
              {roomState.finalWinner ? (
                <div className="rounded-full bg-lime-300 px-4 py-2 text-sm font-black text-slate-950">
                  Winner: {roomState.finalWinner.displayName}
                </div>
              ) : null}
            </div>

            <ol className="space-y-3">
              {deferredLeaderboard.map((entry) => (
                <li
                  key={entry.playerId}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={classNames("h-10 w-10 rounded-full", getAvatarClass(entry.avatarColor))} />
                    <div>
                      <p className="font-semibold text-white">
                        #{entry.rank} {entry.displayName}
                      </p>
                      <p className="text-sm text-slate-400">{entry.ageBand.replaceAll("_", " ")}</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-cyan-200">{entry.totalPoints}</span>
                </li>
              ))}
            </ol>
          </Surface>

          <Surface className="space-y-4">
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Players</p>
            <PlayersList players={roomState.players} leaderboard={roomState.leaderboard} />
          </Surface>

          {roomState.room.status === "finished" ? (
            <Surface className="space-y-4 text-center">
              <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Game Complete</p>
              <h2 className="text-3xl font-black text-white">
                {roomState.finalWinner ? `${roomState.finalWinner.displayName} wins the quiz` : "Quiz finished"}
              </h2>
              <div className="flex flex-wrap justify-center gap-3">
                <Link className={primaryButtonClass} href="/host">
                  Play again
                </Link>
                <button className={secondaryButtonClass} onClick={() => router.refresh()} type="button">
                  Refresh room
                </button>
              </div>
            </Surface>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerKey | null>(playerQuestion.submittedAnswer ?? null);
  const [confidenceMode, setConfidenceMode] = useState<"safe" | "bold">(
    (playerQuestion.confidenceMode as "safe" | "bold" | null) ?? "safe",
  );
  const [hintRequested, setHintRequested] = useState(playerQuestion.hintUsed);

  const hiddenHintOptions = hintRequested ? playerQuestion.hintRemoves : [];
  const playerQuestionOptions = (Object.entries(playerQuestion.options) as Array<[AnswerKey, string]>).filter(
    ([key]) => !hiddenHintOptions.includes(key),
  );

  return (
    <div className="space-y-5">
      {playerQuestion.mediaUrl && playerQuestion.modality === "image" ? (
        <Image
          alt={playerQuestion.mediaAltText ?? ""}
          className="w-full rounded-[24px] border border-white/10 bg-white/5"
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
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-white/50">{playerQuestion.title}</p>
        <h3 className="text-2xl font-black text-white">{playerQuestion.prompt}</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {playerQuestionOptions.map(([key, value]) => (
          <button
            key={key}
            className={classNames(
              "rounded-[24px] border px-4 py-4 text-left text-base font-semibold transition",
              selectedAnswer === key
                ? "border-orange-300/50 bg-orange-300/10 text-white"
                : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-300/10",
            )}
            disabled={playerQuestion.locked}
            onClick={() => setSelectedAnswer(key)}
            type="button"
          >
            <span className="mr-2 text-sm uppercase tracking-[0.2em] text-white/50">{key}</span>
            {value}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {wageringEnabled ? (
          <button
            className={confidenceMode === "bold" ? primaryButtonClass : secondaryButtonClass}
            disabled={playerQuestion.locked}
            onClick={() => setConfidenceMode(confidenceMode === "safe" ? "bold" : "safe")}
            type="button"
          >
            Confidence: {confidenceMode}
          </button>
        ) : null}

        {hintsEnabled ? (
          <button
            className={secondaryButtonClass}
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

      <div className="flex flex-wrap gap-3">
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
          {playerQuestion.locked ? "Answer locked" : "Lock in answer"}
        </button>
      </div>
    </div>
  );
}

function PlayersList({
  players,
  leaderboard,
}: {
  players: RoomStateView["players"];
  leaderboard: RoomStateView["leaderboard"];
}) {
  return (
    <ul className="grid gap-3">
      {players.map((player) => {
        const rank = leaderboard.find((entry) => entry.playerId === player.id)?.rank ?? null;
        return (
          <li
            key={player.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className={classNames("h-10 w-10 rounded-full", getAvatarClass(player.avatarColor))} />
              <div>
                <p className="font-semibold text-white">{player.displayName}</p>
                <p className="text-sm text-slate-400">{player.ageBand.replaceAll("_", " ")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
              <span
                className={`rounded-full px-3 py-1 ${
                  player.isConnected ? "bg-lime-300/20 text-lime-100" : "bg-slate-700 text-slate-300"
                }`}
              >
                {player.isConnected ? "Connected" : "Away"}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1">Score {player.totalPoints}</span>
              {rank ? <span className="rounded-full bg-white/5 px-3 py-1">Rank #{rank}</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
