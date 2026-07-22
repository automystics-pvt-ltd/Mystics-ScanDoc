import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { documentsTable } from "./documents";
import { usersTable } from "./users";

export const emailStatusEnum = pgEnum("email_status", ["queued", "sent", "failed", "retry_pending"]);

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  status: emailStatusEnum("status").notNull().default("queued"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  messageId: text("message_id"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
});

export const insertEmailLogSchema = createInsertSchema(emailLogsTable).omit({ id: true });
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogsTable.$inferSelect;
