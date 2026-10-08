import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { logQueryError, withTransaction } from "@/lib/db";
import { DatabaseError, NotAuthorizedError, NotFoundError, ValidationError, isRetryable } from "@/lib/db/errors";
import { setRlsContext } from "@/lib/db/rls-context";
import type { AuthenticatedUser } from "@/lib/auth/rbac";
import type { AccountFixedDeposit } from "@/types/account-fixed-deposit";
import {
  accountIdSchema, accountSearchSchema, addHolderSchema, idempotencyKeySchema, openAccountSchema,
  type OpenAccountInput,
} from "@/lib/validation/account";
import { AccountRuleError, throwAccountDatabaseError } from "@/services/account-errors";

export type AccountActor = Pick<AuthenticatedUser, "userId" | "roleName" | "branchId">;
type Tx = Parameters<typeof setRlsContext>[0];
interface ActorScope { userId: string; roleName: string; branchId: string | null }

const OPEN_ROLES = ["AGENT", "BRANCH_MANAGER"] as const;
const HOLDER_ROLES = ["BRANCH_MANAGER"] as const;
const CLOSE_ROLES = ["BRANCH_MANAGER"] as const;
const READ_ROLES = ["AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR"] as const;
const DETAIL_ROLES = [...READ_ROLES, "CUSTOMER"] as const;
const BRANCH_ROLES: readonly string[] = ["AGENT", "BRANCH_MANAGER"];
const actorSchema = z.object({ userId: z.string().uuid(), roleName: z.string(), branchId: z.string().uuid().nullable() });

export interface OpenedAccount { accountId: string; accountNumber: string; currentBalance: string }
export interface AccountSummary {
  accountId: string; accountNumber: string; status: string; currentBalance: string; openedDate: string;
  branchId: string; planId: string; planName: string; holderCount: number; primaryHolderName: string | null;
}
export interface AccountSearchResult { accounts: AccountSummary[]; total: number; page: number; pageSize: number }
export interface AccountDetail extends AccountSummary {
  minBalance: string; minHolders: number; maxHolders: number;
  /** Balance above the plan minimum, never negative; computed in SQL. */
  availableToWithdraw: string;
  lastTransaction: { transactionType: string; amount: string; transactionDate: string; referenceNumber: string } | null;
  holders: { accountHolderId: string; customerId: string; customerNumber: string; fullName: string; holderType: string; joinedDate: string }[];
  mandate: { mandateType: string; requiredSignatories: number; effectiveFrom: string; effectiveTo: string | null;
    state: "EFFECTIVE" | "NOT_YET_EFFECTIVE" | "EXPIRED" } | null;
  /**
   * Newest opening first, with exact money/rate strings (the rate is the snapshot taken at opening). Read under the
   * caller's row-level security (fixed_deposit policies, 0420/0421). `null` means the list could not be read: the
   * rest of the account is still returned, and the page must not claim there are no deposits.
   */
  fixedDeposits: AccountFixedDeposit[] | null;
}

// An AGENT sees only accounts held by a customer actively assigned to them (as the customer API does);
// managers and bank-wide roles are not narrowed. $-numbers are bound by each query below.
const assignedTo = (role: string, user: string) => `(${role}::text <> 'AGENT' OR EXISTS (
    SELECT 1 FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id
     WHERE ah.account_id = a.account_id AND ca.agent_id = ${user}::uuid AND ca.is_active))`;

function validateActor(actor: AccountActor, allowed: readonly string[]): AccountActor {
  const result = actorSchema.safeParse(actor);
  if (!result.success || !allowed.includes(result.data.roleName)) throw new NotAuthorizedError();
  return result.data;
}

/** Re-reads user, role and agent/branch state inside the transaction, then sets the RLS/audit identity. */
async function resolveScope(tx: Tx, actor: AccountActor, allowed: readonly string[]): Promise<ActorScope> {
  const result = await tx.query<{ role_name: string }>(
    `SELECT r.role_name FROM app_user u JOIN role r ON r.role_id = u.role_id
      WHERE u.user_id = $1 AND u.status = 'ACTIVE' AND r.status = 'ACTIVE' FOR SHARE OF u`, [actor.userId],
  );
  const current = result.rows[0];
  if (!current || current.role_name !== actor.roleName || !allowed.includes(current.role_name)) throw new NotAuthorizedError();
  let branchId: string | null = null;
  if (BRANCH_ROLES.includes(current.role_name)) {
    const profile = await tx.query<{ branch_id: string }>(
      `SELECT a.branch_id FROM agent a JOIN branch b ON b.branch_id = a.branch_id
        WHERE a.agent_id = $1 AND a.status = 'ACTIVE' AND b.status = 'ACTIVE' FOR SHARE OF a, b`, [actor.userId],
    );
    branchId = profile.rows[0]?.branch_id ?? null;
    if (!branchId || branchId !== actor.branchId) throw new NotAuthorizedError();
  }
  await setRlsContext(tx, { userId: actor.userId, branchId, roleName: current.role_name });
  return { userId: actor.userId, roleName: current.role_name, branchId };
}

/** Stable SHA-256 of the request (sorted keys, holders ordered), so a replay can be told from a changed body. */
function requestHash(value: OpenAccountInput): string {
  const canonical = {
    branchId: value.branchId, planId: value.planId, initialDeposit: value.initialDeposit ?? null,
    holders: [...value.holders].sort((a, b) => a.customerId.localeCompare(b.customerId))
      .map(holder => ({ customerId: holder.customerId, holderType: holder.holderType })),
    mandate: value.mandate ? { type: value.mandate.type, requiredSignatories: value.mandate.requiredSignatories ?? null } : null,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * Opens an account through sp_open_savings_account in ONE transaction, with an idempotency record
 * written in the same transaction. A repeated key with the same request replays the original result
 * (replayed = true); the same key with a different request is rejected (422).
 */
export async function openAccount(
  input: unknown, actor: AccountActor, idempotencyKey: string,
): Promise<{ data: OpenedAccount; replayed: boolean }> {
  const authenticated = validateActor(actor, OPEN_ROLES);
  const key = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!key.success) throw new ValidationError("A valid Idempotency-Key is required.");
  const parsed = openAccountSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Account opening contains invalid or missing fields.");
  const value = parsed.data;
  const hash = requestHash(value);

  return withTransaction(async tx => {
    const scope = await resolveScope(tx, authenticated, OPEN_ROLES);
    // ADR-0008: the owning branch comes from trusted scope, never from the request alone.
    if (value.branchId !== scope.branchId) throw new NotAuthorizedError();

    // An AGENT may open accounts only for customers actively assigned to them, so the account they open
    // stays visible to them. The same answer as an unknown customer, to avoid confirming that one exists.
    if (scope.roleName === "AGENT") {
      const ids = [...new Set(value.holders.map(holder => holder.customerId))];
      const assigned = await tx.query<{ n: number }>(
        "SELECT count(DISTINCT customer_id)::int AS n FROM customer_agent WHERE agent_id = $1 AND is_active AND customer_id = ANY($2::uuid[])",
        [scope.userId, ids]);
      if ((assigned.rows[0]?.n ?? 0) !== ids.length) {
        throw new AccountRuleError("HOLDER_NOT_FOUND", "Every holder must be an existing active customer.", 409);
      }
    }

    // Serialise concurrent requests that share a key; the UNIQUE constraint is only the backstop.
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${scope.userId}:${key.data}`]);
    const existing = await tx.query<{ request_hash: string; account_id: string; account_number: string; opening_balance: string }>(
      `SELECT r.request_hash, a.account_id, a.account_number,
              COALESCE((SELECT t.amount FROM transaction t WHERE t.reference_number = 'OPEN-' || a.account_number), 0::numeric(15,2))::text AS opening_balance
         FROM account_opening_request r JOIN account a ON a.account_id = r.account_id
        WHERE r.user_id = $1 AND r.idempotency_key = $2`, [scope.userId, key.data],
    );
    const previous = existing.rows[0];
    if (previous) {
      if (previous.request_hash !== hash) {
        throw new AccountRuleError("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different request.", 422);
      }
      return { data: { accountId: previous.account_id, accountNumber: previous.account_number, currentBalance: previous.opening_balance }, replayed: true };
    }

    // The deposit channel is a server decision (staff open accounts at the counter), never client input.
    let channelId: string | null = null;
    if (value.initialDeposit !== undefined && Number(value.initialDeposit) > 0) {
      const channel = await tx.query<{ channel_id: string }>(
        "SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER' AND status = 'ACTIVE'");
      channelId = channel.rows[0]?.channel_id ?? null;
      if (!channelId) throw new AccountRuleError("CHANNEL_UNAVAILABLE", "The deposit channel is not available.", 409);
    }

    const holders = value.holders.map(holder => ({ customer_id: holder.customerId, holder_type: holder.holderType }));
    const mandate = value.mandate
      ? { mandate_type: value.mandate.type, ...(value.mandate.requiredSignatories === undefined ? {} : { required_signatories: value.mandate.requiredSignatories }) }
      : null;
    let opened;
    try {
      opened = await tx.query<{ p_account_id: string; p_account_number: string; p_current_balance: string }>(
        `CALL sp_open_savings_account($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb, $6::numeric, $7::uuid, $8::uuid, NULL, NULL, NULL)`,
        [value.planId, value.branchId, scope.userId, JSON.stringify(holders), mandate ? JSON.stringify(mandate) : null,
          value.initialDeposit ?? null, channelId, scope.userId],
      );
    } catch (error) { throwAccountDatabaseError(error); }
    const row = opened.rows[0];
    if (!row) throw new DatabaseError();

    await tx.query(
      "INSERT INTO account_opening_request (user_id, idempotency_key, request_hash, account_id) VALUES ($1, $2, $3, $4)",
      [scope.userId, key.data, hash, row.p_account_id]);
    // M1's account/holder triggers audit the account and holders; the routine audits the mandate and deposit.
    return { data: { accountId: row.p_account_id, accountNumber: row.p_account_number, currentBalance: row.p_current_balance }, replayed: false };
  });
}

function likePattern(value: string | undefined): string | null {
  return value === undefined ? null : `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

const SUMMARY_COLUMNS = `a.account_id, a.account_number, a.status, a.current_balance::text, a.opened_date::text,
  a.branch_id, a.plan_id, sp.plan_name,
  (SELECT count(*)::int FROM account_holder h WHERE h.account_id = a.account_id) AS holder_count,
  (SELECT c.full_name FROM account_holder h JOIN customer c ON c.customer_id = h.customer_id
    WHERE h.account_id = a.account_id AND h.holder_type = 'PRIMARY') AS primary_holder_name`;

interface SummaryRow {
  account_id: string; account_number: string; status: string; current_balance: string; opened_date: string;
  branch_id: string; plan_id: string; plan_name: string; holder_count: number; primary_holder_name: string | null;
}
function mapSummary(row: SummaryRow): AccountSummary {
  return { accountId: row.account_id, accountNumber: row.account_number, status: row.status,
    currentBalance: row.current_balance, openedDate: row.opened_date, branchId: row.branch_id, planId: row.plan_id,
    planName: row.plan_name, holderCount: row.holder_count, primaryHolderName: row.primary_holder_name };
}

/** Lists accounts the caller may see (branch scope in the query, plus RLS) in one repeatable-read transaction. */
export async function listAccounts(input: unknown, actor: AccountActor): Promise<AccountSearchResult> {
  const authenticated = validateActor(actor, READ_ROLES);
  const parsed = accountSearchSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Account search contains invalid fields.");
  const value = parsed.data;
  return withTransaction(async tx => {
    const scope = await resolveScope(tx, authenticated, READ_ROLES);
    if (scope.branchId && value.branchId && value.branchId !== scope.branchId) throw new NotAuthorizedError();
    const filters = `($1::uuid IS NULL OR a.branch_id = $1)
      AND ($2::uuid IS NULL OR a.branch_id = $2)
      AND ($3::text IS NULL OR a.account_number ILIKE $3 OR EXISTS (
            SELECT 1 FROM account_holder h JOIN customer c ON c.customer_id = h.customer_id
             WHERE h.account_id = a.account_id AND (c.full_name ILIKE $3 OR c.customer_number ILIKE $3)))
      AND ($4::text IS NULL OR a.status = $4) AND ($5::uuid IS NULL OR a.plan_id = $5)
      AND ${assignedTo("$6", "$7")}`;
    const params = [scope.branchId, value.branchId ?? null, likePattern(value.q), value.status ?? null, value.planId ?? null,
      scope.roleName, scope.userId];
    const count = await tx.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM account a WHERE ${filters}`, params);
    // Identifiers come from a fixed allow-list, never from the request.
    const sortColumns = { accountNumber: "a.account_number", openedDate: "a.opened_date", currentBalance: "a.current_balance", status: "a.status" } as const;
    const directions = { asc: "ASC", desc: "DESC" } as const;
    const rows = await tx.query<SummaryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM account a JOIN savings_plan sp ON sp.plan_id = a.plan_id
        WHERE ${filters}
        ORDER BY ${sortColumns[value.sortBy]} ${directions[value.sortDirection]}, a.account_id
        LIMIT $8 OFFSET $9`, [...params, value.pageSize, (value.page - 1) * value.pageSize]);
    return { accounts: rows.rows.map(mapSummary), total: count.rows[0]?.total ?? 0, page: value.page, pageSize: value.pageSize };
  }, { isolationLevel: "REPEATABLE READ" });
}

/** Reads one authorised account with plan, holders, mandate and fixed deposits in one repeatable-read transaction. */
export async function getAccountDetail(accountId: string, actor: AccountActor): Promise<AccountDetail> {
  const authenticated = validateActor(actor, DETAIL_ROLES);
  if (!accountIdSchema.safeParse(accountId).success) throw new ValidationError("Account ID must be a UUID.");
  return withTransaction(async tx => {
    const scope = await resolveScope(tx, authenticated, DETAIL_ROLES);
    // A CUSTOMER sees only accounts they hold, an AGENT only accounts of assigned customers, staff only their branch.
    const result = await tx.query<SummaryRow & { min_balance: string; min_holders: number; max_holders: number; available_to_withdraw: string }>(
      `SELECT ${SUMMARY_COLUMNS}, sp.min_balance::text AS min_balance, sp.min_holders, sp.max_holders,
              GREATEST(a.current_balance - sp.min_balance, 0)::numeric(15,2)::text AS available_to_withdraw
         FROM account a JOIN savings_plan sp ON sp.plan_id = a.plan_id
        WHERE a.account_id = $1 AND ($2::uuid IS NULL OR a.branch_id = $2)
          AND ${assignedTo("$3", "$4")}
          AND ($3::text <> 'CUSTOMER' OR EXISTS (
                SELECT 1 FROM account_holder h JOIN customer c ON c.customer_id = h.customer_id
                 WHERE h.account_id = a.account_id AND c.app_user_id = $4))`,
      [accountId, scope.branchId, scope.roleName, scope.userId]);
    const account = result.rows[0];
    // Uniform 404 conceals accounts outside the caller's scope.
    if (!account) throw new NotFoundError("Account");
    const holders = await tx.query<{ account_holder_id: string; customer_id: string; customer_number: string; full_name: string; holder_type: string; joined_date: string }>(
      `SELECT h.account_holder_id, c.customer_id, c.customer_number, c.full_name, h.holder_type, h.joined_date::text
         FROM account_holder h JOIN customer c ON c.customer_id = h.customer_id
        WHERE h.account_id = $1 ORDER BY h.holder_type DESC, h.joined_date, c.customer_number`, [accountId]);
    // The state uses the bank's calendar date (Asia/Colombo), the same rule as fn_withdrawal_mandate_verdict.
    const mandate = await tx.query<{ mandate_type: string; required_signatories: number; effective_from: string; effective_to: string | null; state: "EFFECTIVE" | "NOT_YET_EFFECTIVE" | "EXPIRED" }>(
      `SELECT mandate_type, required_signatories, effective_from::text, effective_to::text,
              CASE WHEN effective_from > (now() AT TIME ZONE 'Asia/Colombo')::date THEN 'NOT_YET_EFFECTIVE'
                   WHEN effective_to < (now() AT TIME ZONE 'Asia/Colombo')::date THEN 'EXPIRED'
                   ELSE 'EFFECTIVE' END AS state
         FROM joint_mandate WHERE account_id = $1`, [accountId]);
    const row = mandate.rows[0];
    const last = await tx.query<{ transaction_type: string; amount: string; transaction_date: string; reference_number: string }>(
      `SELECT transaction_type, amount::text, to_char(transaction_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS transaction_date, reference_number
         FROM transaction WHERE account_id = $1 ORDER BY transaction_date DESC, transaction_id DESC LIMIT 1`, [accountId]);
    const latest = last.rows[0];
    // A side read: if it fails the account is still returned, with `null` instead of a false "no deposits".
    // The savepoint keeps the surrounding transaction usable; a retryable conflict is not swallowed.
    let fixedDeposits: AccountFixedDeposit[] | null = null;
    await tx.query("SAVEPOINT account_fixed_deposits");
    try {
      const deposits = await tx.query<{ fd_id: string; fd_plan_id: string; plan_name: string; principal_amount: string;
        interest_rate_at_opening: string; start_date: string; maturity_date: string; next_interest_date: string; status: AccountFixedDeposit["status"] }>(
        `SELECT fd.fd_id, fd.fd_plan_id, fp.plan_name, fd.principal_amount::text, fd.interest_rate_at_opening::text,
                fd.start_date::text, fd.maturity_date::text, fd.next_interest_date::text, fd.status
           FROM fixed_deposit fd JOIN fd_plan fp ON fp.fd_plan_id = fd.fd_plan_id
          WHERE fd.account_id = $1 ORDER BY fd.start_date DESC, fd.fd_id`, [accountId]);
      fixedDeposits = deposits.rows.map(fd => ({ fdId: fd.fd_id, fdPlanId: fd.fd_plan_id, planName: fd.plan_name,
        principalAmount: fd.principal_amount, interestRateAtOpening: fd.interest_rate_at_opening, startDate: fd.start_date,
        maturityDate: fd.maturity_date, nextInterestDate: fd.next_interest_date, status: fd.status }));
      await tx.query("RELEASE SAVEPOINT account_fixed_deposits");
    } catch (error) {
      if (isRetryable(error)) throw error;
      await tx.query("ROLLBACK TO SAVEPOINT account_fixed_deposits");
      logQueryError("account.fixedDeposits", 0, error);
    }
    return { ...mapSummary(account), minBalance: account.min_balance,
      minHolders: account.min_holders, maxHolders: account.max_holders,
      availableToWithdraw: account.available_to_withdraw,
      lastTransaction: latest ? { transactionType: latest.transaction_type, amount: latest.amount,
        transactionDate: latest.transaction_date, referenceNumber: latest.reference_number } : null,
      holders: holders.rows.map(holder => ({ accountHolderId: holder.account_holder_id, customerId: holder.customer_id,
        customerNumber: holder.customer_number, fullName: holder.full_name, holderType: holder.holder_type, joinedDate: holder.joined_date })),
      mandate: row ? { mandateType: row.mandate_type, requiredSignatories: row.required_signatories,
        effectiveFrom: row.effective_from, effectiveTo: row.effective_to, state: row.state } : null,
      fixedDeposits };
  }, { isolationLevel: "REPEATABLE READ" });
}

/** Adds one JOINT holder through sp_add_account_holder in one transaction (audited by the holder trigger). */
export async function addAccountHolder(
  accountId: string, input: unknown, actor: AccountActor,
): Promise<{ accountHolderId: string; holderCount: number; mandate: { mandateType: string; requiredSignatories: number } | null }> {
  const authenticated = validateActor(actor, HOLDER_ROLES);
  if (!accountIdSchema.safeParse(accountId).success) throw new ValidationError("Account ID must be a UUID.");
  const parsed = addHolderSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("The holder contains invalid or missing fields.");
  return withTransaction(async tx => {
    const scope = await resolveScope(tx, authenticated, HOLDER_ROLES);
    const visible = await tx.query("SELECT 1 FROM account WHERE account_id = $1 AND branch_id = $2", [accountId, scope.branchId]);
    if (!visible.rows[0]) throw new NotFoundError("Account");
    let added;
    try {
      added = await tx.query<{ p_account_holder_id: string; p_holder_count: number }>(
        "CALL sp_add_account_holder($1::uuid, $2::uuid, $3::uuid, NULL, NULL)", [accountId, parsed.data.customerId, scope.userId]);
    } catch (error) { throwAccountDatabaseError(error); }
    const row = added.rows[0];
    if (!row) throw new DatabaseError();
    const mandate = await tx.query<{ mandate_type: string; required_signatories: number }>(
      "SELECT mandate_type, required_signatories FROM joint_mandate WHERE account_id = $1", [accountId]);
    const current = mandate.rows[0];
    return { accountHolderId: row.p_account_holder_id, holderCount: row.p_holder_count,
      mandate: current ? { mandateType: current.mandate_type, requiredSignatories: current.required_signatories } : null };
  });
}

/** Closes an ACTIVE account with a zero balance and no ACTIVE FD through sp_close_account in one transaction (BR-18). */
export async function closeAccount(
  accountId: string, actor: AccountActor,
): Promise<{ accountId: string; status: "CLOSED"; closedAt: string }> {
  const authenticated = validateActor(actor, CLOSE_ROLES);
  if (!accountIdSchema.safeParse(accountId).success) throw new ValidationError("Account ID must be a UUID.");
  return withTransaction(async tx => {
    const scope = await resolveScope(tx, authenticated, CLOSE_ROLES);
    const visible = await tx.query("SELECT 1 FROM account WHERE account_id = $1 AND branch_id = $2", [accountId, scope.branchId]);
    if (!visible.rows[0]) throw new NotFoundError("Account");
    let closed;
    try {
      closed = await tx.query<{ p_closed_at: Date | string }>(
        "CALL sp_close_account($1::uuid, $2::uuid, NULL)", [accountId, scope.userId]);
    } catch (error) { throwAccountDatabaseError(error); }
    const row = closed.rows[0];
    if (!row) throw new DatabaseError();
    return { accountId, status: "CLOSED" as const, closedAt: new Date(row.p_closed_at).toISOString() };
  });
}
