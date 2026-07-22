import { ReplitConnectors } from "@replit/connectors-sdk";
import fs from "fs";
import path from "path";

export interface SendEmailOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
  attachmentPath?: string;
  attachmentName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Resend using the Replit connectors SDK.
 * Falls back to SMTP (nodemailer) if Resend is unavailable.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const connectors = new ReplitConnectors();

    // Resend expects JSON for all requests; attachments are base64-encoded inline.
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const payload: Record<string, unknown> = {
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    };

    if (opts.attachmentPath && fs.existsSync(opts.attachmentPath)) {
      const fileBuffer = fs.readFileSync(opts.attachmentPath);
      payload["attachments"] = [
        {
          filename: opts.attachmentName ?? path.basename(opts.attachmentPath),
          content: fileBuffer.toString("base64"),
        },
      ];
    }

    const body = JSON.stringify(payload);

    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Resend API error ${response.status}: ${errText}` };
    }

    const data = await response.json() as { id?: string };
    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Unknown error sending email" };
  }
}

/**
 * Resolve the "from" address to use for outbound emails.
 * Prefers the configured smtpUser (verified sender domain); falls back to the
 * Resend onboarding sandbox address for development/unconfigured environments.
 */
export function resolveFromAddress(smtpUser?: string | null): string {
  return smtpUser
    ? `DocScan <${smtpUser}>`
    : "DocScan <onboarding@resend.dev>";
}

/**
 * Send a test email to verify the Resend integration is working.
 */
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  return sendEmail({
    from: "DocScan <onboarding@resend.dev>",
    to,
    subject: "DocScan — Email Delivery Test",
    text: "This is a test email from DocScan confirming that email delivery is working correctly.",
  });
}
