import { z } from "zod";

export const createRoomSchema = z.object({
  hostName: z.string().trim().min(2).max(30),
  numberOfRounds: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  answerTimeLimitSeconds: z.union([z.literal(10), z.literal(15), z.literal(20)]),
  categoryMode: z.union([z.literal("host_selects_each_round"), z.literal("random_from_selected_pool")]),
  enabledCategoryIds: z.array(z.string()).min(1),
  fastestCorrectBonus: z.boolean(),
  confidenceWager: z.boolean(),
  teamBonus: z.boolean(),
  hints: z.boolean(),
});

export const joinRoomSchema = z.object({
  displayName: z.string().trim().min(2).max(30),
  ageBand: z.union([
    z.literal("6_to_8"),
    z.literal("9_to_11"),
    z.literal("12_to_14"),
    z.literal("15_plus"),
  ]),
  difficultyMode: z.union([
    z.literal("easy"),
    z.literal("medium"),
    z.literal("hard"),
    z.literal("adaptive"),
  ]),
  avatarColor: z.string().trim().min(4).max(20),
});

export const startRoundSchema = z.object({
  categoryId: z.string().trim().optional(),
});

export const submitAnswerSchema = z.object({
  assignedQuestionId: z.string().trim().min(1),
  answerKey: z.union([z.literal("A"), z.literal("B"), z.literal("C"), z.literal("D")]),
  confidenceMode: z.union([z.literal("safe"), z.literal("bold")]).optional(),
  useHint: z.boolean().optional(),
});

export const soloQuestionSchema = z.object({
  categoryId: z.string().trim().min(1),
  ageBand: z.union([
    z.literal("6_to_8"),
    z.literal("9_to_11"),
    z.literal("12_to_14"),
    z.literal("15_plus"),
  ]),
  difficultyMode: z.union([
    z.literal("easy"),
    z.literal("medium"),
    z.literal("hard"),
    z.literal("adaptive"),
  ]).optional(),
  askedQuestionIds: z.array(z.string()).default([]),
});

export const practiceAuthSchema = z.object({
  username: z.string().trim().min(2).max(30),
  password: z.string().min(4).max(64),
});

export const soloAnswerSchema = z.object({
  questionId: z.string().trim().min(1),
  answerKey: z.union([z.literal("A"), z.literal("B"), z.literal("C"), z.literal("D")]),
});
