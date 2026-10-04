import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { createLocalStorage } from "./local";
import { StorageConflictError } from "./types";

const root = mkdtempSync(path.join(tmpdir(), "paperwork-storage-"));
const storage = createLocalStorage(root);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("local storage driver", () => {
  it("stores, reads and deletes an original", async () => {
    const key = "users/u1/doc1/original.pdf";
    await storage.put(key, new TextEncoder().encode("%PDF-1.7"), "application/pdf");
    expect(new TextDecoder().decode(await storage.get(key))).toBe("%PDF-1.7");
    await storage.delete(key);
    expect(existsSync(path.join(root, key))).toBe(false);
  });

  it("never overwrites an existing original", async () => {
    const key = "users/u1/doc2/original.pdf";
    await storage.put(key, new Uint8Array([1]), "application/pdf");
    await expect(storage.put(key, new Uint8Array([2]), "application/pdf")).rejects.toBeInstanceOf(
      StorageConflictError,
    );
  });

  it("deleting a missing file is not an error", async () => {
    await expect(storage.delete("users/u1/missing/original.pdf")).resolves.toBeUndefined();
  });

  it("rejects keys that escape the storage root", async () => {
    await expect(storage.delete("../outside.pdf")).rejects.toThrow("Invalid storage key");
    await expect(storage.get("users/../../etc/passwd")).rejects.toThrow("Invalid storage key");
  });
});
