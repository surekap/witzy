import type { AgeBand, QuestionDifficulty } from "@/types/game";

export type AdminUploadMode = "append" | "replace";

export interface AdminQuestionFrequencyRow {
  ageBand: AgeBand;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  count: number;
}

export interface AdminQuestionFrequencyDistribution {
  categoryCount: number;
  questionCount: number;
  rows: AdminQuestionFrequencyRow[];
  missing: AdminQuestionFrequencyRow[];
}

export interface AdminQuestionCatalogEntry {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  prompt: string;
  difficulty: QuestionDifficulty;
  ageBandMin: AgeBand;
  ageBandMax: AgeBand;
  active: boolean;
  distinctFlagCount: number;
  latestFlaggedAt: string | null;
}

export interface AdminPlayerTimelinePoint {
  date: string;
  answeredCount: number;
  correctCount: number;
  accuracyRate: number;
  cumulativeAccuracyRate: number;
}

export interface AdminPlayerPerformanceEntry {
  playerKey: string;
  source: "practice_account" | "room_player";
  displayName: string;
  ageBand: AgeBand | null;
  totalAnswered: number;
  totalCorrect: number;
  accuracyRate: number;
  firstTenAccuracyRate: number;
  lastTenAccuracyRate: number;
  trendDelta: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  timeline: AdminPlayerTimelinePoint[];
}

export interface AdminPlayerPerformanceSummary {
  generatedAt: string;
  players: AdminPlayerPerformanceEntry[];
}

export interface AdminPlayerQuestionAvailabilityCategory {
  id: string;
  name: string;
  slug: string;
}

export interface AdminPlayerQuestionAvailabilityCell {
  categoryId: string;
  unseenCount: number;
  seenCount: number;
  eligibleCount: number;
  unseenQuestionIds: string[];
}

export interface AdminPlayerQuestionAvailabilityRow {
  playerKey: string;
  displayName: string;
  ageBand: AgeBand;
  cells: AdminPlayerQuestionAvailabilityCell[];
}

export interface AdminPlayerQuestionAvailabilityMatrix {
  generatedAt: string;
  categories: AdminPlayerQuestionAvailabilityCategory[];
  rows: AdminPlayerQuestionAvailabilityRow[];
}

export interface AdminDashboardData {
  generatedAt: string;
  questionFrequency: AdminQuestionFrequencyDistribution;
  questions: AdminQuestionCatalogEntry[];
  flaggedQuestions: Array<{
    questionId: string;
    questionTitle: string;
    questionPrompt: string;
    distinctReporterCount: number;
    practiceAccountFlagCount: number;
    roomPlayerFlagCount: number;
    latestReportedAt: string;
  }>;
  playerPerformance: AdminPlayerPerformanceSummary;
  playerQuestionAvailability: AdminPlayerQuestionAvailabilityMatrix;
}

export interface AdminUploadResult {
  mode: AdminUploadMode;
  categoryCount: number;
  questionCount: number;
  categoriesAdded?: number;
  categoriesUpdated?: number;
  questionsAdded?: number;
  questionsSkipped?: number;
}

export interface AdminRemoveQuestionsResult {
  removedCount: number;
  remainingQuestionCount: number;
}
