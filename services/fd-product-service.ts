import "server-only";
import { query, withTransaction } from "@/lib/db/query";

export interface FdProduct {
  fdPlanId: string;
  planName: string;
  tenureMonths: number;
  interestRate: string;
  description: string | null;
  status: string;
  effectiveFrom: Date | string | null;
  effectiveTo: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

function mapRow(row: any): FdProduct {
  return {
    fdPlanId: row.fd_plan_id,
    planName: row.plan_name,
    tenureMonths: row.tenure_months,
    interestRate: row.interest_rate,
    description: row.description,
    status: row.status,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lists all FD products. Reads within a single query. */
export async function listFdProducts(): Promise<FdProduct[]> {
  const rows = await query(`
    SELECT fd_plan_id, plan_name, tenure_months, interest_rate,
           description, status, effective_from, effective_to,
           created_at, updated_at
    FROM fd_plan
    ORDER BY tenure_months ASC
  `);
  return rows.map(mapRow);
}

/** Updates an FD product's rate or status. Wraps in a transaction for audit. */
export async function updateFdProduct(
  id: string,
  updates: { interestRate?: string; status?: string; description?: string }
): Promise<FdProduct> {
  return withTransaction(async (tx) => {
    const currentRows = await tx.query(
      "SELECT * FROM fd_plan WHERE fd_plan_id = $1 FOR UPDATE",
      [id]
    );

    if (currentRows.rows.length === 0) {
      throw new Error(`FD Product with id ${id} not found.`);
    }

    const current = currentRows.rows[0];

    // Rate changes should create effective-dating records (set effective_to on old, insert new)
    if (updates.interestRate && updates.interestRate !== current.interest_rate) {
      // Because fd_plan.plan_name is UNIQUE, we append a timestamp to the old plan name 
      // so the new record can take the canonical plan_name.
      const historicalName = `${current.plan_name} (expired ${new Date().getTime()})`;
      
      await tx.query(
        `UPDATE fd_plan 
         SET effective_to = CURRENT_DATE, 
             status = 'INACTIVE', 
             plan_name = $1,
             updated_at = now()
         WHERE fd_plan_id = $2`,
        [historicalName, id]
      );

      const insertResult = await tx.query(
        `INSERT INTO fd_plan (
           plan_name, tenure_months, interest_rate, description, status, effective_from
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING *`,
        [
          current.plan_name,
          current.tenure_months,
          updates.interestRate,
          updates.description ?? current.description,
          updates.status ?? 'ACTIVE',
        ]
      );
      
      return mapRow(insertResult.rows[0]);
    }

    // If only updating status or description without rate change, update in place
    const updateResult = await tx.query(
      `UPDATE fd_plan
       SET status = COALESCE($1, status),
           description = COALESCE($2, description),
           updated_at = now()
       WHERE fd_plan_id = $3
       RETURNING *`,
      [updates.status ?? null, updates.description ?? null, id]
    );

    return mapRow(updateResult.rows[0]);
  });
}
