import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeKey, StorageConflictError, type Storage } from "./types";

/** Development storage on the local filesystem. */
export function createLocalStorage(rootDir: string): Storage {
  const root = path.resolve(rootDir);

  const resolve = (key: string) => {
    assertSafeKey(key);
    const file = path.resolve(root, key);
    if (!file.startsWith(root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return file;
  };

  return {
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      try {
        // "wx" fails if the file exists, so originals are never overwritten.
        await writeFile(file, body, { flag: "wx" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new StorageConflictError(key);
        throw error;
      }
    },
    async get(key) {
      return new Uint8Array(await readFile(resolve(key)));
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
  };
}
