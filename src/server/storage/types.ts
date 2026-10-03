/** Stores original files. Implementations never overwrite an existing key: originals are immutable. */
export interface Storage {
  /** Writes a new object. Throws `StorageConflictError` if the key already exists. */
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

export class StorageConflictError extends Error {
  constructor(key: string) {
    super(`Object already exists: ${key}`);
    this.name = "StorageConflictError";
  }
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/** Rejects keys that could escape the storage root (.., absolute paths, backslashes). */
export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}
