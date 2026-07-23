import { Router, type IRouter } from "express";
import { sql, desc, eq, and, gte, lt } from "drizzle-orm";
import { db, usersTable, documentsTable, emailLogsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /admin/dashboard?days=30&endDate=2026-07-23
router.get("/admin/dashboard", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));

  // endDate: the "as-of" date (defaults to today in server timezone)
  let today = new Date();
  today.setHours(0, 0, 0, 0);
  if (req.query.endDate && typeof req.query.endDate === "string") {
    const parsed = new Date(`${req.query.endDate}T00:00:00`);
    if (!isNaN(parsed.getTime())) today = parsed;
  }
  // "today" here means the selected reference date (start of day)
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const seriesStart = new Date(today);
  seriesStart.setDate(seriesStart.getDate() - (days - 1));

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
    // selected date counts (today → endOfDay of selected date)
    db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(and(gte(documentsTable.uploadedAt, today), lt(documentsTable.uploadedAt, endOfDay))),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(and(eq(emailLogsTable.status, "sent"), gte(emailLogsTable.sentAt, today), lt(emailLogsTable.sentAt, endOfDay))),
    // previous day (for trend delta)
    db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(and(gte(documentsTable.uploadedAt, yesterday), lt(documentsTable.uploadedAt, today))),
    db.select({ count: sql<number>`count(*)` }).from(emailLogsTable).where(and(eq(emailLogsTable.status, "sent"), gte(emailLogsTable.sentAt, yesterday), lt(emailLogsTable.sentAt, today))),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(lt(usersTable.createdAt, endOfDay)),
    // recent audit log
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
    // daily document counts — use drizzle select so result is typed []
    db
      .select({
        day: sql<string>`DATE(${documentsTable.uploadedAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(documentsTable)
      .where(gte(documentsTable.uploadedAt, seriesStart))
      .groupBy(sql`DATE(${documentsTable.uploadedAt})`)
      .orderBy(sql`DATE(${documentsTable.uploadedAt})`),
    // daily sent-email counts
    db
      .select({
        day: sql<string>`DATE(${emailLogsTable.sentAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(emailLogsTable)
      .where(and(eq(emailLogsTable.status, "sent"), gte(emailLogsTable.sentAt, seriesStart)))
      .groupBy(sql`DATE(${emailLogsTable.sentAt})`)
      .orderBy(sql`DATE(${emailLogsTable.sentAt})`),
    // recent failed emails for alerts
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

  // Build complete N-day series (fill missing days with 0)
  const docMap = new Map<string, number>();
  for (const row of docSeries) {
    docMap.set(String(row.day), Number(row.count));
  }
  const emailMap = new Map<string, number>();
  for (const row of emailSeries) {
    emailMap.set(String(row.day), Number(row.count));
  }

  const volumeSeries: { date: string; documents: number; emails: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(seriesStart);
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
