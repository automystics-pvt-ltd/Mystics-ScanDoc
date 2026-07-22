import { Router, type IRouter } from "express";
import { sql, desc, eq } from "drizzle-orm";
import { db, usersTable, documentsTable, emailLogsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /admin/dashboard
router.get("/admin/dashboard", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [[totalUsersRow], [activeUsersRow], [totalDocsRow], [emailsSentRow], [failedEmailsRow], [docsTodayRow], [emailsTodayRow], recentActivity] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(documentsTable),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(eq(emailLogsTable.status, "sent")),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(eq(emailLogsTable.status, "failed")),
    db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(sql`${documentsTable.uploadedAt} >= ${today}`),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(sql`${emailLogsTable.sentAt} >= ${today}`),
    db
      .select({
        id: auditLogsTable.id,
        action: auditLogsTable.action,
        userId: auditLogsTable.userId,
        userName: usersTable.name,
        details: auditLogsTable.details,
        ipAddress: auditLogsTable.ipAddress,
        createdAt: auditLogsTable.createdAt,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(20),
  ]);

  res.json({
    totalUsers: Number(totalUsersRow?.count ?? 0),
    activeUsers: Number(activeUsersRow?.count ?? 0),
    totalDocuments: Number(totalDocsRow?.count ?? 0),
    totalEmailsSent: Number(emailsSentRow?.count ?? 0),
    failedEmails: Number(failedEmailsRow?.count ?? 0),
    documentsToday: Number(docsTodayRow?.count ?? 0),
    emailsToday: Number(emailsTodayRow?.count ?? 0),
    recentActivity,
  });
});

// GET /admin/audit-logs?action=login_failed&limit=200
router.get("/admin/audit-logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const actionFilter = typeof req.query.action === "string" ? req.query.action : undefined;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

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
    .where(actionFilter ? eq(auditLogsTable.action, actionFilter) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit);

  res.json(rows);
});

export default router;
