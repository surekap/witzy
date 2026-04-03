export type QuestionFlagReporterScope = "practice_account" | "room_player";
export type QuestionFlagSource = "solo_practice" | "live_room";

export interface QuestionFlagRecord {
  id: string;
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  reporterKey: string;
  reporterScope: QuestionFlagReporterScope;
  reporterUserId: string | null;
  reporterDisplayName: string;
  source: QuestionFlagSource;
  roomCode: string | null;
  reportedAt: string;
}

export interface QuestionFlagSummary {
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  distinctReporterCount: number;
  practiceAccountFlagCount: number;
  roomPlayerFlagCount: number;
  latestReportedAt: string;
}
