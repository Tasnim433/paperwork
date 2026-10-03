import { env } from "../env";
import { createLocalStorage } from "./local";
import { createR2Storage } from "./r2";
import type { Storage } from "./types";

export { StorageConflictError, type Storage } from "./types";

let instance: Storage | undefined;

/** The configured storage driver (STORAGE_DRIVER=local|r2). */
export function storage(): Storage {
  instance ??=
    env.STORAGE_DRIVER === "r2"
      ? createR2Storage({
          accountId: env.R2_ACCOUNT_ID!,
          accessKeyId: env.R2_ACCESS_KEY_ID!,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
          bucket: env.R2_BUCKET!,
        })
      : createLocalStorage(env.LOCAL_STORAGE_DIR);
  return instance;
}

/** Storage key of a document's original file. */
export function originalKey(userId: string, documentId: string, extension: string) {
  return `users/${userId}/${documentId}/original.${extension}`;
}
