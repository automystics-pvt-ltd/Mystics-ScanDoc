import { Router, type IRouter } from "express";
import { desc, eq, and, SQL } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /admin/audit-logs
router.get("/admin/audit-logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { action, limit = "100", offset = "0" } = req.query as {
    action?: string;
    limit?: string;
    offset?: string;
  };

  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

  const conditions: SQL[] = [];
  if (action && action !== "all") {
    conditions.push(eq(auditLogsTable.action, action));
  }

  const rows = await db
    .select({
      id: auditLogsTable.id,
      action: auditLogsTable.action,
      userId: auditLogsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      details: auditLogsTable.details,
      ipAddress: auditLogsTable.ipAddress,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limitNum)
    .offset(offsetNum);

  res.json(
    rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.userId ?? null,
      userName: r.userName ?? null,
      userEmail: r.userEmail ?? null,
      details: r.details ?? null,
      ipAddress: r.ipAddress ?? null,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

export default router;
