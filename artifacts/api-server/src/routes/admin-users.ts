import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, sql, desc } from "drizzle-orm";
import { db, usersTable, documentsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /admin/users
router.get("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  const usersWithCounts = await Promise.all(
    users.map(async (user) => {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(documentsTable)
        .where(eq(documentsTable.userId, user.id));

      const [lastDoc] = await db
        .select({ uploadedAt: documentsTable.uploadedAt })
        .from(documentsTable)
        .where(eq(documentsTable.userId, user.id))
        .orderBy(desc(documentsTable.uploadedAt))
        .limit(1);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lockedUntil: user.lockedUntil?.toISOString() ?? null,
        createdAt: user.createdAt,
        documentCount: Number(countRow?.count ?? 0),
        lastActivity: lastDoc?.uploadedAt?.toISOString() ?? null,
      };
    })
  );

  res.json(usersWithCounts);
});

// POST /admin/users
router.post("/admin/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(usersTable).values({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: role ?? "user",
    status: "active",
  }).returning();

  await db.insert(auditLogsTable).values({
    action: "user_created",
    userId: req.user!.id,
    details: `Admin created user: ${user.email}`,
    ipAddress: req.ip,
  });

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    documentCount: 0,
    lastActivity: null,
  });
});

// PATCH /admin/users/:id
router.patch("/admin/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updates: Record<string, any> = {};
  if (req.body.name) updates.name = req.body.name.trim();
  if (req.body.status) updates.status = req.body.status;
  if (req.body.role) updates.role = req.body.role;
  if (req.body.password) {
    updates.passwordHash = await bcrypt.hash(req.body.password, 10);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No update fields provided" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning();

  await db.insert(auditLogsTable).values({
    action: "user_updated",
    userId: req.user!.id,
    details: `Admin updated user ${updated.email}: ${Object.keys(updates).join(", ")}`,
    ipAddress: req.ip,
  });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documentsTable)
    .where(eq(documentsTable.userId, id));

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    createdAt: updated.createdAt,
    documentCount: Number(countRow?.count ?? 0),
    lastActivity: null,
  });
});

// POST /admin/users/:id/unlock — clear account lockout
router.post("/admin/users/:id/unlock", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(usersTable.id, id))
    .returning();

  await db.insert(auditLogsTable).values({
    action: "user_unlocked",
    userId: req.user!.id,
    details: `Admin unlocked account: ${existing.email}`,
    ipAddress: req.ip,
  });

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    createdAt: updated.createdAt,
    lockedUntil: null,
    documentCount: 0,
    lastActivity: null,
  });
});

// DELETE /admin/users/:id
router.delete("/admin/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Prevent deleting yourself
  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));

  await db.insert(auditLogsTable).values({
    action: "user_deleted",
    userId: req.user!.id,
    details: `Admin deleted user: ${existing.email}`,
    ipAddress: req.ip,
  });

  res.sendStatus(204);
});

export default router;
