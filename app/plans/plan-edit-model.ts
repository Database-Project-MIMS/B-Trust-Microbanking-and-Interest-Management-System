// Pure rules for the savings-plan edit dialog. The screen checks what it cheaply can so a typo never
// reaches the API as something else (usability); the API and database remain authoritative.
// Money and rates stay strings; ages and holder counts are only converted after they are proven to be whole numbers.
import type { SavingsPlan } from "@/services/savings-plan-service";

export interface EditDraft {
  interestRate: string;
  minBalance: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  minAgeYears: string;
  maxAgeYears: string;
  minHolders: string;
  maxHolders: string;
  requiresAllAdult: boolean;
}

export type DraftField = "interestRate" | "minBalance" | "minAgeYears" | "maxAgeYears" | "minHolders" | "maxHolders";
export type DraftErrors = Partial<Record<DraftField, string>>;

export function draftFromPlan(plan: SavingsPlan): EditDraft {
  return {
    interestRate: plan.interestRate,
    minBalance: plan.minBalance,
    description: plan.description ?? "",
    status: plan.status,
    minAgeYears: plan.minAgeYears == null ? "" : String(plan.minAgeYears),
    maxAgeYears: plan.maxAgeYears == null ? "" : String(plan.maxAgeYears),
    minHolders: String(plan.minHolders),
    maxHolders: String(plan.maxHolders),
    requiresAllAdult: plan.requiresAllAdult,
  };
}

const WHOLE = /^\d{1,3}$/;
// A fraction in (0, 1] with up to four decimals, e.g. 0.1300.
const RATE = /^(0(\.\d{1,4})?|1(\.0{1,4})?)?$/;

/** Returns a plain-language message per invalid field; an empty object means the draft may be saved. */
export function validateDraft(draft: EditDraft): DraftErrors {
  const errors: DraftErrors = {};
  const rate = draft.interestRate.trim();
  if (rate === "" || !RATE.test(rate) || !/[1-9]/.test(rate)) errors.interestRate = "Enter the rate as a fraction between 0 and 1, such as 0.1300.";
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(draft.minBalance.trim())) errors.minBalance = "Enter an amount such as 1000.00 (at most two decimals).";

  const age = (field: "minAgeYears" | "maxAgeYears") => {
    const text = draft[field].trim();
    if (text === "") return;
    if (!WHOLE.test(text) || Number(text) > 120) errors[field] = "Enter a whole number of years from 0 to 120, or leave it blank for no limit.";
  };
  age("minAgeYears"); age("maxAgeYears");
  if (!errors.minAgeYears && !errors.maxAgeYears && draft.minAgeYears.trim() !== "" && draft.maxAgeYears.trim() !== ""
    && Number(draft.maxAgeYears) < Number(draft.minAgeYears)) errors.maxAgeYears = "The maximum age cannot be below the minimum age.";

  const holders = (field: "minHolders" | "maxHolders") => {
    const text = draft[field].trim();
    if (!WHOLE.test(text) || Number(text) < 1 || Number(text) > 20) errors[field] = "Enter a whole number of holders from 1 to 20.";
  };
  holders("minHolders"); holders("maxHolders");
  if (!errors.minHolders && !errors.maxHolders && Number(draft.maxHolders) < Number(draft.minHolders)) errors.maxHolders = "The maximum holders cannot be below the minimum.";
  return errors;
}

/**
 * Builds a PATCH body with only the fields that changed. Call it only for a draft that passed validateDraft:
 * a field that is not a whole number is skipped rather than ever being sent as NaN (which JSON turns into null).
 */
export function diffDraft(original: SavingsPlan, draft: EditDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (draft.interestRate.trim() !== original.interestRate) body.interestRate = draft.interestRate.trim();
  if (draft.minBalance.trim() !== original.minBalance) body.minBalance = draft.minBalance.trim();
  const description = draft.description.trim() === "" ? null : draft.description.trim();
  if (description !== original.description) body.description = description;
  if (draft.status !== original.status) body.status = draft.status;

  const optionalYears = (text: string): number | null | undefined => {
    const value = text.trim();
    if (value === "") return null;
    return WHOLE.test(value) ? Number(value) : undefined;
  };
  const minAge = optionalYears(draft.minAgeYears);
  if (minAge !== undefined && minAge !== original.minAgeYears) body.minAgeYears = minAge;
  const maxAge = optionalYears(draft.maxAgeYears);
  if (maxAge !== undefined && maxAge !== original.maxAgeYears) body.maxAgeYears = maxAge;

  const count = (text: string): number | undefined => (WHOLE.test(text.trim()) ? Number(text.trim()) : undefined);
  const minHolders = count(draft.minHolders);
  if (minHolders !== undefined && minHolders !== original.minHolders) body.minHolders = minHolders;
  const maxHolders = count(draft.maxHolders);
  if (maxHolders !== undefined && maxHolders !== original.maxHolders) body.maxHolders = maxHolders;
  if (draft.requiresAllAdult !== original.requiresAllAdult) body.requiresAllAdult = draft.requiresAllAdult;
  return body;
}
