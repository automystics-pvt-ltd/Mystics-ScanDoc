import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),

  // ── Email transport ──────────────────────────────────────────────────────
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),

  // ── Email service provider ───────────────────────────────────────────────
  // resend | sendgrid | mailgun | ses | postmark | smtp
  emailProvider: text("email_provider").default("resend"),
  emailProviderApiKey: text("email_provider_api_key"),
  emailProviderDomain: text("email_provider_domain"), // mailgun domain / SES region

  // ── SMS provider ─────────────────────────────────────────────────────────
  // twilio | vonage | messagebird
  smsEnabled: boolean("sms_enabled").default(false),
  smsProvider: text("sms_provider"),
  smsProviderApiKey: text("sms_provider_api_key"),
  smsProviderSecret: text("sms_provider_secret"),   // Twilio auth token / Vonage secret
  smsProviderFrom: text("sms_provider_from"),

  // ── WhatsApp provider ────────────────────────────────────────────────────
  // twilio | meta
  whatsappEnabled: boolean("whatsapp_enabled").default(false),
  whatsappProvider: text("whatsapp_provider"),
  whatsappProviderApiKey: text("whatsapp_provider_api_key"),
  whatsappProviderFrom: text("whatsapp_provider_from"),

  // ── Notification channels ────────────────────────────────────────────────
  // comma-separated: email,sms,whatsapp
  notificationChannels: text("notification_channels").default("email"),
  defaultNotificationChannel: text("default_notification_channel").default("email"),

  // ── Document constraints ─────────────────────────────────────────────────
  maxRecipients: integer("max_recipients").notNull().default(5),
  maxFileSizeMb: integer("max_file_size_mb").notNull().default(10),
  allowedFileTypes: text("allowed_file_types").default("pdf,jpg,jpeg,png"),

  // ── Retention policy ─────────────────────────────────────────────────────
  retentionDays: integer("retention_days").default(30),

  // ── Scanner settings ─────────────────────────────────────────────────────
  scannerName: text("scanner_name"),
  scannerPaperSize: text("scanner_paper_size").default("A4"),
  scannerResolutionDpi: integer("scanner_resolution_dpi").default(300),
  scannerColorMode: text("scanner_color_mode").default("color"),   // color | grayscale | blackwhite
  scannerFileFormat: text("scanner_file_format").default("pdf"),   // pdf | jpg | png
  scannerDuplex: boolean("scanner_duplex").default(false),
  scannerBrightness: integer("scanner_brightness").default(0),     // -100 to 100
  scannerContrast: integer("scanner_contrast").default(0),         // -100 to 100
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
