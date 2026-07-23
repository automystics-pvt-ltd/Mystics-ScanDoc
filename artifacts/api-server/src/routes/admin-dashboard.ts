import { Router, type IRouter } from "express";
import { sql, desc, eq, and, gte } from "drizzle-orm";
import { db, usersTable, documentsTable, emailLogsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /admin/dashboard
router.get("/admin/dashboard", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();

  // Today midnight
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Yesterday midnight
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // 30 days ago
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // inclusive of today = 30 days

  const [
    [totalUsersRow],
    [activeUsersRow],
    [totalDocsRow],
    [emailsSentRow],
    [failedEmailsRow],
    [docsTodayRow],
    [emailsTodayRow],
    [docsYesterdayRow],
    [emailsYesterdayRow],
    [usersYesterdayRow],
    recentActivity,
    docSeries,
    emailSeries,
    recentFailures,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(documentsTable),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(eq(emailLogsTable.status, "sent")),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(eq(emailLogsTable.status, "failed")),
    // today counts
    db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(gte(documentsTable.uploadedAt, today)),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(and(eq(emailLogsTable.status, "sent"), gte(emailLogsTable.sentAt, today))),
    // yesterday counts (for trends)
    db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(and(gte(documentsTable.uploadedAt, yesterday), sql`${documentsTable.uploadedAt} < ${today}`)),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(and(eq(emailLogsTable.status, "sent"), gte(emailLogsTable.sentAt, yesterday), sql`${emailLogsTable.sentAt} < ${today}`)),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.createdAt} < ${today}`),
    // recent audit log activity
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
    // 30-day document volume per day
    db.execute(sql`
      SELECT
        DATE_TRUNC('day', "uploaded_at") AS day,
        COUNT(*) AS count
      FROM documents
      WHERE "uploaded_at" >= ${thirtyDaysAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    // 30-day email sent volume per day
    db.execute(sql`
      SELECT
        DATE_TRUNC('day', "sent_at") AS day,
        COUNT(*) AS count
      FROM email_logs
      WHERE "sent_at" >= ${thirtyDaysAgo}
        AND status = 'sent'
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    // recent failed emails for alerts panel
    db
      .select({
        id: emailLogsTable.id,
        recipientEmail: emailLogsTable.recipientEmail,
        errorMessage: emailLogsTable.errorMessage,
        sentAt: emailLogsTable.sentAt,
        retryCount: emailLogsTable.retryCount,
      })
      .from(emailLogsTable)
      .where(eq(emailLogsTable.status, "failed"))
      .orderBy(desc(emailLogsTable.sentAt))
      .limit(5),
  ]);

  // Build a complete 30-day series (fill missing days with 0)
  const docMap = new Map<string, number>();
  for (const row of (docSeries as any).rows ?? docSeries) {
    const day = new Date(row.day).toISOString().slice(0, 10);
    docMap.set(day, Number(row.count));
  }
  const emailMap = new Map<string, number>();
  for (const row of (emailSeries as any).rows ?? emailSeries) {
    const day = new Date(row.day).toISOString().slice(0, 10);
    emailMap.set(day, Number(row.count));
  }

  const volumeSeries: { date: string; documents: number; emails: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    volumeSeries.push({ date: key, documents: docMap.get(key) ?? 0, emails: emailMap.get(key) ?? 0 });
  }

  const docsToday = Number(docsTodayRow?.count ?? 0);
  const emailsToday = Number(emailsTodayRow?.count ?? 0);
  const docsYesterday = Number(docsYesterdayRow?.count ?? 0);
  const emailsYesterday = Number(emailsYesterdayRow?.count ?? 0);
  const totalUsersNow = Number(totalUsersRow?.count ?? 0);
  const totalUsersBefore = Number(usersYesterdayRow?.count ?? 0);

  res.json({
    totalUsers: totalUsersNow,
    activeUsers: Number(activeUsersRow?.count ?? 0),
    totalDocuments: Number(totalDocsRow?.count ?? 0),
    totalEmailsSent: Number(emailsSentRow?.count ?? 0),
    failedEmails: Number(failedEmailsRow?.count ?? 0),
    documentsToday: docsToday,
    emailsToday: emailsToday,
    // Trends: delta vs yesterday
    trends: {
      documents: docsToday - docsYesterday,
      emails: emailsToday - emailsYesterday,
      users: totalUsersNow - totalUsersBefore,
    },
    volumeSeries,
    recentActivity,
    recentFailures,
  });
});

export default router;
