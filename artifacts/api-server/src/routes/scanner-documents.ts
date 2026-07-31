/**
 * GET /api/scanner/documents
 *
 * Returns paginated scanner-ingested documents with per-doc dispatch status
 * derived from email_logs. Supports filtering by status and date range.
 *
 * Query params:
 *   page      — 1-based page number (default 1)
 *   pageSize  — items per page (default 20, max 100)
 *   status    — "queued" | "sent" | "failed" | "pending" | "all" (default "all")
 *   from      — ISO date string (inclusive lower bound on uploadedAt)
 *   to        — ISO date string (inclusive upper bound on uploadedAt)
 */

import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql, count } from "drizzle-orm";
import { db, documentsTable, emailLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/scanner/documents", requireAuth, async (req, res): Promise<void> => {
  const page     = Math.max(1, parseInt(String(req.query.page     ?? "1"),  10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
  const status   = String(req.query.status ?? "all");
  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate   = req.query.to   ? new Date(String(req.query.to))   : null;

  // ── date filter conditions (no source filter — show ALL documents) ──────────
  const conditions: any[] = [];
  if (fromDate && !isNaN(fromDate.getTime())) {
    conditions.push(gte(documentsTable.uploadedAt, fromDate));
  }
  if (toDate && !isNaN(toDate.getTime())) {
    const endOfDay = new Date(toDate);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(documentsTable.uploadedAt, endOfDay));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // ── fetch all matching scanner docs ───────────────────────────────────────
  // We'll compute dispatch status in JS because SQLite-style CASE over grouped
  // rows is verbose in Drizzle; document counts are small (scanner folder).
  const allDocs = await db
    .select()
    .from(documentsTable)
    .$dynamic()
    .where(where)
    .orderBy(desc(documentsTable.uploadedAt));

  // Fetch all email logs for these docs in one query
  const docIds = allDocs.map((d) => d.id);

  let logsMap: Map<number, { status: string }[]> = new Map();
  if (docIds.length > 0) {
    const logs = await db
      .select({ documentId: emailLogsTable.documentId, status: emailLogsTable.status })
      .from(emailLogsTable)
      .where(
        sql`${emailLogsTable.documentId} = ANY(ARRAY[${sql.join(docIds.map(id => sql`${id}`), sql`, `)}]::int[])`
      );
    for (const log of logs) {
      if (!logsMap.has(log.documentId)) logsMap.set(log.documentId, []);
      logsMap.get(log.documentId)!.push({ status: log.status });
    }
  }

  // ── compute dispatchStatus per doc ────────────────────────────────────────
  function computeStatus(docId: number): "queued" | "sent" | "failed" | "pending" {
    const logs = logsMap.get(docId) ?? [];
    if (logs.length === 0) return "queued";
    const statuses = logs.map((l) => l.status);
    if (statuses.some((s) => s === "sent"))           return "sent";
    if (statuses.some((s) => s === "queued" || s === "retry_pending")) return "pending";
    return "failed";
  }

  const enriched = allDocs.map((doc) => ({
    ...doc,
    dispatchStatus: computeStatus(doc.id),
  }));

  // ── apply status filter ───────────────────────────────────────────────────
  const filtered = status === "all"
    ? enriched
    : enriched.filter((d) => {
        if (status === "queued")  return d.dispatchStatus === "queued";
        if (status === "sent")    return d.dispatchStatus === "sent";
        if (status === "failed")  return d.dispatchStatus === "failed";
        if (status === "pending") return d.dispatchStatus === "pending";
        return true;
      });

  // ── paginate ──────────────────────────────────────────────────────────────
  // Stats computed across all date-filtered docs (before status filter)
  const stats = {
    total:   enriched.length,
    queued:  enriched.filter((d) => d.dispatchStatus === "queued").length,
    pending: enriched.filter((d) => d.dispatchStatus === "pending").length,
    sent:    enriched.filter((d) => d.dispatchStatus === "sent").length,
    failed:  enriched.filter((d) => d.dispatchStatus === "failed").length,
  };

  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), stats });
});

export default router;
