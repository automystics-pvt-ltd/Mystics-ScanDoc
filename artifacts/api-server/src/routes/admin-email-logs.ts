import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, emailLogsTable, documentsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /admin/email-logs
router.get("/admin/email-logs", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const logs = await db
    .select({
      id: emailLogsTable.id,
      documentId: emailLogsTable.documentId,
      senderId: emailLogsTable.senderId,
      recipientEmail: emailLogsTable.recipientEmail,
      status: emailLogsTable.status,
      sentAt: emailLogsTable.sentAt,
      errorMessage: emailLogsTable.errorMessage,
      retryCount: emailLogsTable.retryCount,
      nextRetryAt: emailLogsTable.nextRetryAt,
      documentName: documentsTable.fileName,
      senderName: usersTable.name,
    })
    .from(emailLogsTable)
    .leftJoin(documentsTable, eq(emailLogsTable.documentId, documentsTable.id))
    .leftJoin(usersTable, eq(emailLogsTable.senderId, usersTable.id))
    .orderBy(desc(emailLogsTable.sentAt));

  res.json(logs);
});

export default router;
