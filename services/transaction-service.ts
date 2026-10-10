import "server-only";
import { withTransaction } from "@/lib/db";
import { NotAuthorizedError, NotFoundError, ValidationError } from "@/lib/db/errors";
import { setRlsContext } from "@/lib/db/rls-context";
import type { AuthenticatedUser } from "@/lib/auth/rbac";
import { depositSchema, withdrawalSchema, reversalSchema, transferSchema } from "@/lib/validation/transaction";
import { throwTransactionDatabaseError, withdrawalRejectionError } from "./transaction-errors";
import { z } from "zod";

const uuid = z.string().uuid();
function validateId(value: string): void {
  if (!uuid.safeParse(value).success) throw new ValidationError("Invalid identifier.");
}

export type TransactionActor = Pick<AuthenticatedUser, "userId" | "roleName" | "branchId">;

/** One scoped read transaction supplies posting channels and a customer's owned active accounts. */
export async function getPostingChoices(actor: TransactionActor) {
  validateActor(actor, ['AGENT','BRANCH_MANAGER','CUSTOMER']);
  return withTransaction(async tx => {
    await setRlsContext(tx, actor);
    const channels=(await tx.query<{channelId:string;channelName:string}>(`SELECT channel_id AS "channelId",channel_name AS "channelName"
      FROM transaction_channel WHERE status='ACTIVE' AND channel_name<>'SYSTEM' ORDER BY channel_name`)).rows;
    const ownAccounts=actor.roleName==='CUSTOMER' ? (await tx.query<{accountId:string;accountNumber:string;currentBalance:string}>(
      `SELECT account_id AS "accountId",account_number AS "accountNumber",current_balance AS "currentBalance"
       FROM account WHERE status='ACTIVE' ORDER BY account_number`)).rows : undefined;
    return {channels,ownAccounts};
  });
}

function validateActor(actor: TransactionActor, allowed: readonly string[]) {
  if (!allowed.includes(actor.roleName)) throw new NotAuthorizedError();
  return actor;
}

/** One transaction owns idempotency, ledger posting, balance and audit. */
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
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('deposit:' || $1,0))", [idempotencyKey]);
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

/** One transaction posts the withdrawal or commits a known rejection audit before returning an error. */
export async function postWithdrawal(
  input: unknown,
  actor: TransactionActor,
  idempotencyKey: string
) {
  validateActor(actor, ["AGENT", "BRANCH_MANAGER", "CUSTOMER"]);
  const parsed = withdrawalSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid withdrawal payload.");
  const value = parsed.data;

  const result = await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    try {
      let signers = value.signerCustomerIds ?? (value.onBehalfOfCustomerId ? [value.onBehalfOfCustomerId] : []);
      if (actor.roleName === "CUSTOMER") {
        const profile = (await tx.query<{ customer_id: string }>(
          "SELECT customer_id FROM customer WHERE app_user_id=$1 AND status='ACTIVE'", [actor.userId]
        )).rows[0];
        if (!profile || signers.some(id => id !== profile.customer_id)) throw new NotAuthorizedError();
        signers = [profile.customer_id];
      } else if (signers.length === 0) {
        throw new ValidationError("Customer signer evidence is required.");
      }
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('withdrawal:'||$1,0))",[idempotencyKey]);
      const existing = await tx.query("SELECT transaction_id FROM transaction WHERE idempotency_key=$1", [idempotencyKey]);
      const res = await tx.query<{
        p_transaction_id: string; p_reference_number: string; p_balance_after: string;
        p_posted_at: Date; p_rejection_code: string | null;
      }>(actor.roleName === "CUSTOMER"
        ? "CALL sp_try_customer_withdrawal($1,$2,$3,$4,$5::uuid[],$6,$7,NULL,NULL,NULL,NULL,NULL)"
        : "CALL sp_try_post_withdrawal($1,$2,$3,$4,$5::uuid[],$6,$7,NULL,NULL,NULL,NULL,NULL)",
        [value.accountId, value.amount, value.channelId, actor.userId, signers, idempotencyKey, value.narration ?? null]);
      const out = res.rows[0];
      if (!out) throw new Error("Withdrawal receipt unavailable.");
      return {
        rejectionCode: out.p_rejection_code,
        replayed: (existing.rowCount ?? 0) > 0,
        data: {
          transactionId: out.p_transaction_id, referenceNumber: out.p_reference_number,
          amount: value.amount, balanceAfter: out.p_balance_after, postedAt: out.p_posted_at
        }
      };
    } catch (err) {
      throwTransactionDatabaseError(err);
    }
  });
  // Known rejections have durable audit evidence. Throw only after that transaction commits.
  if (result.rejectionCode) throw withdrawalRejectionError(result.rejectionCode);
  return { replayed: result.replayed, data: result.data };
}

/** One transaction owns the compensating entry, balance and audit. */
export async function reverseTransaction(
  transactionId: string,
  input: unknown,
  actor: TransactionActor,
  idempotencyKey: string
) {
  validateActor(actor, ["BRANCH_MANAGER"]);
  validateId(transactionId);
  const parsed = reversalSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid reversal payload.");
  const value = parsed.data;

  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    try {
      const res = await tx.query(
        `CALL sp_reverse_transaction_controlled($1, $2, $3, $4, NULL, NULL, NULL)`,
        [transactionId, value.reason, actor.userId, idempotencyKey]
      );
      const out = res.rows[0];
      const link=(await tx.query<{reversal_id:string}>('SELECT reversal_id FROM transaction_reversal WHERE reversal_transaction_id=$1',[out.p_reversal_transaction_id])).rows[0];
      if(!link)throw new Error('Reversal control unavailable.');
      return {
        data: {
          reversalId: link.reversal_id,
          reversalTransactionId: out.p_reversal_transaction_id,
          balanceAfter: out.p_balance_after
        }
      };
    } catch (err) {
      throwTransactionDatabaseError(err);
    }
  });
}

/** One read transaction sets caller RLS context and reads a scoped statement. */
export async function getStatement(accountId: string, actor: TransactionActor, page = 1, pageSize = 20) {
  validateActor(actor, ["AGENT", "BRANCH_MANAGER", "AUDITOR", "CUSTOMER"]);
  validateId(accountId);
  if (!Number.isInteger(page) || page < 1 || page > 1000000
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ValidationError("Invalid statement pagination.");
  }
  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    
    // Validate account visibility first
    const acc = await tx.query(`SELECT current_balance FROM account WHERE account_id = $1`, [accountId]);
    if (acc.rowCount === 0) throw new NotFoundError("Account");

    const offset = (page - 1) * pageSize;
    const res = await tx.query(
      `SELECT transaction_id as "transactionId", reference_number as "referenceNumber",
              transaction_type as "transactionType", amount, transaction_date as "transactionDate",
              balance_after as "balanceAfter", narration
       FROM transaction
       WHERE account_id = $1
       ORDER BY ledger_seq DESC
       LIMIT $2 OFFSET $3`,
      [accountId, pageSize, offset]
    );

    const totalRes = await tx.query(`SELECT COUNT(*) as total FROM transaction WHERE account_id = $1`, [accountId]);
    const total = parseInt(totalRes.rows[0].total, 10);

    return {
      data: res.rows,
      meta: { page, pageSize, total }
    };
  }, { isolationLevel: "REPEATABLE READ" });
}

/** One read transaction sets caller RLS context and reads a visible ledger row. */
export async function getTransaction(transactionId: string, actor: TransactionActor) {
  validateActor(actor, ["AGENT", "BRANCH_MANAGER", "AUDITOR", "CUSTOMER"]);
  validateId(transactionId);
  return await withTransaction(async (tx) => {
    await setRlsContext(tx, { userId: actor.userId, branchId: actor.branchId, roleName: actor.roleName });
    
    const res = await tx.query(
      `SELECT t.transaction_id as "transactionId", t.account_id as "accountId", 
              t.reference_number as "referenceNumber", t.transaction_type as "transactionType", 
              t.amount, t.transaction_date as "transactionDate", t.balance_after as "balanceAfter", 
              t.narration,
              (t.transaction_type IN ('DEPOSIT','WITHDRAWAL','TRANSFER_IN','TRANSFER_OUT')
                AND NOT EXISTS(SELECT 1 FROM fixed_deposit f WHERE f.funding_transaction_id=t.transaction_id)
                AND t.narration IS DISTINCT FROM 'Fixed Deposit Opening Principal Debit') AS "canReverse",
              CASE WHEN r.reversal_id IS NOT NULL THEN true ELSE false END as "isReversed"
       FROM transaction t
       LEFT JOIN transaction_reversal r ON t.transaction_id = r.original_transaction_id
       WHERE t.transaction_id = $1`,
      [transactionId]
    );

    if (res.rowCount === 0) throw new NotFoundError("Transaction");
    
    return { data: res.rows[0] };
  });
}

/** One transaction locks both accounts and owns both transfer legs, balances and audit. */
export async function postTransfer(input:unknown,actor:TransactionActor,idempotencyKey:string) {
  validateActor(actor,['AGENT','BRANCH_MANAGER']);
  const parsed=transferSchema.safeParse(input);
  if(!parsed.success)throw new ValidationError('Invalid transfer payload.');
  const v=parsed.data;
  return withTransaction(async tx=>{
    await setRlsContext(tx,actor);
    try {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('transfer:'||$1,0))",[idempotencyKey]);
      const existing=await tx.query('SELECT transaction_id FROM transaction WHERE idempotency_key=$1',[idempotencyKey]);
      const result=await tx.query(`SELECT transfer_group_id AS "transferGroupId",debit_id AS "debitTransactionId",
        credit_id AS "creditTransactionId",source_balance AS "sourceBalance",destination_balance AS "destinationBalance"
        FROM fn_post_staff_transfer($1,$2,$3,$4,$5::uuid[],$6,$7)`,
        [v.sourceAccountId,v.destinationAccountId,v.amount,actor.userId,v.signerCustomerIds,idempotencyKey,v.narration??null]);
      return {replayed:!!existing.rowCount,data:result.rows[0]};
    }catch(error){throwTransactionDatabaseError(error);}
  });
}

/** One RLS-scoped read lists the customer's active and closed accounts for statement access. */
export async function getOwnedAccounts(actor:TransactionActor){validateActor(actor,['CUSTOMER']);return withTransaction(async tx=>{
 await setRlsContext(tx,actor);return (await tx.query(`SELECT account_id AS "accountId",account_number AS "accountNumber",current_balance AS "currentBalance",status FROM account ORDER BY account_number`)).rows;
});}
