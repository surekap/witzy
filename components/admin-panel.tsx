"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import { primaryButtonClass, secondaryButtonClass, StatPill } from "@/components/ui";
import type { AdminDashboardData, AdminQuestionCatalogEntry, AdminUploadMode } from "@/types/admin";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

export function AdminPanel({
  initiallySignedIn,
  isConfigured,
}: {
  initiallySignedIn: boolean;
  isConfigured: boolean;
}) {
  const [signedIn, setSignedIn] = useState(initiallySignedIn);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [uploadMode, setUploadMode] = useState<AdminUploadMode>("append");
  const [uploadText, setUploadText] = useState("");
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [questionSearch, setQuestionSearch] = useState("");
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        setDashboardError(payload.error ?? "Couldn't load admin dashboard.");
        if (response.status === 401) {
          setSignedIn(false);
        }
        return;
      }

      setDashboard(payload);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    void fetchDashboard();
  }, [signedIn]);

  const filteredQuestions = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const query = questionSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.questions.slice(0, 120);
    }

    return dashboard.questions
      .filter((question) => {
        const haystack = [
          question.id,
          question.title,
          question.prompt,
          question.categoryName,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 120);
  }, [dashboard, questionSearch]);

  const submitLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setAuthError(payload.error ?? "Invalid admin credentials.");
        return;
      }

      setSignedIn(true);
      setPassword("");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setSignedIn(false);
    setDashboard(null);
    setUploadFeedback(null);
  };

  const uploadQuestions = async () => {
    if (!uploadText.trim()) {
      setUploadFeedback("Paste a JSON payload before uploading.");
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(uploadText);
    } catch {
      setUploadFeedback("JSON could not be parsed. Please fix formatting and try again.");
      return;
    }

    setUploadLoading(true);
    setUploadFeedback(null);

    try {
      const response = await fetch("/api/admin/questions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: uploadMode, payload }),
      });
      const data = await response.json();

      if (!response.ok) {
        setUploadFeedback(data.error ?? "Upload failed.");
        return;
      }

      setUploadFeedback(
        uploadMode === "replace"
          ? `Replaced bank: ${data.categoryCount} categories, ${data.questionCount} questions.`
          : `Appended. Bank now has ${data.categoryCount} categories and ${data.questionCount} questions. Added ${data.questionsAdded ?? 0} questions.`,
      );
      await fetchDashboard();
    } finally {
      setUploadLoading(false);
    }
  };

  const removeQuestion = async (question: AdminQuestionCatalogEntry) => {
    const confirmed = window.confirm(`Remove this question?\n\n${question.title}\n(${question.id})`);
    if (!confirmed) {
      return;
    }

    setRemoveLoadingId(question.id);
    try {
      const response = await fetch("/api/admin/questions/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [question.id] }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setDashboardError(payload.error ?? "Couldn't remove question.");
        return;
      }

      setUploadFeedback(`Removed ${payload.removedCount} question. Remaining: ${payload.remainingQuestionCount}.`);
      await fetchDashboard();
    } finally {
      setRemoveLoadingId(null);
    }
  };

  const loadUploadFile = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadText(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsText(file);
  };

  if (!isConfigured) {
    return (
      <section className="surface space-y-3">
        <h1 className="section-title">Admin Panel</h1>
        <p className="alert-error">
          Admin panel is not configured. Set `ADMIN_PANEL_PASSWORD` in your environment and reload.
        </p>
        <Link className={secondaryButtonClass} href="/">
          Back to home
        </Link>
      </section>
    );
  }

  if (!signedIn) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="section-title" style={{ fontSize: "1.5rem" }}>
            Admin Panel
          </h1>
          <Link className={secondaryButtonClass} href="/">
            Back
          </Link>
        </header>

        <section className="surface space-y-4">
          <p className="section-eyebrow">Secure access</p>
          <label className="block">
            <span className="field-label">Admin password</span>
            <input
              className="form-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Enter admin password"
            />
          </label>
          <button
            className={primaryButtonClass}
            type="button"
            disabled={authLoading || password.length === 0}
            onClick={() => startTransition(() => void submitLogin())}
          >
            {authLoading ? "Signing in..." : "Sign in"}
          </button>
          {authError ? <p className="alert-error">{authError}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-eyebrow">Administration</p>
          <h1 className="section-title" style={{ fontSize: "1.5rem" }}>
            Question and player analytics
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
            Last refreshed: {dashboard ? formatDate(dashboard.generatedAt) : "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={secondaryButtonClass} type="button" onClick={() => void fetchDashboard()}>
            Refresh
          </button>
          <button className={secondaryButtonClass} type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      {dashboardLoading ? <p>Loading dashboard...</p> : null}
      {dashboardError ? <p className="alert-error">{dashboardError}</p> : null}

      {dashboard ? (
        <>
          <section className="surface space-y-4">
            <p className="section-eyebrow">Question bank health</p>
            <div className="flex flex-wrap gap-3">
              <StatPill accent="coral" label="Categories" value={dashboard.questionFrequency.categoryCount} />
              <StatPill accent="amber" label="Questions" value={dashboard.questionFrequency.questionCount} />
              <StatPill accent="forest" label="Missing combos" value={dashboard.questionFrequency.missing.length} />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Age band</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Category</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Slug</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.questionFrequency.rows.map((row) => (
                    <tr key={`${row.ageBand}:${row.categoryId}`}>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{row.ageBand}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{row.categoryName}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{row.categorySlug}</td>
                      <td
                        style={{
                          padding: "0.5rem",
                          borderBottom: "1px solid var(--ink-faint)",
                          textAlign: "right",
                          color: row.count === 0 ? "var(--berry)" : "var(--ink)",
                          fontWeight: row.count === 0 ? 700 : 500,
                        }}
                      >
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface space-y-4">
            <p className="section-eyebrow">Upload questions</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Upload mode</span>
                <select
                  className="form-input"
                  value={uploadMode}
                  onChange={(event) => setUploadMode(event.target.value as AdminUploadMode)}
                >
                  <option value="append">Append</option>
                  <option value="replace">Replace entire bank</option>
                </select>
              </label>
              <label className="block">
                <span className="field-label">Load from file</span>
                <input
                  className="form-input"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => loadUploadFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Question bank JSON</span>
              <textarea
                className="form-input"
                rows={10}
                value={uploadText}
                onChange={(event) => setUploadText(event.target.value)}
                placeholder='Paste {"categories":[...],"questions":[...]}'
              />
            </label>
            <button
              className={primaryButtonClass}
              type="button"
              disabled={uploadLoading}
              onClick={() => startTransition(() => void uploadQuestions())}
            >
              {uploadLoading ? "Uploading..." : "Upload questions"}
            </button>
            {uploadFeedback ? <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{uploadFeedback}</p> : null}
          </section>

          <section className="surface space-y-4">
            <p className="section-eyebrow">Flagged questions</p>
            {dashboard.flaggedQuestions.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>No flagged questions yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Question</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Flags</th>
                      <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Last flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.flaggedQuestions.slice(0, 25).map((flagged) => (
                      <tr key={flagged.questionId}>
                        <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                          <p style={{ fontWeight: 700 }}>{flagged.questionTitle}</p>
                          <p style={{ color: "var(--ink-muted)" }}>{flagged.questionPrompt}</p>
                        </td>
                        <td style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                          {flagged.distinctReporterCount}
                        </td>
                        <td style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                          {formatDate(flagged.latestReportedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface space-y-4">
            <p className="section-eyebrow">Remove questions</p>
            <label className="block">
              <span className="field-label">Search question catalog</span>
              <input
                className="form-input"
                value={questionSearch}
                onChange={(event) => setQuestionSearch(event.target.value)}
                placeholder="Search by id, title, prompt, category"
              />
            </label>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
              Showing {filteredQuestions.length} questions (max 120 rows).
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Question</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Category</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Difficulty</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Age range</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((question) => (
                    <tr key={question.id}>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                        <p style={{ fontWeight: 700 }}>{question.title}</p>
                        <p style={{ color: "var(--ink-muted)" }}>{question.id}</p>
                      </td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{question.categoryName}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)", textTransform: "capitalize" }}>{question.difficulty}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                        {question.ageBandMin} → {question.ageBandMax}
                      </td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)", textAlign: "right" }}>
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          disabled={removeLoadingId === question.id}
                          onClick={() => startTransition(() => void removeQuestion(question))}
                        >
                          {removeLoadingId === question.id ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface space-y-4">
            <p className="section-eyebrow">Available question matrix</p>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
              Rows are players. Columns are categories. Each cell shows unseen / eligible questions for that player.
            </p>
            {dashboard.playerQuestionAvailability.rows.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
                No room players yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                        Player
                      </th>
                      <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                        Age band
                      </th>
                      {dashboard.playerQuestionAvailability.categories.map((category) => (
                        <th
                          key={category.id}
                          style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)", minWidth: 140 }}
                        >
                          {category.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.playerQuestionAvailability.rows.map((row) => (
                      <tr key={row.playerKey}>
                        <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)", fontWeight: 700 }}>
                          {row.displayName}
                        </td>
                        <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)", color: "var(--ink-muted)" }}>
                          {row.ageBand}
                        </td>
                        {row.cells.map((cell) => (
                          <td
                            key={`${row.playerKey}:${cell.categoryId}`}
                            style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)", textAlign: "right", verticalAlign: "top" }}
                          >
                            <p style={{ fontWeight: 700, color: cell.unseenCount === 0 ? "var(--berry)" : "var(--forest)" }}>
                              {cell.unseenCount} / {cell.eligibleCount}
                            </p>
                            {cell.unseenQuestionIds.length > 0 ? (
                              <details>
                                <summary style={{ cursor: "pointer", color: "var(--ink-muted)", fontSize: "0.72rem" }}>
                                  IDs
                                </summary>
                                <p style={{ marginTop: "0.25rem", color: "var(--ink-muted)", textAlign: "left", whiteSpace: "normal" }}>
                                  {cell.unseenQuestionIds.join(", ")}
                                </p>
                              </details>
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface space-y-4">
            <p className="section-eyebrow">Player performance over time</p>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
              Trend delta = last 10 accuracy minus first 10 accuracy.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Player</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Source</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Answered</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Accuracy</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>First 10</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Last 10</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Trend</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.playerPerformance.players.slice(0, 200).map((player) => (
                    <tr key={player.playerKey}>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>
                        <p style={{ fontWeight: 700 }}>{player.displayName}</p>
                        <p style={{ color: "var(--ink-muted)" }}>{player.ageBand ?? "—"}</p>
                      </td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{player.source}</td>
                      <td style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{player.totalAnswered}</td>
                      <td style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{formatPercent(player.accuracyRate)}</td>
                      <td style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{formatPercent(player.firstTenAccuracyRate)}</td>
                      <td style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{formatPercent(player.lastTenAccuracyRate)}</td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "0.5rem",
                          borderBottom: "1px solid var(--ink-faint)",
                          color: player.trendDelta >= 0 ? "var(--forest)" : "var(--berry)",
                          fontWeight: 700,
                        }}
                      >
                        {player.trendDelta >= 0 ? "+" : ""}
                        {Math.round(player.trendDelta * 100)}%
                      </td>
                      <td style={{ textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--ink-faint)" }}>{formatDate(player.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
