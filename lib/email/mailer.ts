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
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) throw new Error("SMTP credentials are not configured.");
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_PORT ?? "465") === "465",
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
    && Boolean(process.env.SMTP_USER) && Boolean(process.env.SMTP_APP_PASSWORD);
}

/** The only module that talks to the mail provider (Gmail SMTP through an app password). */
export const smtpMailer: Mailer = {
  async send(email) {
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;
    await smtpTransport().sendMail({
      from: `"B-Trust Microfinance" <${from}>`,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      messageId: `<${email.messageId}@btrust.mims>`,
    });
  },
};
