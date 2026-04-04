import fs from "node:fs/promises";
import path from "node:path";

export interface SnapshotManifest {
  formatVersion: 1;
  generatedAt: string;
  source: "convex";
  tables: Record<string, number>;
}

export async function ensureSnapshotDirectory(directoryPath: string) {
  await fs.mkdir(directoryPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await ensureSnapshotDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n");
}

export async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

export async function writeJsonlFile(filePath: string, rows: unknown[]) {
  await ensureSnapshotDirectory(path.dirname(filePath));
  const contents = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.writeFile(filePath, `${contents}${rows.length > 0 ? "\n" : ""}`);
}

export async function readJsonlFile<T>(filePath: string) {
  const contents = await fs.readFile(filePath, "utf8");
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}
