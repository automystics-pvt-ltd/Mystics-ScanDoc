import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, documentsTable, emailLogsTable, usersTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import fs from "fs";

const router: IRouter = Router();

// GET /admin/documents
router.get("/admin/documents", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const docs = await db
    .select({
      id: documentsTable.id,
      userId: documentsTable.userId,
      fileName: documentsTable.fileName,
      filePath: documentsTable.filePath,
      fileType: documentsTable.fileType,
      fileSize: documentsTable.fileSize,
      uploadedAt: documentsTable.uploadedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(documentsTable)
    .leftJoin(usersTable, eq(documentsTable.userId, usersTable.id))
    .orderBy(desc(documentsTable.uploadedAt));

  const docsWithLogs = await Promise.all(
    docs.map(async (doc) => {
      const logs = await db
        .select()
        .from(emailLogsTable)
        .where(eq(emailLogsTable.documentId, doc.id))
        .orderBy(desc(emailLogsTable.sentAt));
      return {
        ...doc,
        emailLogs: logs.map((l) => ({
          ...l,
          documentName: doc.fileName,
          senderName: doc.userName,
        })),
      };
    })
  );

  res.json(docsWithLogs);
});

// DELETE /admin/documents/:id
router.delete("/admin/documents/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Delete file from disk
  if (doc.filePath && fs.existsSync(doc.filePath)) {
    fs.unlink(doc.filePath, () => {});
  }

  await db.delete(documentsTable).where(eq(documentsTable.id, id));

  await db.insert(auditLogsTable).values({
    action: "document_deleted",
    userId: req.user!.id,
    details: `Admin deleted document: ${doc.fileName}`,
    ipAddress: req.ip,
  });

  res.sendStatus(204);
});

export default router;
