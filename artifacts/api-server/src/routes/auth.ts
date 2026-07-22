import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { requireAuth, signToken } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status === "inactive") {
    res.status(401).json({ error: "Account is inactive. Contact your administrator." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Log login
  await db.insert(auditLogsTable).values({
    action: "user_login",
    userId: user.id,
    details: `User ${user.email} logged in`,
    ipAddress: req.ip,
  });

  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  if (req.user) {
    await db.insert(auditLogsTable).values({
      action: "user_logout",
      userId: req.user.id,
      details: `User ${req.user.email} logged out`,
      ipAddress: req.ip,
    });
  }
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user || user.status === "inactive") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  });
});

export default router;
