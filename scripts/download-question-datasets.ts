import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { normalizeImportedQuestionBank } from "@/lib/questions/import-format";
import type { AnswerKey, QuestionDifficulty } from "@/types/game";

type EduQGChapter = {
  chapter: number;
  bname: string;
  questions: EduQGQuestion[];
};

type EduQGQuestion = {
  question: {
    question_id?: string;
    question_text?: string;
    normal_format?: string;
    question_choices?: string[];
  };
  answer: {
    ans_text?: string;
    ans_choice?: number;
  };
  references_are_paraphrase?: number;
  bloom?: string | null;
  hl_sentences?: string;
  hl_context?: string;
};

type SciQRow = {
  question: string;
  distractor1: string;
  distractor2: string;
  distractor3: string;
  correct_answer: string;
  support: string;
};

type ImportedCategory = {
  slug: string;
  name: string;
  icon: string;
  active: boolean;
};

type ImportedQuestion = {
  categorySlug: string;
  title: string;
  prompt: string;
  modality: "text";
  difficulty: QuestionDifficulty;
  ageBandMin: "12_to_14" | "15_plus";
  ageBandMax: "15_plus";
  answerType: "multiple_choice";
  options: Partial<Record<AnswerKey, string>>;
  correctAnswer: AnswerKey;
  explanation: string;
  mediaUrl: null;
  mediaAltText: null;
  estimatedSeconds: number;
  active: boolean;
  tags: string[];
};

type ImportedQuestionBankInput = {
  categories: ImportedCategory[];
  questions: ImportedQuestion[];
};

type SourceManifest = {
  generatedAt: string;
  downloadedSources: Array<{
    id: string;
    label: string;
    sourceUrl: string;
    rawFiles: string[];
    exportFile: string;
    questionCount: number;
    categoryCount: number;
  }>;
  blockedOrPartialSources: Array<{
    id: string;
    label: string;
    sourceUrl: string;
    status: "blocked" | "partial";
    reason: string;
  }>;
  combinedExport: {
    file: string;
    questionCount: number;
    categoryCount: number;
  };
};

const OUTPUT_ROOT = path.join(process.cwd(), "data", "external", "question-datasets");
const RAW_ROOT = path.join(OUTPUT_ROOT, "raw");
const EXPORT_ROOT = path.join(OUTPUT_ROOT, "exports");

const EDUQG_TRAIN_URL =
  "https://raw.githubusercontent.com/hadifar/question-generation/main/raw_data/qg_train_v0.json";
const EDUQG_VALID_URL =
  "https://raw.githubusercontent.com/hadifar/question-generation/main/raw_data/qg_valid_v0.json";
const SCIQ_ZIP_URL = "https://s3-us-west-2.amazonaws.com/ai2-website/data/SciQ.zip";

const SCIQ_SPLITS = ["train", "validation", "test"] as const;
const unzip = promisify(execFile);

const categoryMetadata: Record<string, { name: string; icon: string }> = {
  anatomy_and_physiology: { name: "Anatomy & Physiology", icon: "🫀" },
  biology: { name: "Biology", icon: "🧬" },
  microbiology: { name: "Microbiology", icon: "🦠" },
  introduction_to_sociology: { name: "Sociology", icon: "👥" },
  psychology: { name: "Psychology", icon: "🧠" },
  "u.s._history": { name: "U.S. History", icon: "🗽" },
  "principles_of_accounting,_volume_1:_financial_accounting": {
    name: "Financial Accounting",
    icon: "📊",
  },
  "principles_of_accounting,_volume_2:_managerial_accounting": {
    name: "Managerial Accounting",
    icon: "📈",
  },
  american_government: { name: "American Government", icon: "🏛️" },
  business_law_i_essentials: { name: "Business Law", icon: "⚖️" },
  business_ethics: { name: "Business Ethics", icon: "🤝" },
  introduction_to_intellectual_property: { name: "Intellectual Property", icon: "💡" },
  "general-science": { name: "General Science", icon: "🔬" },
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function cleanText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<hl>/g, " ")
    .replace(/<\/hl>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");

  return `${(lastSpace > 60 ? clipped.slice(0, lastSpace) : clipped).trim()}.`;
}

function finalizeExplanation(value: string, fallback: string) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return fallback;
  }

  return truncateAtWord(cleaned, 240);
}

function createTitle(prompt: string) {
  const withoutPunctuation = prompt.replace(/[?!.]+$/g, "").trim();
  const words = withoutPunctuation.split(/\s+/).slice(0, 7);
  const title = words.join(" ");

  return title.length > 80 ? truncateAtWord(title, 80) : title;
}

function estimateSeconds(prompt: string) {
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  return Math.max(10, Math.min(60, Math.round(wordCount * 1.6 + 8)));
}

function difficultyToAgeBand(difficulty: QuestionDifficulty) {
  if (difficulty === "easy") {
    return {
      ageBandMin: "12_to_14" as const,
      ageBandMax: "15_plus" as const,
    };
  }

  return {
    ageBandMin: "15_plus" as const,
    ageBandMax: "15_plus" as const,
  };
}

function mapEduQGDifficulty(question: EduQGQuestion): QuestionDifficulty {
  const bloom = Number(question.bloom ?? "");

  if (Number.isFinite(bloom) && bloom > 0) {
    if (bloom <= 1) {
      return "easy";
    }

    if (bloom === 2) {
      return "medium";
    }

    return "hard";
  }

  const supportLength = cleanText(question.hl_sentences ?? question.hl_context ?? "").length;
  if (supportLength < 140) {
    return "easy";
  }
  if (supportLength < 280) {
    return "medium";
  }
  return "hard";
}

function mapSciQDifficulty(row: SciQRow): QuestionDifficulty {
  const supportLength = cleanText(row.support).length;

  if (supportLength < 140) {
    return "easy";
  }
  if (supportLength < 280) {
    return "medium";
  }
  return "hard";
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function rotateOptions(values: string[], shift: number) {
  const normalizedShift = shift % values.length;
  return [...values.slice(normalizedShift), ...values.slice(0, normalizedShift)];
}

function buildOptionMap(values: string[]) {
  const entries = values.slice(0, 4).map((value, index) => [[ "A", "B", "C", "D" ][index], value] as const);
  return Object.fromEntries(entries) as Partial<Record<AnswerKey, string>>;
}

function normalizeOptionText(value: string) {
  return cleanText(value).toLowerCase();
}

function resolveChoiceAnswer(
  options: string[],
  answerText: string | undefined,
  answerIndex: number | undefined,
): { options: string[]; correctAnswer: AnswerKey } | null {
  const cleanedOptions = options.map(cleanText).filter(Boolean);
  if (cleanedOptions.length < 2) {
    return null;
  }

  const normalizedAnswerText = normalizeOptionText(answerText ?? "");
  let correctIndex =
    typeof answerIndex === "number" && Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < cleanedOptions.length
      ? answerIndex
      : -1;

  if (correctIndex < 0 && answerText) {
    const upperAnswer = answerText.trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(upperAnswer)) {
      const letterIndex = ["A", "B", "C", "D"].indexOf(upperAnswer);
      if (letterIndex < cleanedOptions.length) {
        correctIndex = letterIndex;
      }
    }
  }

  if (correctIndex < 0 && normalizedAnswerText) {
    correctIndex = cleanedOptions.findIndex((option) => normalizeOptionText(option) === normalizedAnswerText);
  }

  if (correctIndex < 0) {
    return null;
  }

  let finalOptions = cleanedOptions;
  let finalCorrectIndex = correctIndex;

  if (cleanedOptions.length > 4) {
    const distractors = cleanedOptions.filter((_, index) => index !== correctIndex).slice(0, 3);
    finalOptions = [cleanedOptions[correctIndex], ...distractors];
    finalCorrectIndex = 0;
  }

  if (finalOptions.length < 2 || finalCorrectIndex >= finalOptions.length) {
    return null;
  }

  return {
    options: finalOptions.slice(0, 4),
    correctAnswer: (["A", "B", "C", "D"] as const)[finalCorrectIndex],
  };
}

function inferCategory(bookName: string) {
  const metadata = categoryMetadata[bookName];
  const slug = slugify(bookName);

  if (metadata) {
    return {
      slug,
      name: metadata.name,
      icon: metadata.icon,
      active: true,
    };
  }

  return {
    slug,
    name: bookName.replace(/_/g, " "),
    icon: "📚",
    active: true,
  };
}

function createQuestionFingerprint(question: ImportedQuestion) {
  return JSON.stringify([
    question.categorySlug,
    question.prompt.toLowerCase(),
    (question.options.A ?? "").toLowerCase(),
    (question.options.B ?? "").toLowerCase(),
    (question.options.C ?? "").toLowerCase(),
    (question.options.D ?? "").toLowerCase(),
    question.correctAnswer,
  ]);
}

function dedupeQuestions(questions: ImportedQuestion[]) {
  const seen = new Set<string>();
  const deduped: ImportedQuestion[] = [];

  for (const question of questions) {
    const fingerprint = createQuestionFingerprint(question);
    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    deduped.push(question);
  }

  return deduped;
}

async function ensureDir(directoryPath: string) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function downloadFile(url: string, outputPath: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function downloadEduQGRaw() {
  const eduqgRawDir = path.join(RAW_ROOT, "eduqg");
  await ensureDir(eduqgRawDir);

  const trainPath = path.join(eduqgRawDir, "qg_train_v0.json");
  const validPath = path.join(eduqgRawDir, "qg_valid_v0.json");

  await downloadFile(EDUQG_TRAIN_URL, trainPath);
  await downloadFile(EDUQG_VALID_URL, validPath);

  const [train, valid] = await Promise.all([
    fs.readFile(trainPath, "utf8").then((contents) => JSON.parse(contents) as EduQGChapter[]),
    fs.readFile(validPath, "utf8").then((contents) => JSON.parse(contents) as EduQGChapter[]),
  ]);

  return {
    train,
    valid,
    rawFiles: [trainPath, validPath],
  };
}

async function downloadSciQRaw() {
  const sciqRawDir = path.join(RAW_ROOT, "sciq");
  await ensureDir(sciqRawDir);

  const zipPath = path.join(sciqRawDir, "SciQ.zip");
  await downloadFile(SCIQ_ZIP_URL, zipPath);
  await unzip("unzip", ["-o", zipPath, "-d", sciqRawDir]);

  const extractedDir = path.join(sciqRawDir, "SciQ dataset-2 3");
  const rawFiles: string[] = [];
  const splits: Array<{ split: (typeof SCIQ_SPLITS)[number]; rows: SciQRow[] }> = [];

  for (const [sourceFileName, split] of [
    ["train.json", "train"],
    ["valid.json", "validation"],
    ["test.json", "test"],
  ] as const) {
    const rows = JSON.parse(
      await fs.readFile(path.join(extractedDir, sourceFileName), "utf8"),
    ) as SciQRow[];
    const outputPath = path.join(sciqRawDir, `${split}.json`);
    await fs.writeFile(outputPath, JSON.stringify(rows, null, 2));
    rawFiles.push(outputPath);
    splits.push({ split, rows });
  }

  return {
    splits,
    rawFiles: [zipPath, ...rawFiles],
  };
}

function convertEduQG(chapters: EduQGChapter[]) {
  const categoriesMap = new Map<string, ImportedCategory>();
  const questions: ImportedQuestion[] = [];

  for (const chapter of chapters) {
    const category = inferCategory(chapter.bname);
    categoriesMap.set(category.slug, category);

    for (const item of chapter.questions) {
      const prompt = cleanText(item.question.normal_format ?? item.question.question_text);
      const resolvedChoiceSet = resolveChoiceAnswer(
        item.question.question_choices ?? [],
        item.answer.ans_text,
        item.answer.ans_choice,
      );

      if (!prompt || !resolvedChoiceSet) {
        continue;
      }

      const difficulty = mapEduQGDifficulty(item);
      const ageBand = difficultyToAgeBand(difficulty);

      questions.push({
        categorySlug: category.slug,
        title: createTitle(prompt),
        prompt,
        modality: "text",
        difficulty,
        ageBandMin: ageBand.ageBandMin,
        ageBandMax: ageBand.ageBandMax,
        answerType: "multiple_choice",
        options: buildOptionMap(resolvedChoiceSet.options),
        correctAnswer: resolvedChoiceSet.correctAnswer,
        explanation: finalizeExplanation(
          item.hl_sentences ?? item.hl_context ?? "",
          "This answer best matches the evidence highlighted in the source passage.",
        ),
        mediaUrl: null,
        mediaAltText: null,
        estimatedSeconds: estimateSeconds(prompt),
        active: true,
        tags: [
          "eduqg",
          category.slug,
          `chapter-${chapter.chapter}`,
          item.bloom ? `bloom-${item.bloom}` : "bloom-unknown",
        ],
      });
    }
  }

  return {
    categories: [...categoriesMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
    questions: dedupeQuestions(questions),
  };
}

function convertSciQ(splits: Array<{ split: (typeof SCIQ_SPLITS)[number]; rows: SciQRow[] }>) {
  const category = inferCategory("general-science");
  const questions: ImportedQuestion[] = [];

  for (const { split, rows } of splits) {
    for (const row of rows) {
      const prompt = cleanText(row.question);
      const correctAnswerText = cleanText(row.correct_answer);
      const distractors = [row.distractor1, row.distractor2, row.distractor3].map(cleanText);

      if (!prompt || !correctAnswerText || distractors.some((value) => !value)) {
        continue;
      }

      const difficulty = mapSciQDifficulty(row);
      const ageBand = difficultyToAgeBand(difficulty);
      const rotated = rotateOptions(
        [correctAnswerText, distractors[0], distractors[1], distractors[2]],
        hashString(prompt) % 4,
      );
      const correctAnswer = (["A", "B", "C", "D"] as const)[rotated.indexOf(correctAnswerText)];

      questions.push({
        categorySlug: category.slug,
        title: createTitle(prompt),
        prompt,
        modality: "text",
        difficulty,
        ageBandMin: ageBand.ageBandMin,
        ageBandMax: ageBand.ageBandMax,
        answerType: "multiple_choice",
        options: buildOptionMap(rotated),
        correctAnswer,
        explanation: finalizeExplanation(
          row.support,
          "This option is the best match for the scientific fact described in the question.",
        ),
        mediaUrl: null,
        mediaAltText: null,
        estimatedSeconds: estimateSeconds(prompt),
        active: true,
        tags: ["sciq", category.slug, split],
      });
    }
  }

  return {
    categories: [category],
    questions: dedupeQuestions(questions),
  };
}

async function writeQuestionBank(outputPath: string, bank: ImportedQuestionBankInput) {
  const normalized = normalizeImportedQuestionBank(bank);

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        categories: normalized.categories.map(({ id: _id, ...category }) => category),
        questions: normalized.questions.map(({ id: _id, categoryId: _categoryId, createdAt: _createdAt, updatedAt: _updatedAt, ...question }) => {
          const category = normalized.categories.find((item) => item.id === _categoryId);
          if (!category) {
            throw new Error(`Unable to resolve category for question "${question.title}".`);
          }

          return {
            categorySlug: category.slug,
            ...question,
          };
        }),
      },
      null,
      2,
    ),
  );

  return normalized;
}

async function main() {
  await Promise.all([ensureDir(RAW_ROOT), ensureDir(EXPORT_ROOT)]);

  console.log("Downloading EduQG...");
  const eduqgRaw = await downloadEduQGRaw();
  console.log("Downloading SciQ...");
  const sciqRaw = await downloadSciQRaw();

  const eduqgConverted = convertEduQG([...eduqgRaw.train, ...eduqgRaw.valid]);
  const sciqConverted = convertSciQ(sciqRaw.splits);
  const combinedConverted = {
    categories: [...eduqgConverted.categories, ...sciqConverted.categories],
    questions: [...eduqgConverted.questions, ...sciqConverted.questions],
  };

  const eduqgExportPath = path.join(EXPORT_ROOT, "eduqg.question-bank.json");
  const sciqExportPath = path.join(EXPORT_ROOT, "sciq.question-bank.json");
  const combinedExportPath = path.join(EXPORT_ROOT, "open-mcq-combined.question-bank.json");

  const [eduqgNormalized, sciqNormalized, combinedNormalized] = await Promise.all([
    writeQuestionBank(eduqgExportPath, eduqgConverted),
    writeQuestionBank(sciqExportPath, sciqConverted),
    writeQuestionBank(combinedExportPath, combinedConverted),
  ]);

  const manifest: SourceManifest = {
    generatedAt: new Date().toISOString(),
    downloadedSources: [
      {
        id: "eduqg",
        label: "EduQG",
        sourceUrl: EDUQG_TRAIN_URL,
        rawFiles: eduqgRaw.rawFiles,
        exportFile: eduqgExportPath,
        questionCount: eduqgNormalized.questions.length,
        categoryCount: eduqgNormalized.categories.length,
      },
      {
        id: "sciq",
        label: "SciQ",
        sourceUrl: SCIQ_ZIP_URL,
        rawFiles: sciqRaw.rawFiles,
        exportFile: sciqExportPath,
        questionCount: sciqNormalized.questions.length,
        categoryCount: sciqNormalized.categories.length,
      },
    ],
    blockedOrPartialSources: [
      {
        id: "official-ib-questionbank",
        label: "IB Questionbank (official)",
        sourceUrl: "https://questionbank.ibo.org/?locale=en",
        status: "blocked",
        reason: "Institutional login and license required; no direct public dataset access was available.",
      },
      {
        id: "ibquestionbank-tutorchase",
        label: "IBQuestionBank.org / TutorChase pages",
        sourceUrl: "https://www.ibquestionbank.org/pages-sitemap.xml",
        status: "partial",
        reason:
          "Public pages exposed subject and topic catalogs, but the question payload itself was not embedded in the HTML we inspected.",
      },
      {
        id: "revisiondojo",
        label: "RevisionDojo IB question bank",
        sourceUrl: "https://www.revisiondojo.app/",
        status: "partial",
        reason:
          "Public pages exposed marketing and subject routes, but no public bulk question dataset or stable server-rendered question payload was located.",
      },
      {
        id: "testprepkart-pdf",
        label: "TestPrepKart IB PDF-style question banks",
        sourceUrl: "https://www.testprepkart.com/ib/blog/ib-question-bank-free-download",
        status: "partial",
        reason:
          "Landing pages and download routes were reachable, but they resolved to HTML pages rather than a clean direct PDF dataset endpoint during this pass.",
      },
    ],
    combinedExport: {
      file: combinedExportPath,
      questionCount: combinedNormalized.questions.length,
      categoryCount: combinedNormalized.categories.length,
    },
  };

  const manifestPath = path.join(OUTPUT_ROOT, "source-manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    [
      `EduQG: ${eduqgNormalized.categories.length} categories, ${eduqgNormalized.questions.length} questions.`,
      `SciQ: ${sciqNormalized.categories.length} categories, ${sciqNormalized.questions.length} questions.`,
      `Combined export: ${combinedNormalized.categories.length} categories, ${combinedNormalized.questions.length} questions.`,
      `Manifest: ${manifestPath}`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
