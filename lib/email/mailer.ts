import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Stable id (the outbox notification_id) so a retry presents the same Message-ID. */
  messageId: string;
}

export interface Mailer {
  send(email: OutboundEmail): Promise<void>;
}

let transporter: Transporter | null = null;

function smtpTransport(): Transporter {
  const user = process.env.SMTP_USER?.trim();
  // Google displays app passwords in groups of four for readability.
  const pass = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) throw new Error("SMTP credentials are not configured.");
  const port = Number(process.env.SMTP_PORT?.trim() || "465");
  if (![465, 587].includes(port)) throw new Error("SMTP_PORT must be 465 or 587.");
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: port === 465,
    requireTLS: true,
    tls: { minVersion: "TLSv1.2" },
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return transporter;
}

/** True only when notifications are switched on AND SMTP credentials exist in this environment. */
export function notificationsEnabled(): boolean {
  return process.env.NOTIFICATIONS_ENABLED === "true"
    && Boolean(process.env.SMTP_USER?.trim()) && Boolean(process.env.SMTP_APP_PASSWORD?.replace(/\s/g, ""));
}

/** Checks SMTP authentication without sending mail or opening a database transaction. */
export async function verifySmtpConnection(): Promise<void> {
  await smtpTransport().verify();
}

/** The only module that talks to the mail provider (Gmail SMTP through an app password). */
export const smtpMailer: Mailer = {
  async send(email) {
    const from = process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim();
    const result = await smtpTransport().sendMail({
      from: { name: "B-Trust Microfinance", address: from ?? "" },
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      messageId: `<${email.messageId}@btrust.mims>`,
    });
    if (result.rejected?.length || !result.accepted?.length) {
      throw Object.assign(new Error("SMTP did not accept the recipient."), { code: "ERECIPIENT" });
    }
  },
};
