import { Router, type IRouter } from "express";
import { eq, isNull, sql } from "drizzle-orm";
import { db, recipientsTable, settingsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /admin/recipients
router.get("/admin/recipients", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const recipients = await db
    .select()
    .from(recipientsTable)
    .orderBy(recipientsTable.createdAt);
  res.json(recipients);
});

// POST /admin/recipients
router.post("/admin/recipients", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { recipientEmail, userId } = req.body;

  if (!recipientEmail) {
    res.status(400).json({ error: "Recipient email is required" });
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  // Check max recipients limit
  const [settings] = await db.select().from(settingsTable).limit(1);
  const maxRecipients = settings?.maxRecipients ?? 5;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipientsTable)
    .where(isNull(recipientsTable.userId));

  if (Number(countRow?.count ?? 0) >= maxRecipients) {
    res.status(400).json({ error: `Maximum of ${maxRecipients} recipients allowed` });
    return;
  }

  // Check for duplicate
  const existing = await db
    .select()
    .from(recipientsTable)
    .where(eq(recipientsTable.recipientEmail, recipientEmail.toLowerCase().trim()));

  if (existing.length > 0) {
    res.status(400).json({ error: "Recipient already exists" });
    return;
  }

  const [recipient] = await db.insert(recipientsTable).values({
    recipientEmail: recipientEmail.toLowerCase().trim(),
    userId: userId ?? null,
  }).returning();

  await db.insert(auditLogsTable).values({
    action: "recipient_added",
    userId: req.user!.id,
    details: `Added recipient: ${recipientEmail}`,
    ipAddress: req.ip,
  });

  res.status(201).json(recipient);
});

// PUT /admin/recipients/:id — update email address
router.put("/admin/recipients/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const { recipientEmail } = req.body;

  if (!recipientEmail) {
    res.status(400).json({ error: "Recipient email is required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const [existing] = await db.select().from(recipientsTable).where(eq(recipientsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }

  // Check for duplicate (excluding self)
  const dupe = await db
    .select()
    .from(recipientsTable)
    .where(eq(recipientsTable.recipientEmail, recipientEmail.toLowerCase().trim()));

  if (dupe.length > 0 && dupe[0].id !== id) {
    res.status(400).json({ error: "That email is already in the list" });
    return;
  }

  const [updated] = await db
    .update(recipientsTable)
    .set({ recipientEmail: recipientEmail.toLowerCase().trim() })
    .where(eq(recipientsTable.id, id))
    .returning();

  await db.insert(auditLogsTable).values({
    action: "recipient_updated",
    userId: req.user!.id,
    details: `Updated recipient: ${existing.recipientEmail} → ${updated.recipientEmail}`,
    ipAddress: req.ip,
  });

  res.json(updated);
});

// PATCH /admin/recipients/:id — toggle active/inactive
router.patch("/admin/recipients/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [existing] = await db.select().from(recipientsTable).where(eq(recipientsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }

  const [updated] = await db
    .update(recipientsTable)
    .set({ isActive: !existing.isActive })
    .where(eq(recipientsTable.id, id))
    .returning();

  await db.insert(auditLogsTable).values({
    action: updated.isActive ? "recipient_activated" : "recipient_deactivated",
    userId: req.user!.id,
    details: `${updated.isActive ? "Activated" : "Deactivated"} recipient: ${existing.recipientEmail}`,
    ipAddress: req.ip,
  });

  res.json(updated);
});

// DELETE /admin/recipients/:id
router.delete("/admin/recipients/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [existing] = await db.select().from(recipientsTable).where(eq(recipientsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }

  await db.delete(recipientsTable).where(eq(recipientsTable.id, id));

  await db.insert(auditLogsTable).values({
    action: "recipient_removed",
    userId: req.user!.id,
    details: `Removed recipient: ${existing.recipientEmail}`,
    ipAddress: req.ip,
  });

  res.sendStatus(204);
});

export default router;
