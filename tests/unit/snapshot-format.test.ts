import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readJsonFile, readJsonlFile, writeJsonFile, writeJsonlFile } from "@/lib/snapshot/format";

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map(async (tempPath) => {
      await fs.rm(tempPath, { recursive: true, force: true });
    }),
  );
});

describe("snapshot format helpers", () => {
  it("round-trips JSON files", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "witzy-snapshot-json-"));
    tempPaths.push(tempDir);

    const filePath = path.join(tempDir, "manifest.json");
    const value = {
      formatVersion: 1,
      tables: { questions: 2 },
    };

    await writeJsonFile(filePath, value);

    await expect(readJsonFile<typeof value>(filePath)).resolves.toEqual(value);
  });

  it("round-trips JSONL files", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "witzy-snapshot-jsonl-"));
    tempPaths.push(tempDir);

    const filePath = path.join(tempDir, "questions.jsonl");
    const rows = [
      { id: "q1", title: "First" },
      { id: "q2", title: "Second" },
    ];

    await writeJsonlFile(filePath, rows);

    await expect(readJsonlFile<typeof rows[number]>(filePath)).resolves.toEqual(rows);
  });
});
