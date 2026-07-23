/**
 * Document retention worker.
 *
 * Runs every 6 hours and permanently deletes documents (file + DB row)
 * that were uploaded more than `settings.retentionDays` days ago.
 * Related email_logs rows are cascade-deleted at the DB level.
 */

import fs from "node:fs/promises";
import { lt, sql } from "drizzle-orm";
import { db, documentsTable, settingsTable } from "@workspace/db";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let isRunning = false;

async function processRetention(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    await _processRetention();
  } finally {
    isRunning = false;
  }
}

async function _processRetention(): Promise<void> {
  // Load retention setting
  const [settings] = await db.select().from(settingsTable).limit(1);
  const days = settings?.retentionDays ?? 30;

  if (days <= 0) {
    logger.info("Retention worker: retention disabled (days=0), skipping");
    return;
  }

  // Find expired documents
  const cutoff = sql`now() - interval '${sql.raw(String(days))} days'`;
  const expired = await db
    .select({ id: documentsTable.id, filePath: documentsTable.filePath, fileName: documentsTable.fileName })
    .from(documentsTable)
    .where(lt(documentsTable.uploadedAt, cutoff));

  if (expired.length === 0) return;

  logger.info({ count: expired.length, retentionDays: days }, "Retention worker: deleting expired documents");

  let deleted = 0;
  for (const doc of expired) {
    try {
      // Delete physical file (ignore missing-file errors)
      if (doc.filePath) {
        await fs.unlink(doc.filePath).catch(() => undefined);
      }

      // Delete DB row (email_logs cascade via FK)
      await db.delete(documentsTable).where(
        sql`${documentsTable.id} = ${doc.id}`
      );

      deleted++;
      logger.info({ docId: doc.id, fileName: doc.fileName }, "Retention worker: document purged");
    } catch (err) {
      logger.error({ err, docId: doc.id }, "Retention worker: failed to delete document");
    }
  }

  logger.info({ deleted, total: expired.length }, "Retention worker: cycle complete");
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startRetentionWorker(): void {
  if (intervalHandle) return;

  // Run once immediately
  processRetention().catch((err) =>
    logger.error({ err }, "Retention worker: error during initial run")
  );

  intervalHandle = setInterval(() => {
    processRetention().catch((err) =>
      logger.error({ err }, "Retention worker: error during poll")
    );
  }, POLL_INTERVAL_MS);

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Document retention worker started");
}

export function stopRetentionWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
