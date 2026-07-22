import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

async function ensureSettings() {
  const existing = await db.select().from(settingsTable).limit(1);
  if (existing.length === 0) {
    const [s] = await db.insert(settingsTable).values({
      maxRecipients: 5,
      maxFileSizeMb: 10,
      allowedFileTypes: "pdf,jpg,jpeg,png",
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

  const updates: Record<string, any> = {};
  if (req.body.smtpHost !== undefined) updates.smtpHost = req.body.smtpHost;
  if (req.body.smtpPort !== undefined) updates.smtpPort = Number(req.body.smtpPort);
  if (req.body.smtpUser !== undefined) updates.smtpUser = req.body.smtpUser;
  if (req.body.smtpPass !== undefined) updates.smtpPass = req.body.smtpPass;
  if (req.body.maxRecipients !== undefined) updates.maxRecipients = Math.min(5, Math.max(1, Number(req.body.maxRecipients)));
  if (req.body.maxFileSizeMb !== undefined) updates.maxFileSizeMb = Math.max(1, Number(req.body.maxFileSizeMb));
  if (req.body.allowedFileTypes !== undefined) updates.allowedFileTypes = req.body.allowedFileTypes;

  const [updated] = await db
    .update(settingsTable)
    .set(updates)
    .where(eq(settingsTable.id, settings.id))
    .returning();

  await db.insert(auditLogsTable).values({
    action: "settings_updated",
    userId: req.user!.id,
    details: `Updated system settings`,
    ipAddress: req.ip,
  });

  res.json(updated);
});

export default router;
