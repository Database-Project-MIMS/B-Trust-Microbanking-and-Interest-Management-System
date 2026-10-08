import { type Executor } from '@/lib/db';

const SENSITIVE_KEYS = new Set(['password_hash', 'nic_passport_no', 'token_hash']);

function maskSensitive(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      SENSITIVE_KEYS.has(k) ? [k, '***MASKED***'] : [k, v]
    )
  );
}

export interface AuditEventParams {
  userId: string | null;
  actorType: 'USER' | 'SYSTEM';
  entityType: string;
  entityId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'DEPOSIT' | 'WITHDRAWAL' | 'REJECTED_WITHDRAWAL' | 'REVERSAL' | 'INTEREST_CREDIT';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

/** Writes an audit event using the caller's required transaction executor. */
export async function writeAuditEvent(params: AuditEventParams, executor: Executor): Promise<void> {
  const { userId, actorType, entityType, entityId, action, oldValues, newValues, ipAddress } = params;
  await executor.query(
    `INSERT INTO audit_log
       (user_id, actor_type, entity_type, entity_id, action, old_values, new_values, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      userId,
      actorType,
      entityType,
      entityId,
      action,
      maskSensitive(oldValues) ? JSON.stringify(maskSensitive(oldValues)) : null,
      maskSensitive(newValues) ? JSON.stringify(maskSensitive(newValues)) : null,
      ipAddress ?? null,
    ]
  );
}

export async function auditDeposit(params: {
  userId: string;
  accountId: string;
  transactionId: string;
  amount: string;
  balanceAfter: string;
  ipAddress?: string;
}, executor: Executor): Promise<void> {
  await writeAuditEvent({
    userId: params.userId,
    actorType: 'USER',
    entityType: 'transaction',
    entityId: params.transactionId,
    action: 'DEPOSIT',
    newValues: {
      account_id: params.accountId,
      amount: params.amount,
      balance_after: params.balanceAfter,
    },
    ipAddress: params.ipAddress,
  }, executor);
}

export async function auditWithdrawal(params: {
  userId: string;
  accountId: string;
  transactionId: string;
  amount: string;
  balanceAfter: string;
  ipAddress?: string;
}, executor: Executor): Promise<void> {
  await writeAuditEvent({
    userId: params.userId,
    actorType: 'USER',
    entityType: 'transaction',
    entityId: params.transactionId,
    action: 'WITHDRAWAL',
    newValues: {
      account_id: params.accountId,
      amount: params.amount,
      balance_after: params.balanceAfter,
    },
    ipAddress: params.ipAddress,
  }, executor);
}

export async function auditRejectedWithdrawal(params: {
  userId: string;
  accountId: string;
  amount: string;
  reason: string;
  ipAddress?: string;
}, executor: Executor): Promise<void> {
  await writeAuditEvent({
    userId: params.userId,
    actorType: 'USER',
    entityType: 'account',
    entityId: params.accountId,
    action: 'REJECTED_WITHDRAWAL',
    newValues: {
      account_id: params.accountId,
      amount: params.amount,
      reason: params.reason,
    },
    ipAddress: params.ipAddress,
  }, executor);
}

export async function auditReversal(params: {
  userId: string;
  transactionId: string;
  originalTransactionId: string;
  reason: string;
  ipAddress?: string;
}, executor: Executor): Promise<void> {
  await writeAuditEvent({
    userId: params.userId,
    actorType: 'USER',
    entityType: 'transaction_reversal',
    entityId: params.transactionId,
    action: 'REVERSAL',
    newValues: {
      original_transaction_id: params.originalTransactionId,
      reason: params.reason,
    },
    ipAddress: params.ipAddress,
  }, executor);
}

export async function auditInterestCredit(params: {
  accountId: string;
  transactionId: string;
  amount: string;
  balanceAfter: string;
  ipAddress?: string;
}, executor: Executor): Promise<void> {
  await writeAuditEvent({
    userId: null,
    actorType: 'SYSTEM',
    entityType: 'transaction',
    entityId: params.transactionId,
    action: 'INTEREST_CREDIT',
    newValues: {
      account_id: params.accountId,
      amount: params.amount,
      balance_after: params.balanceAfter,
    },
    ipAddress: params.ipAddress,
  }, executor);
}
