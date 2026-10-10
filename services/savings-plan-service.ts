import "server-only";
import { query, withTransaction } from "@/lib/db";
import { NotFoundError } from "@/lib/db/errors";
import type { UpdateSavingsPlanInput } from "@/lib/validation/savings-plan";
import { throwSavingsPlanDatabaseError } from "@/services/savings-plan-errors";

interface SavingsPlanRow {
  plan_id: string;
  plan_name: string;
  interest_rate: string;
  min_balance: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  min_age_years: number | null;
  max_age_years: number | null;
  min_holders: number;
  max_holders: number;
  requires_all_adult: boolean;
  created_at: Date;
  updated_at: Date | null;
}

export interface SavingsPlan {
  planId: string;
  planName: string;
  interestRate: string;
  minBalance: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  minAgeYears: number | null;
  maxAgeYears: number | null;
  minHolders: number;
  maxHolders: number;
  requiresAllAdult: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

function mapPlan(row: SavingsPlanRow): SavingsPlan {
  return {
    planId: row.plan_id,
    planName: row.plan_name,
    interestRate: row.interest_rate,
    minBalance: row.min_balance,
    description: row.description,
    status: row.status,
    minAgeYears: row.min_age_years,
    maxAgeYears: row.max_age_years,
    minHolders: row.min_holders,
    maxHolders: row.max_holders,
    requiresAllAdult: row.requires_all_adult,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lists all savings plans. Bank-wide reference data, no branch scope. */
export async function listSavingsPlans(): Promise<SavingsPlan[]> {
  const rows = await query<SavingsPlanRow>(
    `SELECT plan_id, plan_name, interest_rate, min_balance, description, status,
            min_age_years, max_age_years, min_holders, max_holders, requires_all_adult,
            created_at, updated_at
       FROM savings_plan
      ORDER BY plan_name`,
  );

  return rows.map(mapPlan);
}

/**
 * Updates one savings plan's rate, minimum balance, description, status or
 * eligibility columns. Single transaction: lock the row, re-validate the merged
 * age/holder ranges against the current row (a partial update's un-sent field
 * still has to satisfy the DB's CHECK constraints against the full resulting
 * row), then update in place.
 *
 * savings_plan has no effective_from/effective_to (unlike fd_plan) — a rate
 * change here is an ordinary column update, never an insert-new-row branch.
 */
export async function updateSavingsPlan(
  planId: string,
  input: UpdateSavingsPlanInput,
): Promise<SavingsPlan> {
  return withTransaction(async (tx) => {
    const current = await tx.query<SavingsPlanRow>(
      "SELECT * FROM savings_plan WHERE plan_id = $1 FOR UPDATE",
      [planId],
    );

    const row = current.rows[0];
    if (!row) {
      throw new NotFoundError("Savings plan");
    }

    const effectiveMinAge = "minAgeYears" in input ? input.minAgeYears : row.min_age_years;
    const effectiveMaxAge = "maxAgeYears" in input ? input.maxAgeYears : row.max_age_years;
    if (
      effectiveMinAge != null &&
      effectiveMaxAge != null &&
      effectiveMaxAge < effectiveMinAge
    ) {
      throwSavingsPlanDatabaseError({ code: "23514", constraint: "chk_savings_plan_age_range" });
    }

    const effectiveMinHolders = input.minHolders ?? row.min_holders;
    const effectiveMaxHolders = input.maxHolders ?? row.max_holders;
    if (effectiveMaxHolders < effectiveMinHolders) {
      throwSavingsPlanDatabaseError({ code: "23514", constraint: "chk_savings_plan_holder_range" });
    }

    try {
      const result = await tx.query<SavingsPlanRow>(
        `UPDATE savings_plan SET
           interest_rate      = COALESCE($1, interest_rate),
           min_balance        = COALESCE($2, min_balance),
           description        = CASE WHEN $3::boolean THEN $4 ELSE description END,
           status             = COALESCE($5, status),
           min_age_years      = CASE WHEN $6::boolean THEN $7 ELSE min_age_years END,
           max_age_years      = CASE WHEN $8::boolean THEN $9 ELSE max_age_years END,
           min_holders        = COALESCE($10, min_holders),
           max_holders        = COALESCE($11, max_holders),
           requires_all_adult = COALESCE($12, requires_all_adult),
           updated_at         = now()
         WHERE plan_id = $13
         RETURNING plan_id, plan_name, interest_rate, min_balance, description, status,
                   min_age_years, max_age_years, min_holders, max_holders, requires_all_adult,
                   created_at, updated_at`,
        [
          input.interestRate ?? null,
          input.minBalance ?? null,
          "description" in input,
          input.description ?? null,
          input.status ?? null,
          "minAgeYears" in input,
          input.minAgeYears ?? null,
          "maxAgeYears" in input,
          input.maxAgeYears ?? null,
          input.minHolders ?? null,
          input.maxHolders ?? null,
          input.requiresAllAdult ?? null,
          planId,
        ],
      );

      // TODO(P01-M01-T05 dependency): once `audit_log` ships (owned by M1, not yet
      // built anywhere in this codebase), insert an audit row here inside this same
      // transaction (before/after values, actor user id, action='SAVINGS_PLAN_UPDATE')
      // so the update and its audit trail commit atomically. Not implemented now —
      // do not write to a table that doesn't exist yet (AGENTS.md: never invent schema).

      const updated = result.rows[0];
      if (!updated) {
        throw new NotFoundError("Savings plan");
      }

      return mapPlan(updated);
    } catch (error) {
      throwSavingsPlanDatabaseError(error);
    }
  });
}
