import "server-only";
import { withTransaction, query } from "@/lib/db";
import { NotAuthorizedError, ValidationError } from "@/lib/db/errors";
import { setRlsContext } from "@/lib/db/rls-context";
import type { AuthenticatedUser } from "@/lib/auth/rbac";
import { depositSchema, withdrawalSchema, reversalSchema } from "@/lib/validation/transaction";
import { throwTransactionDatabaseError } from "./transaction-errors";

export type TransactionActor = Pick<AuthenticatedUser, "userId" | "roleName" | "branchId">;

function validateActor(actor: TransactionActor, allowed: readonly string[]) {
  if (!allowed.includes(actor.roleName)) throw new NotAuthorizedError();
  return actor;
}

export async function postDeposit(
  input: unknown,
  actor: TransactionActor,
  idempotencyKey: string
) {
  validateActor(actor, ["AGENT", "BRANCH_MANAGER"]);
  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid deposit payload.");
  const value = parsed.data;

  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    try {
      const existing = await tx.query(`SELECT transaction_id FROM transaction WHERE idempotency_key = $1`, [idempotencyKey]);
      const replayed = (existing.rowCount ?? 0) > 0;

      const res = await tx.query(
        `CALL sp_post_deposit($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL)`,
        [value.accountId, value.amount, value.channelId, actor.userId, idempotencyKey, value.narration ?? null]
      );
      const out = res.rows[0];

      return {
        replayed,
        data: {
          transactionId: out.p_transaction_id,
          referenceNumber: out.p_reference_number,
          amount: value.amount,
          balanceAfter: out.p_balance_after,
          postedAt: out.p_posted_at
        }
      };
    } catch (err) {
      throwTransactionDatabaseError(err);
    }
  });
}

export async function postWithdrawal(
  input: unknown,
  actor: TransactionActor,
  idempotencyKey: string
) {
  validateActor(actor, ["AGENT", "BRANCH_MANAGER", "CUSTOMER"]);
  const parsed = withdrawalSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid withdrawal payload.");
  const value = parsed.data;

  // CUSTOMER can only act on behalf of themselves
  if (actor.roleName === "CUSTOMER") {
    if (value.onBehalfOfCustomerId && value.onBehalfOfCustomerId !== actor.userId) {
      throw new NotAuthorizedError();
    }
    value.onBehalfOfCustomerId = actor.userId;
  }

  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    try {
      const existing = await tx.query(`SELECT transaction_id FROM transaction WHERE idempotency_key = $1`, [idempotencyKey]);
      const replayed = (existing.rowCount ?? 0) > 0;

      // Notice sp_post_withdrawal has 11 arguments
      const res = await tx.query(
        `CALL sp_post_withdrawal($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NULL, NULL)`,
        [
          value.accountId, value.amount, value.channelId, actor.userId,
          value.onBehalfOfCustomerId ?? actor.userId, idempotencyKey, value.narration ?? null
        ]
      );
      const out = res.rows[0];

      return {
        replayed,
        data: {
          transactionId: out.p_transaction_id,
          referenceNumber: out.p_reference_number,
          amount: value.amount,
          balanceAfter: out.p_balance_after,
          postedAt: out.p_posted_at
        }
      };
    } catch (err) {
      throwTransactionDatabaseError(err);
    }
  });
}

export async function reverseTransaction(
  transactionId: string,
  input: unknown,
  actor: TransactionActor
) {
  validateActor(actor, ["BRANCH_MANAGER", "ADMIN"]);
  const parsed = reversalSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid reversal payload.");
  const value = parsed.data;

  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    try {
      const res = await tx.query(
        `CALL sp_reverse_transaction($1, $2, $3, NULL, NULL, NULL)`,
        [transactionId, value.reason, actor.userId]
      );
      const out = res.rows[0];
      return {
        data: {
          reversalId: out.p_reversal_id,
          reversalTransactionId: out.p_reversal_transaction_id,
          balanceAfter: out.p_balance_after
        }
      };
    } catch (err) {
      throwTransactionDatabaseError(err);
    }
  });
}

export async function getStatement(accountId: string, actor: TransactionActor, page = 1, pageSize = 20) {
  validateActor(actor, ["AGENT", "BRANCH_MANAGER", "AUDITOR", "CUSTOMER"]);
  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    
    // Validate account visibility first
    const acc = await tx.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId]);
    if (acc.rowCount === 0) throw new ValidationError("Account not found or not accessible");

    const offset = (page - 1) * pageSize;
    const res = await tx.query(
      `SELECT transaction_id as "transactionId", reference_number as "referenceNumber",
              transaction_type as "transactionType", amount, transaction_date as "transactionDate",
              balance_after as "balanceAfter", narration
       FROM transaction
       WHERE account_id = $1
       ORDER BY transaction_date DESC
       LIMIT $2 OFFSET $3`,
      [accountId, pageSize, offset]
    );

    const totalRes = await tx.query(`SELECT COUNT(*) as total FROM transaction WHERE account_id = $1`, [accountId]);
    const total = parseInt(totalRes.rows[0].total, 10);

    return {
      data: res.rows,
      meta: { page, pageSize, total }
    };
  });
}

export async function getTransaction(transactionId: string, actor: TransactionActor) {
  validateActor(actor, ["AGENT", "BRANCH_MANAGER", "AUDITOR", "CUSTOMER"]);
  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    
    const res = await tx.query(
      `SELECT t.transaction_id as "transactionId", t.account_id as "accountId", 
              t.reference_number as "referenceNumber", t.transaction_type as "transactionType", 
              t.amount, t.transaction_date as "transactionDate", t.balance_after as "balanceAfter", 
              t.narration,
              CASE WHEN r.reversal_id IS NOT NULL THEN true ELSE false END as "isReversed"
       FROM transaction t
       LEFT JOIN transaction_reversal r ON t.transaction_id = r.original_transaction_id
       WHERE t.transaction_id = $1`,
      [transactionId]
    );

    if (res.rowCount === 0) throw new ValidationError("Transaction not found or not accessible");
    
    return { data: res.rows[0] };
  });
}
