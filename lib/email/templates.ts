export interface NotificationRow {
  eventType: string;
  payload: Record<string, unknown>;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const TIME_ZONE = "Asia/Colombo";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Formats a NUMERIC string for display only; no arithmetic is done on it. */
function money(value: unknown): string {
  const [whole = "0", fraction = "00"] = String(value ?? "0").split(".");
  return `LKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function when(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleString("en-GB", { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" })} (Sri Lanka time)`;
}

const str = (value: unknown): string => (value === undefined || value === null ? "" : String(value));

const TXN_HEADLINES: Record<string, (p: Record<string, unknown>) => string> = {
  TXN_DEPOSIT: p => `A deposit of ${money(p.amount)} was credited to your account.`,
  TXN_WITHDRAWAL: p => `A withdrawal of ${money(p.amount)} was made from your account.`,
  TXN_TRANSFER_IN: p => `A transfer of ${money(p.amount)} was received into your account.`,
  TXN_TRANSFER_OUT: p => `A transfer of ${money(p.amount)} was sent from your account.`,
  TXN_INTEREST_CREDIT: p => `Interest of ${money(p.amount)} was credited to your account.`,
  TXN_REVERSAL: p => `A transaction of ${money(p.amount)} on your account was reversed.`,
  TXN_FD_MATURITY: p => `Your fixed deposit matured and ${money(p.amount)} was returned to your account.`,
};

const SUBJECTS: Record<string, string> = {
  ACCOUNT_OPENED: "Your B-Trust account has been opened",
  ACCOUNT_HOLDER_ADDED: "You were added to a B-Trust account",
  ACCOUNT_STATUS_CHANGED: "Your B-Trust account status changed",
  FD_OPENED: "Your fixed deposit has been opened",
  TXN_DEPOSIT: "Deposit received on your account",
  TXN_WITHDRAWAL: "Withdrawal made from your account",
  TXN_TRANSFER_IN: "Transfer received on your account",
  TXN_TRANSFER_OUT: "Transfer sent from your account",
  TXN_INTEREST_CREDIT: "Interest credited to your account",
  TXN_REVERSAL: "A transaction on your account was reversed",
  TXN_FD_MATURITY: "Your fixed deposit has matured",
};

/** Builds the headline and the detail lines for one event. */
function describe(row: NotificationRow): { headline: string; details: Array<[string, string]> } {
  const p = row.payload;
  const account: [string, string] = ["Account", str(p.accountMask)];
  const time: [string, string] = ["Date and time", when(p.occurredAt)];
  const txn = TXN_HEADLINES[row.eventType];
  if (txn) return { headline: txn(p), details: [account, ["Reference", str(p.referenceNumber)], time] };
  switch (row.eventType) {
    case "ACCOUNT_OPENED":
      return { headline: `Your ${str(p.planName)} account has been opened.`, details: [account, time] };
    case "ACCOUNT_HOLDER_ADDED":
      return { headline: `You have been added as a ${str(p.holderType).toLowerCase()} holder on a ${str(p.planName)} account.`, details: [account, time] };
    case "ACCOUNT_STATUS_CHANGED":
      return { headline: `Your account status changed from ${str(p.oldStatus)} to ${str(p.newStatus)}.`, details: [account, time] };
    case "FD_OPENED":
      return {
        headline: `A fixed deposit of ${money(p.principal)} has been opened.`,
        details: [account, ["Annual interest rate", `${(Number(p.interestRate) * 100).toFixed(2)}%`],
          ["Start date", str(p.startDate).slice(0, 10)], ["Maturity date", str(p.maturityDate).slice(0, 10)]],
      };
    default:
      return { headline: "There was activity on your account.", details: [account, time] };
  }
}

/** Renders subject, plain text and HTML. Balances and credentials are never included. */
export function renderEmail(row: NotificationRow): RenderedEmail {
  const { headline, details } = describe(row);
  const name = str(row.payload.recipientName) || "Customer";
  const subject = SUBJECTS[row.eventType] ?? "Activity on your B-Trust account";
  const footer = "If you do not recognise this activity, please contact your B-Trust branch immediately. This is an automated message; do not reply.";

  const text = [`Dear ${name},`, "", headline, "", ...details.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), "", footer, "", "B-Trust Microfinance Bank"].join("\n");

  const rows = details.filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#555">${escapeHtml(k)}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="color:#0b5d3b;margin-bottom:4px">B-Trust Microfinance Bank</h2>
<p>Dear ${escapeHtml(name)},</p><p>${escapeHtml(headline)}</p>
<table style="border-collapse:collapse;margin:12px 0">${rows}</table>
<p style="color:#555;font-size:12px">${escapeHtml(footer)}</p></div>`;
  return { subject, text, html };
}
