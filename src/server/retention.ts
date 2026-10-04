import { and, eq, inArray, lt } from "drizzle-orm";

import { DEFAULT_RETENTION_MONTHS, retentionCutoff } from "@/lib/deletion";

import { db } from "./db";
import { auditLog, userSettings, users } from "./db/schema";

/**
 * Deletes history entries past each user's retention period. Returns how many were
 * removed. `userIds` limits it to some users (tests); the daily job covers everyone.
 */
export async function purgeExpiredHistory(now: Date, userIds?: string[]): Promise<number> {
  const rows = await db
    .select({ userId: users.id, months: userSettings.historyRetentionMonths })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(userIds ? inArray(users.id, userIds) : undefined);

  const deletes = rows.flatMap((row) => {
    const cutoff = retentionCutoff(row.months ?? DEFAULT_RETENTION_MONTHS, now);
    return cutoff
      ? [
          db
            .delete(auditLog)
            .where(and(eq(auditLog.userId, row.userId), lt(auditLog.createdAt, cutoff)))
            .returning({ id: auditLog.id }),
        ]
      : [];
  });
  if (deletes.length === 0) return 0;

  const [first, ...rest] = deletes;
  const results = await db.batch([first, ...rest]);
  return results.reduce((sum, removed) => sum + removed.length, 0);
}
