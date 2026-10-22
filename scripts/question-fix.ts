// Editorial rewrite of the original question bank, done chunk by chunk.
//   split            source.json -> input/<category>/<band>-NN.json (40 questions each)
//   check [files..]  validate rewritten output chunks against their inputs (default: all)
//   status           per-category progress
//   assemble         every chunk passing -> bank.json (original ids, answers re-lettered) + report.json
//   publish [--prod] bank.json -> a new Convex bank version, activated only if the live bank is still the reviewed base
// Example: npx tsx scripts/question-fix.ts check .data/question-fix/output/math-masterminds/6_to_8-01.json
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { questionAllowanceSeconds } from "../lib/game/timing";
import { countWords, questionQualityIssues, questionWordCount } from "../lib/questions/quality";
import { shuffleQuestionOptions } from "../lib/questions/shuffle";
import { ageBands, difficultyValues, type Category, type Question } from "../types/game";

const root = ".data/question-fix";
const source = ".data/original-bank-review/source.json";
const chunkSize = 40;
export const fixCodes = ["none", "verbose", "age", "wrong-answer", "two-correct", "ambiguous", "factual", "weak-distractors", "answer-clue", "rewritten", "replaced", "duplicate"] as const;
const framing = /\b(a student (argues|says|claims)|to what extent|evaluate|examine|which statement best|most directly)\b/i;
const letterReference = /\b(option|answer|choice)\s+[A-D]\b|\([A-D]\)/;
// Qualifiers that children learn to read as "this one is wrong" when only distractors carry them.
const qualifier = /\b(always|never|completely|absolutely|entirely|totally|permanently|perfectly|exactly|simply|only|very|much|far|all|every|any)\b/i;

type Chunk = { category: string; slug: string; band: string; questions: Array<Record<string, unknown>> };
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8"));
const chunkFiles = (dir: string) => existsSync(dir)
  ? readdirSync(dir).flatMap((slug) => readdirSync(join(dir, slug)).map((file) => join(dir, slug, file))).sort()
  : [];

function split() {
  if (existsSync(join(root, "input"))) throw new Error("Input chunks already exist; refusing to overwrite.");
  const bank = readJson<{ categories: Category[]; questions: Question[] }>(source);
  for (const category of bank.categories) {
    for (const band of ageBands) {
      const questions = bank.questions
        .filter((question) => question.categoryId === category.id && question.ageBandMin === band)
        .sort((a, b) => difficultyValues.indexOf(a.difficulty) - difficultyValues.indexOf(b.difficulty))
        .map(({ id, title, prompt, options, correctAnswer, explanation, ageBandMin, ageBandMax, difficulty, answerType }) =>
          ({ id, title, prompt, options, correctAnswer, explanation, ageBandMin, ageBandMax, difficulty, ...(answerType === "multiple_choice" ? {} : { answerType }) }));
      for (let i = 0; i < questions.length; i += chunkSize) {
        const path = join(root, "input", category.slug, `${band}-${String(i / chunkSize + 1).padStart(2, "0")}.json`);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, JSON.stringify({ category: category.name, slug: category.slug, band, questions: questions.slice(i, i + chunkSize) }, null, 1));
      }
    }
  }
  console.log(`${chunkFiles(join(root, "input")).length} chunks written`);
}

function checkChunk(outputPath: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const input = readJson<Chunk>(outputPath.replace("/output/", "/input/"));
  const output = readJson<Chunk>(outputPath);
  const originals = new Map(input.questions.map((question) => [question.id as string, question]));
  const seen = new Set<string>();
  let longestCorrect = 0;
  let qualifierTells = 0;
  for (const raw of output.questions ?? []) {
    const id = String(raw.id);
    const original = originals.get(id);
    const at = (message: string) => errors.push(`${id}: ${message}`);
    if (!original) { at("not in input"); continue; }
    if (seen.has(id)) { at("duplicate id"); continue; }
    seen.add(id);
    const fixes = raw.fixes as string[] | undefined;
    if (!Array.isArray(fixes) || !fixes.length || fixes.some((code) => !(fixCodes as readonly string[]).includes(code))) at(`fixes must use codes: ${fixCodes.join(", ")}`);
    if (raw.drop) { if (!raw.note) at("drop needs a note"); continue; }
    const question = raw as unknown as Question;
    const options = question.options ?? {};
    const expectedKeys = original.answerType === "true_false" ? "AB" : "ABCD";
    if (Object.keys(options).sort().join("") !== expectedKeys) at(`options must be exactly ${expectedKeys.split("").join("/")}`);
    if (!ageBands.includes(question.ageBandMin) || !ageBands.includes(question.ageBandMax)) at("invalid age band");
    if (!difficultyValues.includes(question.difficulty)) at("invalid difficulty");
    for (const issue of questionQualityIssues(question)) at(issue);
    if (!question.title?.trim() || countWords(question.title) > 6) at("title must be 1-6 words");
    if (!question.explanation?.trim() || countWords(question.explanation) > 25) at("explanation must be 1-25 words");
    if (letterReference.test(`${question.prompt} ${question.explanation}`)) at("refers to an option letter (options are shuffled)");
    if (framing.test(question.prompt)) warnings.push(`${id}: wordy framing`);
    const lengths = Object.entries(options).map(([key, value]) => [key, String(value).length] as const);
    const max = Math.max(...lengths.map(([, length]) => length));
    if (lengths.filter(([, length]) => length === max).length === 1 && options[question.correctAnswer]?.length === max) longestCorrect += 1;
    const distractors = Object.entries(options).filter(([key]) => key !== question.correctAnswer).map(([, value]) => String(value));
    if (distractors.some((value) => qualifier.test(value)) && !qualifier.test(options[question.correctAnswer] ?? "")) {
      qualifierTells += 1;
      warnings.push(`${id}: only distractors use qualifiers like always/never/completely/very`);
    }
  }
  for (const id of originals.keys()) if (!seen.has(id)) errors.push(`${id}: missing from output`);
  // Expect about 1 in 4 by chance; far more means answers are guessable by length.
  if (seen.size >= 10 && longestCorrect / seen.size > 0.4) errors.push(`correct answer is the longest option in ${longestCorrect}/${seen.size} questions (max 40%)`);
  // Padding distractors with qualifiers to beat the length rule just swaps one giveaway for another.
  if (seen.size >= 10 && qualifierTells / seen.size > 0.2) errors.push(`only distractors carry qualifiers (always/never/completely/very...) in ${qualifierTells}/${seen.size} questions (max 20%)`);
  return { errors, warnings };
}

function check(files: string[]) {
  const targets = files.length ? files : chunkFiles(join(root, "output"));
  let failed = 0;
  for (const file of targets) {
    const { errors, warnings } = checkChunk(file);
    if (errors.length) failed += 1;
    console.log(`${errors.length ? "FAIL" : "OK  "} ${file}${warnings.length ? ` (${warnings.length} warnings)` : ""}`);
    for (const line of [...errors, ...warnings.map((warning) => `warning ${warning}`)]) console.log(`  ${line}`);
  }
  if (failed) process.exitCode = 1;
}

function status() {
  const inputs = chunkFiles(join(root, "input"));
  const bySlug = new Map<string, { total: number; done: number; failing: number }>();
  for (const input of inputs) {
    const slug = basename(dirname(input));
    const entry = bySlug.get(slug) ?? { total: 0, done: 0, failing: 0 };
    entry.total += 1;
    const output = input.replace("/input/", "/output/");
    if (existsSync(output)) {
      entry.done += 1;
      if (checkChunk(output).errors.length) entry.failing += 1;
    }
    bySlug.set(slug, entry);
  }
  for (const [slug, entry] of bySlug) console.log(`${slug.padEnd(22)} ${entry.done}/${entry.total} done, ${entry.failing} failing`);
}

type Bank = { version: string; categories: Category[]; questions: Question[] };

// Deterministic per question, so re-assembling never moves an answer, yet letters end up evenly spread.
function seededRandom(id: string) {
  let state = createHash("sha256").update(id).digest().readUInt32LE(0);
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

function assemble() {
  const bank = readJson<Bank>(source);
  const unready = chunkFiles(join(root, "input")).filter((input) => {
    const output = input.replace("/input/", "/output/");
    return !existsSync(output) || checkChunk(output).errors.length > 0;
  });
  if (unready.length) throw new Error(`${unready.length} chunks are missing or failing, e.g. ${unready[0]}`);
  const rewrites = new Map(chunkFiles(join(root, "output")).flatMap((file) => readJson<Chunk>(file).questions.map((question) => [String(question.id), question])));
  const now = new Date().toISOString();
  const firstByPrompt = new Map<string, string>();
  const duplicates: string[][] = [];
  const questions = bank.questions.map((original) => {
    const rewrite = rewrites.get(original.id)!;
    const tags = [...new Set([...original.tags, "age-reviewed:v1", "rewrite:2026-10"])];
    if (rewrite.drop) return { ...original, active: false, tags, updatedAt: now };
    const { title, prompt, options, correctAnswer, explanation, ageBandMin, ageBandMax, difficulty } = rewrite as unknown as Question;
    const question = shuffleQuestionOptions({ ...original, title, prompt, options, correctAnswer, explanation, ageBandMin, ageBandMax, difficulty, tags, updatedAt: now }, seededRandom(original.id));
    question.estimatedSeconds = questionAllowanceSeconds(question, question.ageBandMin);
    const key = `${question.categoryId}|${question.prompt.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`;
    const first = firstByPrompt.get(key);
    if (first) duplicates.push([first, question.id]);
    else firstByPrompt.set(key, question.id);
    return question;
  });
  const wordsByBand = (list: Question[]) => Object.fromEntries(ageBands.map((band) => [band, median(list.filter((q) => q.ageBandMin === band && q.active).map(questionWordCount))]));
  const tally = (values: string[]) => Object.fromEntries([...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]));
  const allRewrites = [...rewrites.values()];
  writeFileSync(join(root, "bank.json"), JSON.stringify({ version: bank.version, categories: bank.categories, questions }));
  writeFileSync(join(root, "report.json"), JSON.stringify({
    questions: questions.length,
    active: questions.filter((question) => question.active).length,
    medianWords: { before: wordsByBand(bank.questions), after: wordsByBand(questions) },
    correctLetters: tally(questions.map((question) => question.correctAnswer)),
    difficultyByAge: tally(questions.filter((question) => question.active).map((question) => `${question.ageBandMin} ${question.difficulty}`)),
    // Playable questions per category for each age; a thin cell means repeats in long games.
    perAge: Object.fromEntries(bank.categories.map((category) => [category.slug, Object.fromEntries(ageBands.map((band) => [band,
      questions.filter((q) => q.active && q.categoryId === category.id && ageBands.indexOf(q.ageBandMin) <= ageBands.indexOf(band) && ageBands.indexOf(band) <= ageBands.indexOf(q.ageBandMax)).length]))])),
    fixes: tally(allRewrites.flatMap((rewrite) => rewrite.fixes as string[])),
    logicFixes: allRewrites.filter((rewrite) => rewrite.note).map(({ id, note }) => ({ id, note })),
    samePromptInCategory: duplicates,
  }, null, 1));
  console.log(`bank.json: ${questions.length} questions; ${duplicates.length} repeated prompts within a category (see report.json)`);
}

function publish(target: string[]) {
  const bank = readJson<Bank>(join(root, "bank.json"));
  // The Convex CLI uses this machine's login, so no admin key is needed; `--prod` targets the live deployment.
  const convex = (command: string, ...args: string[]) => execFileSync("npx", ["--no-install", "convex", command, ...target, ...args], { encoding: "utf8", maxBuffer: 100_000_000 }).trim();
  const live = JSON.parse(convex("run", "questionBank:getActiveQuestionBankVersion", "{}").split("\n").at(-1)!);
  if (live !== bank.version) throw new Error(`Live bank is ${live}, not the reviewed base ${bank.version}. Nothing published.`);
  const version = `question_bank_${Date.now()}_rewrite`;
  const lines = (rows: object[]) => rows.map((row) => JSON.stringify(row)).join("\n");
  mkdirSync(join(root, "publish"), { recursive: true });
  writeFileSync(join(root, "publish/categories.jsonl"), lines(bank.categories.map(({ id, ...category }) => ({ bankVersion: version, categoryId: id, ...category }))));
  writeFileSync(join(root, "publish/questions.jsonl"), lines(bank.questions.map(({ id, options, ...question }) => ({
    bankVersion: version, questionId: id, ...question,
    optionA: options.A ?? null, optionB: options.B ?? null, optionC: options.C ?? null, optionD: options.D ?? null,
  }))));
  // Rows of an unactivated version are invisible to the game; only the final pointer swap goes live.
  convex("import", "--table", "categories", "--append", "-y", join(root, "publish/categories.jsonl"));
  convex("import", "--table", "questions", "--append", "-y", join(root, "publish/questions.jsonl"));
  convex("run", "questionBank:activateQuestionBankVersion", JSON.stringify({ version, activatedAt: new Date().toISOString(), expectedVersion: bank.version }));
  console.log(`Live bank is now ${version}. Roll back with:\nnpx convex run ${target.join(" ")} questionBank:activateQuestionBankVersion '${JSON.stringify({ version: bank.version, activatedAt: new Date().toISOString(), expectedVersion: version })}'`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "split") split();
else if (command === "check") check(args);
else if (command === "status") status();
else if (command === "assemble") assemble();
else if (command === "publish") publish(args.filter((arg) => arg === "--prod"));
else throw new Error("Usage: question-fix.ts split | check [files..] | status | assemble | publish [--prod]");
