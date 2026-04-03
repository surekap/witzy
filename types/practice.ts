export interface PracticeQuestionStat {
  correctCount: number;
  incorrectCount: number;
  lastAnsweredAt: string | null;
}

export interface PracticeSignalStat {
  correctCount: number;
  incorrectCount: number;
}

export interface PracticeCategoryStat {
  correctCount: number;
  incorrectCount: number;
}

export interface PracticeProgressRecord {
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  currentStreak: number;
  questionStats: Record<string, PracticeQuestionStat>;
  signalStats: Record<string, PracticeSignalStat>;
  categoryStats: Record<string, PracticeCategoryStat>;
}

export interface PracticeAccountRecord {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  lastLoginAt: string | null;
  progress: PracticeProgressRecord;
}

export interface PracticeStoreData {
  accounts: PracticeAccountRecord[];
}

export interface PracticeCategoryProgress {
  categoryId: string;
  categoryName: string;
  icon: string;
  correctCount: number;
  incorrectCount: number;
  masteredCount: number;
}

export interface PracticeLifetimeProgress {
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  masteredCount: number;
  currentStreak: number;
  accuracyRate: number;
  categoryProgress: PracticeCategoryProgress[];
  weakAreas: string[];
}

export interface PracticeAccountProfile {
  id: string;
  username: string;
  createdAt: string;
  lastLoginAt: string | null;
  lifetimeProgress: PracticeLifetimeProgress;
}
