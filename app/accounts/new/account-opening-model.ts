// Pure logic for the account-opening wizard. The screen guides the user (usability); the server and
// database enforce every rule (AGENTS 5.4). No React, no numbers: money stays a string throughout.

export interface PlanOption {
  planId: string;
  planName: string;
  interestRate: string;
  minBalance: string;
  description: string | null;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  minHolders: number;
  maxHolders: number;
  requiresAllAdult: boolean;
}

export interface HolderChoice {
  customerId: string;
  customerNumber: string;
  fullName: string;
  dateOfBirth: string;
}

export type MandateType = "" | "ANY_ONE" | "ALL_HOLDERS";

export interface OpeningState {
  planId: string;
  holders: HolderChoice[];
  mandateType: MandateType;
  deposit: string;
}

export interface OpenAccountBody {
  planId: string;
  branchId: string;
  holders: { customerId: string; holderType: "PRIMARY" | "JOINT" }[];
  mandate?: { type: "ANY_ONE" | "ALL_HOLDERS" };
  initialDeposit?: string;
}

export const EMPTY_OPENING: OpeningState = { planId: "", holders: [], mandateType: "", deposit: "" };
const DEPOSIT_FORMAT = /^\d{1,13}(\.\d{1,2})?$/;

export function allowsMandate(plan: PlanOption | undefined): boolean {
  return plan !== undefined && plan.maxHolders > 1;
}

/** Choosing a plan keeps only as many holders as it allows and clears a mandate it cannot use. */
export function selectPlan(state: OpeningState, plan: PlanOption | undefined): OpeningState {
  if (!plan) return { ...state, planId: "", mandateType: "" };
  return {
    ...state,
    planId: plan.planId,
    holders: state.holders.slice(0, plan.maxHolders),
    mandateType: allowsMandate(plan) ? state.mandateType : "",
  };
}

export function addHolder(state: OpeningState, plan: PlanOption | undefined, holder: HolderChoice): { state: OpeningState; error?: string } {
  if (!plan) return { state, error: "Choose a savings plan first." };
  if (state.holders.some(existing => existing.customerId === holder.customerId)) {
    return { state, error: `${holder.fullName} is already a holder on this application.` };
  }
  if (state.holders.length >= plan.maxHolders) {
    return { state, error: `The ${plan.planName} plan allows at most ${plan.maxHolders} holder${plan.maxHolders === 1 ? "" : "s"}.` };
  }
  return { state: { ...state, holders: [...state.holders, holder] } };
}

export function removeHolder(state: OpeningState, customerId: string): OpeningState {
  return { ...state, holders: state.holders.filter(holder => holder.customerId !== customerId) };
}

/** The first holder is the PRIMARY applicant; this moves a chosen holder to the front. */
export function makePrimary(state: OpeningState, customerId: string): OpeningState {
  const chosen = state.holders.find(holder => holder.customerId === customerId);
  if (!chosen) return state;
  return { ...state, holders: [chosen, ...state.holders.filter(holder => holder.customerId !== customerId)] };
}

export function holderRole(index: number): "PRIMARY" | "JOINT" {
  return index === 0 ? "PRIMARY" : "JOINT";
}

export function isValidDeposit(text: string): boolean {
  return text.trim() === "" || DEPOSIT_FORMAT.test(text.trim());
}

/** Usability checks only. An empty list means the form may be reviewed; the server still decides. */
export function reviewProblems(state: OpeningState, plan: PlanOption | undefined): string[] {
  const problems: string[] = [];
  if (!plan) { problems.push("Choose a savings plan."); return problems; }
  if (state.holders.length < plan.minHolders) {
    problems.push(plan.minHolders === 1 ? "Add the account holder." : `Add at least ${plan.minHolders} holders for the ${plan.planName} plan.`);
  }
  if (state.holders.length > plan.maxHolders) problems.push(`The ${plan.planName} plan allows at most ${plan.maxHolders} holders.`);
  if (allowsMandate(plan) && state.mandateType === "") problems.push("Choose how withdrawals are authorised.");
  if (!isValidDeposit(state.deposit)) problems.push("Enter the initial deposit as an amount such as 5000.00 (at most two decimals).");
  return problems;
}

export function buildOpenBody(state: OpeningState, plan: PlanOption, branchId: string): OpenAccountBody {
  const body: OpenAccountBody = {
    planId: plan.planId,
    branchId,
    holders: state.holders.map((holder, index) => ({ customerId: holder.customerId, holderType: holderRole(index) })),
  };
  if (allowsMandate(plan) && state.mandateType !== "") body.mandate = { type: state.mandateType };
  const deposit = state.deposit.trim();
  if (deposit !== "") body.initialDeposit = deposit;
  return body;
}

/** Stable text for a request, so the idempotency key changes only when the request does. */
export function fingerprint(body: OpenAccountBody): string {
  return JSON.stringify({
    p: body.planId, b: body.branchId,
    h: body.holders.map(holder => `${holder.holderType}:${holder.customerId}`),
    m: body.mandate?.type ?? null, d: body.initialDeposit ?? null,
  });
}

export interface KeyRecord { key: string; fingerprint: string }

export function newIdempotencyKey(): string {
  return `acct-${globalThis.crypto.randomUUID()}`;
}

/** Reuses the key for an identical retry; issues a new one when the request changed. */
export function keyFor(current: KeyRecord | null, body: OpenAccountBody, generate: () => string = newIdempotencyKey): KeyRecord {
  const print = fingerprint(body);
  return current && current.fingerprint === print ? current : { key: generate(), fingerprint: print };
}

export type ErrorField = "plan" | "holders" | "mandate" | "deposit" | "general";

export interface ErrorView { field: ErrorField; message: string; newKey: boolean }

const FIELD_BY_CODE: Record<string, ErrorField> = {
  PLAN_NOT_FOUND: "plan", PLAN_ELIGIBILITY_FAILED: "holders", INVALID_HOLDER_COUNT: "holders",
  INVALID_HOLDERS_PAYLOAD: "holders", HOLDER_NOT_FOUND: "holders", MISSING_PRIMARY_HOLDER: "holders",
  DOCUMENTS_NOT_VERIFIED: "holders", UNDERAGE_HOLDER: "holders", DUPLICATE_HOLDER: "holders",
  MANDATE_REQUIRED: "mandate", MANDATE_NOT_ALLOWED: "mandate", INVALID_MANDATE_TYPE: "mandate",
  INVALID_MANDATE_SIGNATORIES: "mandate",
  BELOW_MINIMUM_BALANCE: "deposit", INVALID_DEPOSIT_AMOUNT: "deposit", OUTSIDE_BUSINESS_HOURS: "deposit",
  CHANNEL_UNAVAILABLE: "deposit",
};

/** Decides where an API error is shown and whether the next attempt needs a fresh idempotency key. */
export function describeError(error: { code: string; message: string }): ErrorView {
  if (error.code === "IDEMPOTENCY_KEY_REUSED") {
    return { field: "general", message: "This application changed after an earlier attempt. Review it and submit again.", newKey: true };
  }
  return { field: FIELD_BY_CODE[error.code] ?? "general", message: error.message, newKey: false };
}
