/**
 * Shared auto-dispatch utility.
 *
 * Sends a document to all active global recipients via Resend and writes
 * email_logs rows for every attempt. Used by:
 *   - POST /scanner/receive  (auto-dispatch on ingest when scannerAutoDispatch=true)
 *   - scanner-watcher.ts     (server-side watcher auto-dispatch)
 *
 * Returns the number of recipients dispatched to, or 0 if none configured.
 */

import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  documentsTable,
  emailLogsTable,
  recipientsTable,
  settingsTable,
} from "@workspace/db";
import { sendEmailBatch, resolveFromAddress } from "./email";
import { logger } from "./logger";

export async function dispatchDocument(
  docId: number,
  senderId: number,
  senderIp: string = "127.0.0.1",
): Promise<number> {
  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, docId));

  if (!doc) {
    logger.warn({ docId }, "dispatchDocument: document not found");
    return 0;
  }

  // Global active recipients only (scanner sends to everyone)
  const recipients = await db
    .select()
    .from(recipientsTable)
    .where(and(isNull(recipientsTable.userId), eq(recipientsTable.isActive, true)));

  if (recipients.length === 0) {
    logger.warn({ docId }, "dispatchDocument: no active global recipients — skipping");
    return 0;
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  const fromAddress = resolveFromAddress(settings?.smtpUser);

  // Create queued log rows first
  const logEntries = await Promise.all(
    recipients.map((r) =>
      db
        .insert(emailLogsTable)
        .values({
          documentId: doc.id,
          senderId,
          recipientEmail: r.recipientEmail,
          status: "queued",
          sentAt: new Date(),
        })
        .returning()
        .then(([row]) => row),
    ),
  );

  // Send the batch
  const { results } = await sendEmailBatch(
    logEntries.map((entry) => ({
      from: fromAddress,
      to: entry.recipientEmail,
      subject: `Document: ${doc.fileName}`,
      text: `A new document has been scanned and dispatched to you.`,
      attachmentPath: doc.filePath,
      attachmentName: doc.fileName,
    })),
  );

  // Persist outcomes
  for (let i = 0; i < logEntries.length; i++) {
    const entry  = logEntries[i];
    const result = results[i];
    const sent   = result.success;

    await db
      .update(emailLogsTable)
      .set({
        status:       sent ? "sent" : "retry_pending",
        messageId:    result.messageId ?? null,
        errorMessage: result.error ?? null,
        retryCount:   sent ? 0 : 1,
        nextRetryAt:  sent ? null : new Date(Date.now() + 60_000),
      })
      .where(eq(emailLogsTable.id, entry.id));
  }

  logger.info({ docId, recipients: recipients.length }, "dispatchDocument: complete");
  return recipients.length;
}
