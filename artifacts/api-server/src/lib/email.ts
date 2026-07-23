import fs from "fs";
import path from "path";
import { db, settingsTable } from "@workspace/db";

/** Convert a raw Resend API error body into a plain-English message. */
function parseResendError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string; name?: string };
    const msg = json.message ?? body;

    if (status === 403) {
      if (msg.toLowerCase().includes("testing") || msg.toLowerCase().includes("own email")) {
        return "From address not configured — go to Settings and enter a verified sender address (e.g. noreply@yourdomain.com).";
      }
      return `Permission denied by Resend (403): ${msg}`;
    }
    if (status === 422) {
      if (msg.toLowerCase().includes("testing email") || msg.toLowerCase().includes("own email")) {
        return "Sandbox restriction: enter a verified sender address in Settings → Email.";
      }
      return `Invalid email parameters (422): ${msg}`;
    }
    if (status === 429) return `Resend rate limit exceeded (429) — retry scheduled.`;
    return `Resend error ${status}: ${msg}`;
  } catch {
    return `Resend error ${status}: ${body}`;
  }
}

/** Resolve the Resend API key: DB settings first, then env var. */
async function resolveApiKey(): Promise<string | null> {
  try {
    const [settings] = await db.select().from(settingsTable).limit(1);
    if (settings?.emailProviderApiKey) return settings.emailProviderApiKey;
  } catch { /* fall through */ }
  return process.env.RESEND_API_KEY ?? null;
}

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
 * Send a single email via Resend API directly (no Replit connector).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    return { success: false, error: "No Resend API key configured — go to Admin → Settings → Email and enter your key." };
  }

  try {
    const payload: Record<string, unknown> = {
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      attachments: buildAttachment(opts.attachmentPath, opts.attachmentName),
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: parseResendError(response.status, errText) };
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
  results: SendEmailResult[];
}

/**
 * Send multiple emails via Resend's batch endpoint in a single API call.
 */
export async function sendEmailBatch(items: BatchEmailItem[]): Promise<BatchEmailResult> {
  if (items.length === 0) return { results: [] };
  if (items.length === 1) {
    const result = await sendEmail(items[0]);
    return { results: [result] };
  }

  const apiKey = await resolveApiKey();
  if (!apiKey) {
    const err = "No Resend API key configured — go to Admin → Settings → Email and enter your key.";
    return { results: items.map(() => ({ success: false, error: err })) };
  }

  try {
    const payload = items.map((item) => ({
      from: item.from,
      to: [item.to],
      subject: item.subject,
      text: item.text,
      attachments: buildAttachment(item.attachmentPath, item.attachmentName),
    }));

    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      const errMsg = parseResendError(response.status, errText);
      return { results: items.map(() => ({ success: false, error: errMsg })) };
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
 */
export function resolveFromAddress(smtpUser?: string | null): string {
  return smtpUser
    ? `DocScan <${smtpUser}>`
    : "DocScan <noreply@automystics.tech>";
}

/**
 * Send a test email using configured settings from DB.
 */
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  try {
    const [settings] = await db.select().from(settingsTable).limit(1);
    const from = resolveFromAddress(settings?.smtpUser);
    return sendEmail({
      from,
      to,
      subject: "DocScan — Email Delivery Test",
      text: "This is a test email from DocScan confirming that email delivery is working correctly.",
    });
  } catch {
    return sendEmail({
      from: resolveFromAddress(),
      to,
      subject: "DocScan — Email Delivery Test",
      text: "This is a test email from DocScan confirming that email delivery is working correctly.",
    });
  }
}
