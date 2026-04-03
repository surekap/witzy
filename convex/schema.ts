import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());

export default defineSchema({
  settings: defineTable({
    key: v.string(),
    stringValue: nullableString,
    updatedAt: v.string(),
  }).index("by_key", ["key"]),

  categories: defineTable({
    bankVersion: v.string(),
    categoryId: v.string(),
    slug: v.string(),
    name: v.string(),
    icon: v.string(),
    active: v.boolean(),
  })
    .index("by_bank_version", ["bankVersion"])
    .index("by_category_id", ["categoryId"]),

  questions: defineTable({
    bankVersion: v.string(),
    questionId: v.string(),
    categoryId: v.string(),
    title: v.string(),
    prompt: v.string(),
    modality: v.union(v.literal("text"), v.literal("image"), v.literal("audio")),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    ageBandMin: v.union(v.literal("6_to_8"), v.literal("9_to_11"), v.literal("12_to_14"), v.literal("15_plus")),
    ageBandMax: v.union(v.literal("6_to_8"), v.literal("9_to_11"), v.literal("12_to_14"), v.literal("15_plus")),
    answerType: v.union(v.literal("multiple_choice"), v.literal("single_tap_image"), v.literal("true_false")),
    optionA: nullableString,
    optionB: nullableString,
    optionC: nullableString,
    optionD: nullableString,
    correctAnswer: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D")),
    explanation: v.string(),
    mediaUrl: nullableString,
    mediaAltText: nullableString,
    estimatedSeconds: v.number(),
    active: v.boolean(),
    tags: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_bank_version", ["bankVersion"])
    .index("by_question_id", ["questionId"])
    .index("by_category_id", ["categoryId"]),

  rooms: defineTable({
    roomCode: v.string(),
    room: v.any(),
    version: v.number(),
    updatedAt: v.string(),
  }).index("by_room_code", ["roomCode"]),

  users: defineTable({
    accountId: v.string(),
    username: v.string(),
    usernameLower: v.string(),
    displayName: v.string(),
    passwordHash: nullableString,
    passwordSalt: nullableString,
    createdAt: v.string(),
    lastLoginAt: nullableString,
  })
    .index("by_account_id", ["accountId"])
    .index("by_username_lower", ["usernameLower"]),

  practiceAttempts: defineTable({
    accountId: v.string(),
    questionId: v.string(),
    submittedAnswer: v.string(),
    isCorrect: v.boolean(),
    answeredAt: v.string(),
  })
    .index("by_account_answered_at", ["accountId", "answeredAt"])
    .index("by_question_id", ["questionId"]),

  questionFlags: defineTable({
    questionId: v.string(),
    questionTitle: v.string(),
    questionPrompt: v.string(),
    reporterKey: v.string(),
    reporterScope: v.union(v.literal("practice_account"), v.literal("room_player")),
    reporterUserId: nullableString,
    reporterDisplayName: v.string(),
    source: v.union(v.literal("solo_practice"), v.literal("live_room")),
    roomCode: nullableString,
    reportedAt: v.string(),
  })
    .index("by_question_id", ["questionId"])
    .index("by_question_and_reporter", ["questionId", "reporterKey"]),
});
