"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { describeError } from "@/lib/errors";
import { confirmationMatches, DELETE_DOCUMENTS_WORD, parseReminderOffsets } from "@/lib/settings";

import { auditInsert } from "../audit";
import { auth } from "../auth";
import { db } from "../db";
import {
  auditLog,
  documents,
  reminders,
  tasks,
  userSettings,
  users,
  workEntries,
} from "../db/schema";
import { reminderOffsets } from "../queries/review";
import { requireSession } from "../session";
import { storage } from "../storage";

export type SettingsResult =
  { ok: true } | { ok: false; error: "invalid" | "confirmation" | "failed" };

/** Changes the reminder schedule. Applies to tasks created from now on. */
export async function updateReminderOffsets(input: string): Promise<SettingsResult> {
  const { user } = await requireSession();
  const offsets = parseReminderOffsets(String(input ?? ""));
  if (!offsets) return { ok: false, error: "invalid" };

  const before = await reminderOffsets(user.id);
  await db.batch([
    db
      .insert(userSettings)
      .values({ userId: user.id, reminderOffsetDays: offsets })
      .onConflictDoUpdate({ target: userSettings.userId, set: { reminderOffsetDays: offsets } }),
    auditInsert({
      userId: user.id,
      actor: "user",
      action: "settings.reminders_changed",
      entityType: "settings",
      entityId: user.id,
      before: { reminderOffsetDays: before },
      after: { reminderOffsetDays: offsets },
    }),
  ]);
  revalidatePath("/settings");
  return { ok: true };
}

/** Removes stored originals; failures are logged, the database is the source of truth. */
async function deleteFiles(keys: string[]) {
  const results = await Promise.allSettled(keys.map((key) => storage().delete(key)));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.error(
      `Could not delete ${failed.length} stored file(s): ${describeError((failed[0] as PromiseRejectedResult).reason)}`,
    );
  }
}

/**
 * Deletes every document with its fields, pages, tasks, reminders, work days and
 * the history log. The account and its settings stay. Requires the typed word.
 */
export async function deleteAllDocuments(confirmation: string): Promise<SettingsResult> {
  const { user } = await requireSession();
  const typed = String(confirmation ?? "");
  if (!Object.values(DELETE_DOCUMENTS_WORD).some((word) => confirmationMatches(typed, word))) {
    return { ok: false, error: "confirmation" };
  }

  const stored = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(eq(documents.userId, user.id));

  await db.batch([
    db.delete(reminders).where(eq(reminders.userId, user.id)),
    db.delete(tasks).where(eq(tasks.userId, user.id)),
    db.delete(workEntries).where(eq(workEntries.userId, user.id)),
    // Fields and pages cascade from documents.
    db.delete(documents).where(eq(documents.userId, user.id)),
    db.delete(auditLog).where(eq(auditLog.userId, user.id)),
    // The one entry that remains: that this happened.
    auditInsert({
      userId: user.id,
      actor: "user",
      action: "documents.deleted_all",
      entityType: "settings",
      entityId: user.id,
      after: { documents: stored.length },
    }),
  ]);
  await deleteFiles(stored.map((row) => row.storageKey));

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Closes the account: signs out, deletes the user (everything else cascades:
 * sessions, settings, documents, tasks, history) and the stored originals.
 * Requires typing the account's email address.
 */
export async function deleteAccount(confirmation: string): Promise<SettingsResult> {
  const { user } = await requireSession();
  if (!confirmationMatches(String(confirmation ?? ""), user.email)) {
    return { ok: false, error: "confirmation" };
  }

  const stored = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(eq(documents.userId, user.id));

  try {
    // Clears the session cookie (nextCookies plugin) before the session row disappears.
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error(`Sign-out before account deletion failed: ${describeError(error)}`);
  }
  await db.delete(users).where(eq(users.id, user.id));
  await deleteFiles(stored.map((row) => row.storageKey));

  return { ok: true };
}
