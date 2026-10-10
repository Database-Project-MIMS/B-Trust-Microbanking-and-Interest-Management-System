import 'server-only';
import { createHash } from 'node:crypto';
import { withTransaction, NotAuthorizedError, NotFoundError, BusinessRuleError, ValidationError } from '@/lib/db';
import { setRlsContext } from '@/lib/db/rls-context';
import type { AuthenticatedUser } from '@/lib/auth/rbac';
import { fdOpeningSchema,fdKeySchema,fdListSchema } from '@/lib/validation/fixed-deposit';

export interface FixedDepositRow {
  fdId:string; accountId:string; accountNumber:string; fdPlanId:string; productName:string;
  principalAmount:string; rate:string; startDate:string; maturityDate:string; nextInterestDate:string; status:string;
}
const columns = `fd.fd_id AS "fdId",fd.account_id AS "accountId",a.account_number AS "accountNumber",
  fd.fd_plan_id AS "fdPlanId",p.plan_name AS "productName",fd.principal_amount AS "principalAmount",
  fd.interest_rate_at_opening AS rate,fd.start_date::text AS "startDate",fd.maturity_date::text AS "maturityDate",
  fd.next_interest_date::text AS "nextInterestDate",fd.status`;
const joins = 'FROM fixed_deposit fd JOIN account a ON a.account_id=fd.account_id JOIN fd_plan p ON p.fd_plan_id=fd.fd_plan_id';
function role(user:AuthenticatedUser,allowed:string[]) {
  if(!allowed.includes(user.roleName)) throw new NotAuthorizedError();
}
/** One read transaction previews exact SQL balance; opening rechecks under its lock. */
export async function quoteFixedDeposit(input:unknown,user:AuthenticatedUser){
  role(user,['AGENT','BRANCH_MANAGER','CENTRAL_OPS']);
  const value=fdOpeningSchema.parse(input);
  return withTransaction(async tx=>{
    await setRlsContext(tx,user);
    const account=(await tx.query(`SELECT account_number AS "accountNumber",current_balance AS "currentBalance",
      status,(current_balance-$2::numeric)::text AS "balanceAfter" FROM account WHERE account_id=$1`,[value.accountId,value.principalAmount])).rows[0];
    if(!account)throw new NotFoundError('Account');
    const eligible=(await tx.query(`SELECT $2::numeric>=sp.param_value::numeric AND $2::numeric<=a.current_balance
      AND a.status='ACTIVE' AND p.status='ACTIVE'
      AND (p.effective_from IS NULL OR p.effective_from<=(clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date)
      AND (p.effective_to IS NULL OR p.effective_to>(clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date)
      AND NOT EXISTS(SELECT 1 FROM fixed_deposit f WHERE f.account_id=a.account_id AND f.status='ACTIVE') AS valid
      FROM account a CROSS JOIN fd_plan p CROSS JOIN system_parameter sp
      WHERE a.account_id=$1 AND p.fd_plan_id=$3 AND sp.param_key='MIN_FD_PRINCIPAL'`,[value.accountId,value.principalAmount,value.fdPlanId])).rows[0];
    if(!eligible?.valid)throw new BusinessRuleError('FD_OPENING_REJECTED','Choose an active product and eligible account with sufficient funds and no active fixed deposit.');
    return {accountNumber:account.accountNumber,currentBalance:account.currentBalance,balanceAfter:account.balanceAfter,principalAmount:value.principalAmount};
  });
}
/** One scoped read transaction supplies paginated FD rows and count. */
export async function listFixedDeposits(input:unknown,user:AuthenticatedUser) {
  role(user,['AGENT','BRANCH_MANAGER','CENTRAL_OPS','AUDITOR','CUSTOMER']);
  const filters=fdListSchema.parse(input);
  return withTransaction(async tx=>{
    await setRlsContext(tx,user);
    const values=[filters.accountId ?? null,filters.status ?? null];
    const where='WHERE ($1::uuid IS NULL OR fd.account_id=$1) AND ($2::text IS NULL OR fd.status=$2)';
    const total=(await tx.query(`SELECT count(*)::int AS n ${joins} ${where}`,values)).rows[0].n;
    const rows=(await tx.query<FixedDepositRow>(`SELECT ${columns} ${joins} ${where}
      ORDER BY fd.start_date DESC,fd.fd_id LIMIT $3 OFFSET $4`,[...values,filters.pageSize,(filters.page-1)*filters.pageSize])).rows;
    return {rows,totalRows:total,page:filters.page,pageSize:filters.pageSize};
  },{isolationLevel:'REPEATABLE READ'});
}
/** One transaction owns key replay, locked principal debit, FD creation and audit. */
export async function openFixedDeposit(input:unknown,user:AuthenticatedUser,key:unknown) {
  role(user,['AGENT','BRANCH_MANAGER','CENTRAL_OPS']);
  const value=fdOpeningSchema.parse(input),idempotencyKey=fdKeySchema.parse(key);
  const hash=createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return withTransaction(async tx=>{
    await setRlsContext(tx,user);
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${user.userId}:${idempotencyKey}`]);
    const existing=(await tx.query('SELECT fd_id,payload_hash FROM fd_opening_request WHERE actor_user_id=$1 AND idempotency_key=$2',
      [user.userId,idempotencyKey])).rows[0];
    if(existing && existing.payload_hash!==hash) throw new BusinessRuleError('IDEMPOTENCY_CONFLICT','This key was used for a different FD request.');
    let fdId=existing?.fd_id;
    if(!fdId){
      const account=(await tx.query('SELECT account_id FROM account WHERE account_id=$1 FOR UPDATE',[value.accountId])).rows[0];
      if(!account) throw new NotFoundError('Account');
      const minimum=(await tx.query(`SELECT param_value FROM system_parameter WHERE param_key='MIN_FD_PRINCIPAL'`)).rows[0];
      if(!minimum || !/^\d+(\.\d{1,2})?$/.test(minimum.param_value)) throw new Error('Invalid FD minimum configuration.');
      const verdict=(await tx.query(`SELECT $1::numeric >= $2::numeric AND $1::numeric > 0 AS valid`,[value.principalAmount,minimum.param_value])).rows[0];
      if(!verdict.valid) throw new ValidationError('Principal is below the configured FD minimum.');
      const plan=(await tx.query(`SELECT fd_plan_id FROM fd_plan WHERE fd_plan_id=$1 AND status='ACTIVE'
        AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
        AND (effective_to IS NULL OR effective_to > CURRENT_DATE) FOR SHARE`,[value.fdPlanId])).rows[0];
      if(!plan) throw new BusinessRuleError('FD_PRODUCT_INACTIVE','Select a currently active FD product.');
      const channel=(await tx.query(`SELECT channel_id FROM transaction_channel WHERE channel_name='BRANCH_COUNTER' AND status='ACTIVE'`)).rows[0];
      if(!channel) throw new Error('Posting channel unavailable.');
      try{
        fdId=(await tx.query('SELECT sp_open_fd_controlled($1,$2,$3,$4,$5) AS id',
          [value.accountId,value.fdPlanId,value.principalAmount,user.userId,channel.channel_id])).rows[0].id;
      }catch(error){
        const code=typeof error==='object'&&error!==null&&'code' in error?error.code:null;
        if(code==='23505') throw new BusinessRuleError('ACTIVE_FD_EXISTS','This account already has an active fixed deposit.');
        if(code==='P0001') throw new BusinessRuleError('FD_OPENING_REJECTED','Account status or balance does not permit this fixed deposit.');
        throw error;
      }
      await tx.query('INSERT INTO fd_opening_request(actor_user_id,idempotency_key,payload_hash,fd_id) VALUES ($1,$2,$3,$4)',
        [user.userId,idempotencyKey,hash,fdId]);
    }
    const row=(await tx.query<FixedDepositRow>(`SELECT ${columns} ${joins} WHERE fd.fd_id=$1`,[fdId])).rows[0];
    if(!row) throw new NotFoundError('Fixed deposit');
    return {data:row,replayed:Boolean(existing)};
  });
}
