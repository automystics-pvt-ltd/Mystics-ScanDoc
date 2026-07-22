/**
 * Background retry worker for failed email sends.
 *
 * Polls every 30 seconds for email_logs entries in `retry_pending` status
 * where `next_retry_at` is in the past, then re-attempts delivery.
 *
 * Backoff schedule (after initial failure):
 *   Attempt 1 → retry in 1 min  (retryCount becomes 1)
 *   Attempt 2 → retry in 5 min  (retryCount becomes 2)
 *   Attempt 3 → retry in 15 min (retryCount becomes 3)
 *   Attempt 4 → mark failed permanently
 */

import { and, eq, lte, sql } from "drizzle-orm";
import { db, emailLogsTable, documentsTable, settingsTable } from "@workspace/db";
import { sendEmail, resolveFromAddress } from "./email";
import { logger } from "./logger";

const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 30_000;

const BACKOFF_MINUTES = [1, 5, 15] as const;

function nextRetryDelay(retryCount: number): number {
  const idx = Math.min(retryCount, BACKOFF_MINUTES.length - 1);
  return BACKOFF_MINUTES[idx] * 60 * 1000;
}

/** Prevents overlapping poll cycles (e.g. slow Resend call + next tick firing). */
let isRunning = false;

async function processRetries(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    await _processRetries();
  } finally {
    isRunning = false;
  }
}

async function _processRetries(): Promise<void> {
  const now = new Date();

  // Fetch all retry_pending entries whose nextRetryAt is due
  const pending = await db
    .select({
      log: emailLogsTable,
      filePath: documentsTable.filePath,
      fileName: documentsTable.fileName,
    })
    .from(emailLogsTable)
    .leftJoin(documentsTable, eq(emailLogsTable.documentId, documentsTable.id))
    .where(
      and(
        eq(emailLogsTable.status, "retry_pending"),
        lte(emailLogsTable.nextRetryAt, sql`now()`)
      )
    );

  if (pending.length === 0) return;

  logger.info({ count: pending.length }, "Retry worker: processing due entries");

  // Resolve sender address from settings (same logic as initial send)
  const [settings] = await db.select().from(settingsTable).limit(1);
  const fromAddress = resolveFromAddress(settings?.smtpUser);

  for (const { log, filePath, fileName } of pending) {

    const result = await sendEmail({
      from: fromAddress,
      to: log.recipientEmail,
      subject: `Document: ${fileName ?? `#${log.documentId}`}`,
      text: `Your document is being re-delivered after a previous delivery failure.`,
      attachmentPath: filePath ?? undefined,
      attachmentName: fileName ?? undefined,
    });

    if (result.success) {
      await db
        .update(emailLogsTable)
        .set({
          status: "sent",
          messageId: result.messageId ?? null,
          errorMessage: null,
          sentAt: now,
        })
        .where(eq(emailLogsTable.id, log.id));

      logger.info({ logId: log.id, attempt: log.retryCount }, "Retry worker: email delivered");
    } else {
      const newRetryCount = log.retryCount + 1;

      if (newRetryCount > MAX_RETRIES) {
        // All retries exhausted — mark permanently failed
        await db
          .update(emailLogsTable)
          .set({
            status: "failed",
            errorMessage: result.error ?? "Max retries exceeded",
            nextRetryAt: null,
          })
          .where(eq(emailLogsTable.id, log.id));

        logger.warn({ logId: log.id, retryCount: log.retryCount }, "Retry worker: max retries exceeded, marking failed");
      } else {
        // Schedule next retry with backoff
        const delayMs = nextRetryDelay(newRetryCount - 1);
        const nextRetryAt = new Date(Date.now() + delayMs);

        await db
          .update(emailLogsTable)
          .set({
            status: "retry_pending",
            retryCount: newRetryCount,
            nextRetryAt,
            errorMessage: result.error ?? null,
          })
          .where(eq(emailLogsTable.id, log.id));

        logger.info(
          { logId: log.id, attempt: newRetryCount, nextRetryAt },
          "Retry worker: re-queued with backoff"
        );
      }
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startRetryWorker(): void {
  if (intervalHandle) return; // already running

  // Run once immediately on startup to catch any pending retries from before restart
  processRetries().catch((err) =>
    logger.error({ err }, "Retry worker: error during initial run")
  );

  intervalHandle = setInterval(() => {
    processRetries().catch((err) =>
      logger.error({ err }, "Retry worker: error during poll")
    );
  }, POLL_INTERVAL_MS);

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Email retry worker started");
}

export function stopRetryWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
