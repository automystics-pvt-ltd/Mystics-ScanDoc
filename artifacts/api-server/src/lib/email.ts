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

/** Build the attachments array (base64-encoded) for a file path, if it exists. */
function buildAttachment(
  attachmentPath?: string,
  attachmentName?: string
): { filename: string; content: string }[] {
  if (attachmentPath && fs.existsSync(attachmentPath)) {
    return [
      {
        filename: attachmentName ?? path.basename(attachmentPath),
        content: fs.readFileSync(attachmentPath).toString("base64"),
      },
    ];
  }
  return [];
}

/**
 * Send a single email via Resend using the Replit connectors SDK.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const connectors = new ReplitConnectors();
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const payload: Record<string, unknown> = {
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      attachments: buildAttachment(opts.attachmentPath, opts.attachmentName),
    };

    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
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

export interface BatchEmailItem {
  to: string;
  from: string;
  subject: string;
  text: string;
  attachmentPath?: string;
  attachmentName?: string;
}

export interface BatchEmailResult {
  /** Results in the same order as the input items. */
  results: SendEmailResult[];
}

/**
 * Send multiple emails via Resend's batch endpoint in a single API call.
 * This avoids per-request rate-limiting and is far more reliable for
 * sending to 2+ recipients at once.
 *
 * Falls back to individual sends if the batch call itself fails.
 */
export async function sendEmailBatch(items: BatchEmailItem[]): Promise<BatchEmailResult> {
  if (items.length === 0) return { results: [] };
  if (items.length === 1) {
    const result = await sendEmail(items[0]);
    return { results: [result] };
  }

  try {
    const connectors = new ReplitConnectors();
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const payload = items.map((item) => ({
      from: item.from,
      to: [item.to],
      subject: item.subject,
      text: item.text,
      attachments: buildAttachment(item.attachmentPath, item.attachmentName),
    }));

    const response = await connectors.proxy("resend", "/emails/batch", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      const errMsg = `Resend batch API error ${response.status}: ${errText}`;
      // Return individual failures so callers can log per-recipient
      return {
        results: items.map(() => ({ success: false, error: errMsg })),
      };
    }

    const data = await response.json() as { data?: { id: string }[] };
    const ids = data.data ?? [];

    return {
      results: items.map((_, i) => ({
        success: true,
        messageId: ids[i]?.id,
      })),
    };
  } catch (err: any) {
    // Unexpected error — fall back to individual sends
    const results = await Promise.all(items.map((item) => sendEmail(item)));
    return { results };
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
