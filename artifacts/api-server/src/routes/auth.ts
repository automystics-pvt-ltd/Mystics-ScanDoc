import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { requireAuth, signToken } from "../middlewares/auth";
import { loginRateLimiter } from "../lib/rate-limiter";

const router: IRouter = Router();

/** Number of failed attempts before the account is temporarily locked. */
const LOCKOUT_THRESHOLD = 10;
/** How long (ms) the account stays locked after threshold is reached. */
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

router.post("/auth/login", loginRateLimiter, async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user) {
    // Don't reveal whether the email exists — generic error
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status === "inactive") {
    res.status(401).json({ error: "Account is inactive. Contact your administrator." });
    return;
  }

  // Account lockout check
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const retryAfterSec = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    // Increment failed attempts and potentially lock the account
    const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = newAttempts >= LOCKOUT_THRESHOLD;
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

    await db
      .update(usersTable)
      .set({
        failedLoginAttempts: newAttempts,
        ...(lockedUntil !== undefined ? { lockedUntil } : {}),
      })
      .where(eq(usersTable.id, user.id));

    await db.insert(auditLogsTable).values({
      action: "login_failed",
      userId: user.id,
      details: `Failed login attempt ${newAttempts}/${LOCKOUT_THRESHOLD}`,
      ipAddress: req.ip,
    });

    if (shouldLock) {
      await db.insert(auditLogsTable).values({
        action: "account_locked",
        userId: user.id,
        details: `Account locked for 30 minutes after ${newAttempts} failed login attempts`,
        ipAddress: req.ip,
      });
    }

    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Successful login — reset failure counters
  await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(usersTable.id, user.id));

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
