import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, desc, isNull, and } from "drizzle-orm";
import { db, documentsTable, emailLogsTable, recipientsTable, settingsTable, auditLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { sendEmailBatch, resolveFromAddress } from "../lib/email";

const router: IRouter = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB hard max, per-setting checked below
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPG, and PNG are allowed."));
    }
  },
});

// POST /documents/upload — multipart file upload
router.post("/documents/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  // Check settings for max file size
  const [settings] = await db.select().from(settingsTable).limit(1);
  const maxMb = settings?.maxFileSizeMb ?? 10;
  if (req.file.size > maxMb * 1024 * 1024) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: `File exceeds the ${maxMb}MB limit` });
    return;
  }

  const [doc] = await db.insert(documentsTable).values({
    userId: req.user!.id,
    fileName: req.file.originalname,
    filePath: req.file.path,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
  }).returning();

  await db.insert(auditLogsTable).values({
    action: "document_upload",
    userId: req.user!.id,
    details: `Uploaded document: ${req.file.originalname}`,
    ipAddress: req.ip,
  });

  res.status(201).json(doc);
});

// GET /documents/history — user's own history
router.get("/documents/history", requireAuth, async (req, res): Promise<void> => {
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.userId, req.user!.id))
    .orderBy(desc(documentsTable.uploadedAt));

  const docsWithLogs = await Promise.all(
    docs.map(async (doc) => {
      const logs = await db
        .select()
        .from(emailLogsTable)
        .where(eq(emailLogsTable.documentId, doc.id))
        .orderBy(desc(emailLogsTable.sentAt));
      return {
        ...doc,
        emailLogs: logs.map((l) => ({
          ...l,
          documentName: doc.fileName,
          senderName: req.user!.name,
        })),
      };
    })
  );

  res.json(docsWithLogs);
});

// POST /documents/:id/send — send document to configured recipients
router.post("/documents/:id/send", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const docId = parseInt(rawId, 10);

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, docId));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Check user owns this doc (or is admin)
  if (doc.userId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Get active recipients: user-specific first, then global
  const userRecipients = await db
    .select()
    .from(recipientsTable)
    .where(and(eq(recipientsTable.userId, req.user!.id), eq(recipientsTable.isActive, true)));

  const globalRecipients = await db
    .select()
    .from(recipientsTable)
    .where(and(isNull(recipientsTable.userId), eq(recipientsTable.isActive, true)));

  const recipients = userRecipients.length > 0 ? userRecipients : globalRecipients;

  if (recipients.length === 0) {
    res.status(400).json({ error: "No recipients configured. Ask your administrator to set up recipients." });
    return;
  }

  // Get SMTP settings
  const [settings] = await db.select().from(settingsTable).limit(1);

  // Create initial queued log entries
  const logEntries = await Promise.all(
    recipients.map(async (r) => {
      const [log] = await db.insert(emailLogsTable).values({
        documentId: doc.id,
        senderId: req.user!.id,
        recipientEmail: r.recipientEmail,
        status: "queued",
        sentAt: new Date(),
      }).returning();
      return log;
    })
  );

  // Send all emails in a single Resend batch call to avoid rate-limiting
  const fromAddress = resolveFromAddress(settings?.smtpUser);

  const { results: batchResults } = await sendEmailBatch(
    logEntries.map((entry) => ({
      from: fromAddress,
      to: entry.recipientEmail,
      subject: `Document: ${doc.fileName}`,
      text: `${req.user!.name} has sent you a document: ${doc.fileName}`,
      attachmentPath: doc.filePath,
      attachmentName: doc.fileName,
    }))
  );

  // Persist the per-recipient outcome
  type LogEntry = (typeof logEntries)[number];
  const sendResults: LogEntry[] = [];

  for (let i = 0; i < logEntries.length; i++) {
    const entry = logEntries[i];
    const result = batchResults[i];
    const sent = result.success;

    if (!sent) {
      req.log.error({ error: result.error, recipient: entry.recipientEmail }, "Failed to send email via Resend");
    }

    const nextStatus = sent ? "sent" : "retry_pending";
    const nextRetryAt = sent ? null : new Date(Date.now() + 60_000);

    const [updated] = await db
      .update(emailLogsTable)
      .set({
        status: nextStatus,
        messageId: result.messageId ?? null,
        errorMessage: result.error ?? null,
        retryCount: sent ? 0 : 1,
        nextRetryAt,
      })
      .where(eq(emailLogsTable.id, entry.id))
      .returning();

    sendResults.push(updated);
  }

  await db.insert(auditLogsTable).values({
    action: "document_send",
    userId: req.user!.id,
    details: `Sent document ${doc.fileName} to ${recipients.length} recipient(s)`,
    ipAddress: req.ip,
  });

  const allSuccess = sendResults.every((r) => r.status === "sent");

  res.json({
    success: allSuccess,
    message: allSuccess
      ? `Document sent to ${sendResults.length} recipient(s)`
      : `Some deliveries failed`,
    logs: sendResults.map((l) => ({
      ...l,
      documentName: doc.fileName,
      senderName: req.user!.name,
    })),
  });
});

export default router;
