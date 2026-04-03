# Question Seeding And Importing

## Overview

Witzy supports two question-bank workflows:

1. `corepack pnpm seed`
   This generates the built-in synthetic quiz bank and writes it into Neon.
2. `corepack pnpm import:questions <path-to-json>`
   This loads a JSON file that was created elsewhere and replaces the current `categories` and `questions` tables with that content.

Both commands require `DATABASE_URL` in `.env.local` or `.env`.

## What The Import Command Does

`corepack pnpm import:questions scripts/question-bank.example.json`

The importer:

- reads a JSON file from disk
- validates its shape with `zod`
- generates UUIDs automatically when category or question IDs are omitted
- maps each question's `categorySlug` to the correct category row
- replaces the current question bank in Neon

The importer is intentionally strict. It will fail if:

- a category slug is duplicated
- a question points to a missing `categorySlug`
- `correctAnswer` does not exist in `options`
- `ageBandMin` is older than `ageBandMax`
- `modality` and `mediaUrl` do not agree

## JSON Format

Top-level shape:

```json
{
  "categories": [],
  "questions": []
}
```

### `categories`

Each category object supports:

```json
{
  "id": "optional-uuid",
  "slug": "space",
  "name": "Space",
  "icon": "🚀",
  "active": true
}
```

Rules:

- `id` is optional
- `slug` must be unique and lowercase-hyphenated
- `icon` is any short string, usually an emoji
- `active` defaults to `true`

### `questions`

Each question object supports:

```json
{
  "id": "optional-uuid",
  "categorySlug": "space",
  "title": "Planet order",
  "prompt": "Which planet is known as the Red Planet?",
  "modality": "text",
  "difficulty": "easy",
  "ageBandMin": "6_to_8",
  "ageBandMax": "9_to_11",
  "answerType": "multiple_choice",
  "options": {
    "A": "Mars",
    "B": "Venus",
    "C": "Jupiter",
    "D": "Mercury"
  },
  "correctAnswer": "A",
  "explanation": "Mars is often called the Red Planet because of its reddish surface.",
  "mediaUrl": null,
  "mediaAltText": null,
  "estimatedSeconds": 12,
  "active": true,
  "tags": ["space", "planets"]
}
```

Allowed values:

- `modality`: `text`, `image`, `audio`
- `difficulty`: `easy`, `medium`, `hard`
- `ageBandMin` / `ageBandMax`: `6_to_8`, `9_to_11`, `12_to_14`, `15_plus`
- `answerType`: `multiple_choice`, `single_tap_image`, `true_false`
- `correctAnswer`: `A`, `B`, `C`, `D`

Validation rules:

- `categorySlug` must match a category in the same file
- `correctAnswer` must point to a populated option
- text questions should not include `mediaUrl`
- image/audio questions must include `mediaUrl`
- `true_false` questions must define `A` and `B`
- `estimatedSeconds` must be between `5` and `120`

## Recommended Authoring Rules

When generating a question bank externally:

- keep category slugs stable and human-readable
- make prompts materially different, not lightly rephrased duplicates
- vary distractors across questions in the same category
- include `tags` for downstream filtering and audits
- provide `mediaAltText` for image/audio prompts when possible
- omit IDs unless you have a strong reason to manage them yourself

## Example File

See:

- [scripts/question-bank.example.json](/Users/prateeksureka/Sites/kids_quiz/scripts/question-bank.example.json)

## Copy-Paste LLM Prompt

Use this prompt with an LLM when you want it to generate an importable question bank JSON file:

```text
Generate a JSON object for a kids quiz app. Output JSON only. Do not wrap it in Markdown. Do not add commentary.

The top-level JSON shape must be:
{
  "categories": [...],
  "questions": [...]
}

Requirements:
- Produce exactly 10 categories.
- Produce exactly 500 questions total unless I specify another count.
- Each category must include:
  - slug: lowercase-hyphenated unique string
  - name: short display name
  - icon: short emoji or icon string
- Each question must include:
  - categorySlug
  - title
  - prompt
  - modality: one of "text", "image", "audio"
  - difficulty: one of "easy", "medium", "hard"
  - ageBandMin: one of "6_to_8", "9_to_11", "12_to_14", "15_plus"
  - ageBandMax: one of "6_to_8", "9_to_11", "12_to_14", "15_plus"
  - answerType: one of "multiple_choice", "single_tap_image", "true_false"
  - options: object with keys A, B, optionally C and D depending on question type
  - correctAnswer: one of "A", "B", "C", "D"
  - explanation
  - estimatedSeconds: integer between 5 and 120
  - tags: array of short strings
- Optional fields:
  - mediaUrl
  - mediaAltText
  - active

Hard constraints:
- The JSON must be valid and parseable.
- Questions must not be duplicates.
- Avoid near-duplicates with only tiny wording changes.
- Vary the distractors meaningfully.
- Spread questions across all categories, age bands, and difficulties.
- Include some image questions and some audio questions.
- For text questions, set mediaUrl to null or omit it.
- For image/audio questions, include a mediaUrl.
- correctAnswer must always point to a populated option.
- ageBandMin must not be older than ageBandMax.

Quality bar:
- Make questions classroom-safe, concise, and factually correct.
- Prefer short, clear prompts for younger age bands.
- Make hard questions meaningfully deeper, not just longer.
- Explanations should teach something briefly.

Return only the final JSON object.
```
