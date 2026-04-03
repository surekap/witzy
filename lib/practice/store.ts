import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PracticeAccountRecord, PracticeProgressRecord, PracticeStoreData } from "@/types/practice";

const DEFAULT_STORE_PATH = path.join(process.cwd(), ".data", "practice-accounts.json");

function createEmptyProgress(): PracticeProgressRecord {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    currentStreak: 0,
    questionStats: {},
    signalStats: {},
    categoryStats: {},
  };
}

function createEmptyStore(): PracticeStoreData {
  return {
    accounts: [],
  };
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createPracticeStore(filePath = DEFAULT_STORE_PATH) {
  let writeChain = Promise.resolve();

  async function readData() {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PracticeStoreData>;

      return {
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      } satisfies PracticeStoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createEmptyStore();
      }

      throw error;
    }
  }

  async function writeData(data: PracticeStoreData) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async function queueMutation<T>(mutation: (data: PracticeStoreData) => Promise<T> | T) {
    const next = writeChain.then(async () => {
      const data = await readData();
      const result = await mutation(data);
      await writeData(data);
      return result;
    });

    writeChain = next.then(
      () => undefined,
      () => undefined,
    );

    return next;
  }

  return {
    filePath,

    async getAccountById(accountId: string) {
      const data = await readData();
      const account = data.accounts.find((candidate) => candidate.id === accountId);
      return account ? cloneRecord(account) : null;
    },

    async getAccountByUsername(username: string) {
      const normalizedUsername = username.trim().toLowerCase();
      const data = await readData();
      const account = data.accounts.find(
        (candidate) => candidate.username.toLowerCase() === normalizedUsername,
      );
      return account ? cloneRecord(account) : null;
    },

    async createAccount(account: PracticeAccountRecord) {
      return queueMutation(async (data) => {
        const alreadyExists = data.accounts.some(
          (candidate) => candidate.username.toLowerCase() === account.username.toLowerCase(),
        );

        if (alreadyExists) {
          throw new Error("That username is already in use.");
        }

        data.accounts.push(cloneRecord(account));
        return cloneRecord(account);
      });
    },

    async updateAccount(account: PracticeAccountRecord) {
      return queueMutation(async (data) => {
        const index = data.accounts.findIndex((candidate) => candidate.id === account.id);

        if (index === -1) {
          throw new Error("That account could not be found.");
        }

        data.accounts[index] = cloneRecord(account);
        return cloneRecord(account);
      });
    },

    async reset() {
      return queueMutation(async (data) => {
        data.accounts = [];
      });
    },

    createEmptyProgress,
  };
}

declare global {
  var __practiceStore: ReturnType<typeof createPracticeStore> | undefined;
}

export function getPracticeStore() {
  if (!globalThis.__practiceStore) {
    globalThis.__practiceStore = createPracticeStore();
  }

  return globalThis.__practiceStore;
}

export { DEFAULT_STORE_PATH };
