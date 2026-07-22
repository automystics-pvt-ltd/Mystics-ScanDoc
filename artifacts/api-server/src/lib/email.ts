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

    // Build multipart form data if there's an attachment
    let body: FormData | string;
    let headers: Record<string, string> = {};

    if (opts.attachmentPath && fs.existsSync(opts.attachmentPath)) {
      const form = new FormData();
      form.append("from", opts.from);
      form.append("to", opts.to);
      form.append("subject", opts.subject);
      form.append("text", opts.text);

      const fileBuffer = fs.readFileSync(opts.attachmentPath);
      const blob = new Blob([fileBuffer]);
      form.append("attachments", blob, opts.attachmentName ?? path.basename(opts.attachmentPath));

      body = form;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      });
    }

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
