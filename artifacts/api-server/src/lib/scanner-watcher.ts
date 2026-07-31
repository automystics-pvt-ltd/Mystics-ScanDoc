/**
 * Server-side folder watcher.
 *
 * Reads `scannerWatchPath` from the settings table and watches that
 * directory with chokidar. Every qualifying file that appears (and has not
 * already been ingested) is:
 *   1. Copied to the local uploads/ directory.
 *   2. Inserted into the documents table (source = 'scanner').
 *   3. Optionally auto-dispatched if scannerAutoDispatch is true.
 *
 * The watcher re-checks settings every 30 s so that admin path changes
 * take effect without a server restart.
 */

import chokidar, { type FSWatcher } from "chokidar";
import fs from "fs";
import path from "path";
import { eq, and } from "drizzle-orm";
import {
  db,
  documentsTable,
  settingsTable,
  recipientsTable,
  emailLogsTable,
  auditLogsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { sendEmailBatch, resolveFromAddress } from "./email";

const SCAN_EXTS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff"]);
const uploadsDir = path.join(process.cwd(), "uploads");
const SETTINGS_POLL_MS = 30_000;

let watcher: FSWatcher | null = null;
let currentWatchPath = "";
let systemUserId: number | null = null;

// ── helpers ──────────────────────────────────────────────────────────────────

async function getSystemUser(): Promise<number | null> {
  if (systemUserId !== null) return systemUserId;
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);
  if (admin) { systemUserId = admin.id; return admin.id; }
  return null;
}

async function isAlreadyIngested(sourcePath: string): Promise<boolean> {
  const [row] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(eq(documentsTable.sourcePath, sourcePath))
    .limit(1);
  return !!row;
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case ".pdf":  return "application/pdf";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png":  return "image/png";
    case ".tif":
    case ".tiff": return "image/tiff";
    default:      return "application/octet-stream";
  }
}

// ── ingest a file ─────────────────────────────────────────────────────────────

async function ingestFile(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCAN_EXTS.has(ext)) return;

  // Skip if already in DB
  if (await isAlreadyIngested(filePath)) return;

  const userId = await getSystemUser();
  if (!userId) {
    logger.warn("Scanner watcher: no admin user found — cannot ingest file");
    return;
  }

  // Wait for the file to be fully written
  await new Promise((r) => setTimeout(r, 800));

  let stat: fs.Stats;
  try { stat = fs.statSync(filePath); }
  catch { logger.warn({ filePath }, "Scanner watcher: file gone before stat"); return; }

  if (stat.size === 0) return;

  // Copy to uploads dir
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const destName = `scan-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  const destPath = path.join(uploadsDir, destName);
  try {
    fs.copyFileSync(filePath, destPath);
  } catch (err) {
    logger.error({ err, filePath }, "Scanner watcher: copy failed");
    return;
  }

  const [doc] = await db.insert(documentsTable).values({
    userId,
    fileName: path.basename(filePath),
    filePath: destPath,
    fileType: mimeFromExt(ext),
    fileSize: stat.size,
    source: "scanner",
    sourcePath: filePath,
  }).returning();

  logger.info({ docId: doc.id, file: doc.fileName }, "Scanner watcher: file ingested");

  await db.insert(auditLogsTable).values({
    action: "document_upload",
    userId,
    details: `Scanner auto-ingested: ${doc.fileName}`,
    ipAddress: "127.0.0.1",
  });

  // Auto-dispatch if enabled
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (settings?.scannerAutoDispatch) {
    await autoDispatch(doc, userId, settings);
  }
}

async function autoDispatch(
  doc: typeof documentsTable.$inferSelect,
  userId: number,
  settings: typeof settingsTable.$inferSelect,
): Promise<void> {
  const recipients = await db.select().from(recipientsTable).where(eq(recipientsTable.isActive, true));
  if (recipients.length === 0) {
    logger.warn({ docId: doc.id }, "Scanner auto-dispatch: no active recipients");
    return;
  }

  const fromAddress = resolveFromAddress(settings.smtpUser);

  const logEntries = await Promise.all(
    recipients.map((r) =>
      db.insert(emailLogsTable).values({
        documentId: doc.id,
        senderId: userId,
        recipientEmail: r.email,
        status: "queued",
      }).returning().then(([row]) => row)
    )
  );

  const batchResults = await sendEmailBatch(
    recipients.map((r) => ({
      from: fromAddress,
      to: r.email,
      subject: `Document: ${doc.fileName}`,
      text: `A new document has been scanned and dispatched to you.`,
      attachmentPath: doc.filePath,
      attachmentName: doc.fileName,
    }))
  );

  for (let i = 0; i < logEntries.length; i++) {
    const entry = logEntries[i];
    const result = batchResults[i];
    const sent = result.success;
    await db.update(emailLogsTable).set({
      status: sent ? "sent" : "retry_pending",
      messageId: result.messageId ?? null,
      errorMessage: result.error ?? null,
      retryCount: sent ? 0 : 1,
      nextRetryAt: sent ? null : new Date(Date.now() + 60_000),
    }).where(eq(emailLogsTable.id, entry.id));
  }

  logger.info({ docId: doc.id, recipients: recipients.length }, "Scanner auto-dispatch complete");
}

// ── watcher lifecycle ─────────────────────────────────────────────────────────

function startWatchDir(watchPath: string): void {
  if (!watchPath) return;
  if (!fs.existsSync(watchPath)) {
    logger.warn({ watchPath }, "Scanner watcher: path does not exist (will retry when settings change)");
    currentWatchPath = watchPath;
    return;
  }

  watcher = chokidar.watch(watchPath, {
    persistent: true,
    ignoreInitial: false,          // pick up existing files on (re)start
    depth: 0,                      // only top-level files
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    },
  });

  watcher.on("add", (fp) => {
    ingestFile(fp).catch((err) =>
      logger.error({ err, fp }, "Scanner watcher: ingest error")
    );
  });

  currentWatchPath = watchPath;
  logger.info({ watchPath }, "Scanner watcher: started");
}

async function checkSettings(): Promise<void> {
  const [settings] = await db.select({
    scannerWatchPath: settingsTable.scannerWatchPath,
  }).from(settingsTable).limit(1);

  const newPath = settings?.scannerWatchPath ?? "";
  if (newPath === currentWatchPath) return;

  if (watcher) {
    await watcher.close();
    watcher = null;
    logger.info("Scanner watcher: stopped (path changed)");
  }

  currentWatchPath = newPath;
  if (newPath) startWatchDir(newPath);
}

export async function startScannerWatcher(): Promise<void> {
  // Start immediately with current settings
  await checkSettings();

  // Re-check every 30 s to pick up admin path changes without restart
  setInterval(() => {
    checkSettings().catch((err) =>
      logger.error({ err }, "Scanner watcher: settings poll error")
    );
  }, SETTINGS_POLL_MS);

  logger.info({ pollIntervalMs: SETTINGS_POLL_MS }, "Scanner watcher service running");
}
