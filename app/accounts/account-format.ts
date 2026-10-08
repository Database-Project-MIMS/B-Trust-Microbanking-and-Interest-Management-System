// Pure display helpers for the account and plan screens. Money and rates arrive from the API as
// strings and are only re-formatted here, never parsed into numbers (docs/11 Money and dates).

const MONEY = /^\d+(\.\d+)?$/;

/** "1234.5" -> "LKR 1,234.50"; anything that is not a plain decimal string is shown as an em dash. */
export function displayMoney(value: string | null | undefined): string {
  if (value == null || !MONEY.test(value)) return "—";
  const [whole = "0", cents = ""] = value.split(".");
  return `LKR ${whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents.slice(0, 2).padEnd(2, "0")}`;
}

/** A fraction string such as "0.1300" (13%) -> "13.00%", by shifting the decimal point in text. */
export function displayRate(fraction: string | null | undefined): string {
  if (fraction == null || !MONEY.test(fraction)) return "—";
  const [whole = "0", rest = ""] = fraction.split(".");
  const digits = rest.padEnd(2, "0");
  const integer = `${whole}${digits.slice(0, 2)}`.replace(/^0+(?=\d)/, "");
  const decimals = digits.slice(2).replace(/0+$/, "").padEnd(2, "0");
  return `${integer}.${decimals}%`;
}

/** ISO date or timestamp -> "07 Oct 2026" in Asia/Colombo. */
export function displayDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** Plain-language description of a joint mandate. */
export function mandateSummary(
  mandate: { mandateType: string; requiredSignatories: number } | null,
): string {
  if (!mandate) return "Individual account. The holder may transact alone.";
  if (mandate.mandateType === "ANY_ONE") return "Any one holder may authorise a withdrawal.";
  if (mandate.mandateType === "ALL_HOLDERS") return `All ${mandate.requiredSignatories} holders must authorise a withdrawal.`;
  return "Operating mandate recorded.";
}

export type MandateState = "EFFECTIVE" | "NOT_YET_EFFECTIVE" | "EXPIRED";

/** Who may authorise a withdrawal, and whether the stored mandate currently allows it. */
export function authoritySummary(input: {
  holderCount: number;
  mandate: { mandateType: string; requiredSignatories: number; state: MandateState } | null;
}): { text: string; blocked: boolean; stateLabel: string | null } {
  const { holderCount, mandate } = input;
  if (!mandate) {
    // Several holders without a mandate cannot withdraw (fn_check_withdrawal_mandate fails closed).
    if (holderCount > 1) return { text: "Withdrawals are blocked until a valid operating mandate exists.", blocked: true, stateLabel: null };
    return { text: "Sole holder. The holder may withdraw alone.", blocked: false, stateLabel: null };
  }
  const rule = mandateSummary(mandate);
  if (mandate.state === "NOT_YET_EFFECTIVE") return { text: `${rule} The mandate is not yet in effect, so withdrawals are blocked.`, blocked: true, stateLabel: "Not yet effective" };
  if (mandate.state === "EXPIRED") return { text: `${rule} The mandate has expired, so withdrawals are blocked.`, blocked: true, stateLabel: "Expired" };
  return { text: rule, blocked: false, stateLabel: "Effective" };
}

/** What a holder's signature is worth under the account's mandate. */
export function holderAuthority(mandate: { mandateType: string } | null, holderCount: number): string {
  if (!mandate) return holderCount > 1 ? "No mandate" : "Can authorise alone";
  return mandate.mandateType === "ANY_ONE" ? "Can authorise alone" : "Must co-sign";
}

const TRANSACTION_TYPES: Record<string, string> = {
  DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", INTEREST_CREDIT: "Interest credit", REVERSAL: "Reversal",
};

/** Plain label for a ledger type. */
export function transactionTypeLabel(type: string): string {
  return TRANSACTION_TYPES[type] ?? "Transaction";
}

/** Eligibility text for a plan row, built only from the plan's own data. */
export function eligibilitySummary(plan: {
  minAgeYears: number | null; maxAgeYears: number | null; minHolders: number; maxHolders: number; requiresAllAdult: boolean;
}): string {
  const age = plan.minAgeYears == null && plan.maxAgeYears == null ? "No age limit"
    : plan.minAgeYears == null ? `Up to age ${plan.maxAgeYears}`
    : plan.maxAgeYears == null ? `Age ${plan.minAgeYears}+`
    : `Age ${plan.minAgeYears}–${plan.maxAgeYears}`;
  const holders = plan.minHolders === 1 && plan.maxHolders === 1 ? null
    : `${plan.minHolders}–${plan.maxHolders} holders`;
  return [age, holders, plan.requiresAllAdult ? "all adult" : null].filter((part): part is string => part !== null).join(", ");
}
