/**
 * Scan-to-URL routes
 *
 *  POST /scanner/receive          — physical scanner POSTs a document here
 *  GET  /scanner/events           — SSE stream for the upload page
 *  POST /admin/scanner/regen-key  — admin regenerates the scanner API key
 */

import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, settingsTable, documentsTable, auditLogsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { scannerBus } from "../lib/scanner-events";
import { getWatcherStatus } from "../lib/scanner-watcher";
import { dispatchDocument } from "../lib/dispatch-document";

const router: IRouter = Router();

// ── multer setup (same uploads dir as documents route) ───────────────────────
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `scan-${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/tiff"];
    cb(null, ok.includes(file.mimetype));
  },
});

// ── helpers ──────────────────────────────────────────────────────────────────
async function getOrCreateKey(): Promise<string> {
  const [s] = await db.select().from(settingsTable).limit(1);
  if (s?.scannerApiKey) return s.scannerApiKey;

  const key = `dsk_${crypto.randomBytes(24).toString("hex")}`;
  if (s) {
    await db.update(settingsTable).set({ scannerApiKey: key }).where(eq(settingsTable.id, s.id));
  } else {
    await db.insert(settingsTable).values({ scannerApiKey: key });
  }
  return key;
}

async function validateScannerKey(req: Request): Promise<boolean> {
  const key =
    req.query["key"] as string | undefined ||
    req.headers["x-scanner-key"] as string | undefined ||
    (req.headers["authorization"] ?? "").toString().replace(/^Bearer\s+/i, "");

  if (!key) return false;
  const [s] = await db.select().from(settingsTable).limit(1);
  return s?.scannerApiKey === key;
}

async function getFirstAdmin() {
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
  return admins[0] ?? null;
}

// ── POST /scanner/receive ─────────────────────────────────────────────────────
router.post(
  "/scanner/receive",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const valid = await validateScannerKey(req);
    if (!valid) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(401).json({ error: "Invalid or missing scanner API key" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file received. Send the document as multipart field named 'file'." });
      return;
    }

    const admin = await getFirstAdmin();
    if (!admin) {
      fs.unlink(req.file.path, () => {});
      res.status(503).json({ error: "No admin user found to associate the scan with" });
      return;
    }

    const [doc] = await db.insert(documentsTable).values({
      userId: admin.id,
      fileName: req.file.originalname || req.file.filename,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      source: "scanner",
    }).returning();

    await db.insert(auditLogsTable).values({
      action: "scanner_receive",
      userId: admin.id,
      details: `Physical scanner delivered: ${doc.fileName} (${(req.file.size / 1024).toFixed(1)} KB)`,
      ipAddress: req.ip,
    });

    // Notify all listening SSE clients
    scannerBus.emit("scan", { docId: doc.id, fileName: doc.fileName });

    logger.info({ docId: doc.id, fileName: doc.fileName }, "Scanner: document received");

    // Auto-dispatch if the setting is enabled (fire-and-forget — don't block the 201 response)
    const [settings] = await db.select({ scannerAutoDispatch: settingsTable.scannerAutoDispatch }).from(settingsTable).limit(1);
    if (settings?.scannerAutoDispatch) {
      dispatchDocument(doc.id, admin.id, req.ip ?? "127.0.0.1").catch((err) =>
        logger.error({ err, docId: doc.id }, "Scanner: auto-dispatch failed"),
      );
    }

    res.status(201).json({ success: true, docId: doc.id, fileName: doc.fileName, autoDispatched: !!settings?.scannerAutoDispatch });
  }
);

// ── GET /scanner/events — SSE ─────────────────────────────────────────────────
router.get("/scanner/events", requireAuth, (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Heartbeat every 20s to keep connection alive through proxies
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 20_000);

  const onScan = (data: { docId: number; fileName: string }) => {
    res.write(`event: scan\ndata: ${JSON.stringify(data)}\n\n`);
  };

  scannerBus.on("scan", onScan);

  req.on("close", () => {
    clearInterval(heartbeat);
    scannerBus.off("scan", onScan);
  });
});

// ── POST /admin/scanner/regen-key ─────────────────────────────────────────────
router.post("/admin/scanner/regen-key", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const [s] = await db.select().from(settingsTable).limit(1);
  const key = `dsk_${crypto.randomBytes(24).toString("hex")}`;

  if (s) {
    await db.update(settingsTable).set({ scannerApiKey: key }).where(eq(settingsTable.id, s.id));
  } else {
    await db.insert(settingsTable).values({ scannerApiKey: key });
  }

  await db.insert(auditLogsTable).values({
    action: "scanner_key_regenerated",
    userId: req.user!.id,
    details: "Scanner API key regenerated",
    ipAddress: req.ip,
  });

  res.json({ success: true, scannerApiKey: key });
});

// ── GET /admin/scanner/key ────────────────────────────────────────────────────
router.get("/admin/scanner/key", requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const key = await getOrCreateKey();
  res.json({ scannerApiKey: key });
});

// ── GET /scanner/config — any authenticated user can read scanner display config
router.get("/scanner/config", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const [s] = await db.select().from(settingsTable).limit(1);
  res.json({
    scannerWatchPath: s?.scannerWatchPath ?? null,
    scannerAutoDispatch: s?.scannerAutoDispatch ?? false,
  });
});

// ── GET /scanner/watcher-status — live watcher diagnostics
router.get("/scanner/watcher-status", requireAuth, (_req: Request, res: Response): void => {
  res.json(getWatcherStatus());
});

// ── GET /scanner/bridge-script — download the Windows bridge script ────────────
router.get("/scanner/bridge-script", requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Resolve path relative to monorepo root (two levels above api-server cwd)
  const candidates = [
    path.join(process.cwd(), "../../deploy/scanner-bridge.mjs"),
    path.join(process.cwd(), "../../../deploy/scanner-bridge.mjs"),
    path.join(process.cwd(), "deploy/scanner-bridge.mjs"),
  ];
  const scriptPath = candidates.find((p) => fs.existsSync(p));
  if (!scriptPath) {
    res.status(404).json({ error: "Bridge script not found on server" });
    return;
  }
  res.setHeader("Content-Disposition", 'attachment; filename="scanner-bridge.mjs"');
  res.setHeader("Content-Type", "text/javascript");
  res.sendFile(path.resolve(scriptPath));
});

export default router;
