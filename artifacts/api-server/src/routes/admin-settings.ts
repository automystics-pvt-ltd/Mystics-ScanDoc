import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { sendTestEmail } from "../lib/email";

const router: IRouter = Router();

async function ensureSettings() {
  const existing = await db.select().from(settingsTable).limit(1);
  if (existing.length === 0) {
    const [s] = await db.insert(settingsTable).values({
      maxRecipients: 5,
      maxFileSizeMb: 10,
      allowedFileTypes: "pdf,jpg,jpeg,png",
      emailProvider: "resend",
      notificationChannels: "email",
      defaultNotificationChannel: "email",
      retentionDays: 30,
      scannerPaperSize: "A4",
      scannerResolutionDpi: 300,
      scannerColorMode: "color",
      scannerFileFormat: "pdf",
      scannerDuplex: false,
      scannerBrightness: 0,
      scannerContrast: 0,
    }).returning();
    return s;
  }
  return existing[0];
}

// GET /admin/settings
router.get("/admin/settings", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const settings = await ensureSettings();
  res.json(settings);
});

// PUT /admin/settings
router.put("/admin/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const settings = await ensureSettings();
  const b = req.body;

  const updates: Record<string, any> = {};

  // ── Email transport (legacy SMTP) ────────────────────────────────────────
  if (b.smtpHost !== undefined) updates.smtpHost = b.smtpHost;
  if (b.smtpPort !== undefined) updates.smtpPort = Number(b.smtpPort);
  if (b.smtpUser !== undefined) updates.smtpUser = b.smtpUser;
  if (b.smtpPass !== undefined) updates.smtpPass = b.smtpPass;

  // ── Email provider ───────────────────────────────────────────────────────
  if (b.emailProvider !== undefined) updates.emailProvider = b.emailProvider;
  if (b.emailProviderApiKey !== undefined) updates.emailProviderApiKey = b.emailProviderApiKey;
  if (b.emailProviderDomain !== undefined) updates.emailProviderDomain = b.emailProviderDomain;

  // ── SMS provider ─────────────────────────────────────────────────────────
  if (b.smsEnabled !== undefined) updates.smsEnabled = Boolean(b.smsEnabled);
  if (b.smsProvider !== undefined) updates.smsProvider = b.smsProvider;
  if (b.smsProviderApiKey !== undefined) updates.smsProviderApiKey = b.smsProviderApiKey;
  if (b.smsProviderSecret !== undefined) updates.smsProviderSecret = b.smsProviderSecret;
  if (b.smsProviderFrom !== undefined) updates.smsProviderFrom = b.smsProviderFrom;

  // ── WhatsApp provider ────────────────────────────────────────────────────
  if (b.whatsappEnabled !== undefined) updates.whatsappEnabled = Boolean(b.whatsappEnabled);
  if (b.whatsappProvider !== undefined) updates.whatsappProvider = b.whatsappProvider;
  if (b.whatsappProviderApiKey !== undefined) updates.whatsappProviderApiKey = b.whatsappProviderApiKey;
  if (b.whatsappProviderFrom !== undefined) updates.whatsappProviderFrom = b.whatsappProviderFrom;

  // ── Notification channels ────────────────────────────────────────────────
  if (b.notificationChannels !== undefined) updates.notificationChannels = b.notificationChannels;
  if (b.defaultNotificationChannel !== undefined) updates.defaultNotificationChannel = b.defaultNotificationChannel;

  // ── Document constraints ─────────────────────────────────────────────────
  if (b.maxRecipients !== undefined) updates.maxRecipients = Math.min(10, Math.max(1, Number(b.maxRecipients)));
  if (b.maxFileSizeMb !== undefined) updates.maxFileSizeMb = Math.max(1, Number(b.maxFileSizeMb));
  if (b.allowedFileTypes !== undefined) updates.allowedFileTypes = b.allowedFileTypes;

  // ── Retention policy ─────────────────────────────────────────────────────
  if (b.retentionDays !== undefined) updates.retentionDays = Math.max(0, Math.min(3650, Number(b.retentionDays)));

  // ── Scanner settings ─────────────────────────────────────────────────────
  if (b.scannerName !== undefined) updates.scannerName = b.scannerName;
  if (b.scannerPaperSize !== undefined) updates.scannerPaperSize = b.scannerPaperSize;
  if (b.scannerResolutionDpi !== undefined) updates.scannerResolutionDpi = Number(b.scannerResolutionDpi);
  if (b.scannerColorMode !== undefined) updates.scannerColorMode = b.scannerColorMode;
  if (b.scannerFileFormat !== undefined) updates.scannerFileFormat = b.scannerFileFormat;
  if (b.scannerDuplex !== undefined) updates.scannerDuplex = Boolean(b.scannerDuplex);
  if (b.scannerBrightness !== undefined) updates.scannerBrightness = Math.max(-100, Math.min(100, Number(b.scannerBrightness)));
  if (b.scannerContrast !== undefined) updates.scannerContrast = Math.max(-100, Math.min(100, Number(b.scannerContrast)));
  if (b.scannerWatchPath !== undefined) updates.scannerWatchPath = b.scannerWatchPath;
  if (b.scannerAutoDispatch !== undefined) updates.scannerAutoDispatch = Boolean(b.scannerAutoDispatch);

  const [updated] = await db
    .update(settingsTable)
    .set(updates)
    .where(eq(settingsTable.id, settings.id))
    .returning();

  await db.insert(auditLogsTable).values({
    action: "settings_updated",
    userId: req.user!.id,
    details: `Updated system settings (fields: ${Object.keys(updates).join(", ")})`,
    ipAddress: req.ip,
  });

  res.json(updated);
});

// POST /admin/test-email
router.post("/admin/test-email", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { to } = req.body;
  if (!to || typeof to !== "string") {
    res.status(400).json({ error: "Recipient email address required" });
    return;
  }

  const result = await sendTestEmail(to);

  if (!result.success) {
    res.status(502).json({ error: result.error ?? "Failed to send test email" });
    return;
  }

  await db.insert(auditLogsTable).values({
    action: "test_email_sent",
    userId: req.user!.id,
    details: `Sent test email to ${to}`,
    ipAddress: req.ip,
  });

  res.json({ success: true, messageId: result.messageId });
});

export default router;
