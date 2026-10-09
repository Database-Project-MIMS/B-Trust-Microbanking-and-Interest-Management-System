import 'server-only';
import { z } from 'zod';
import { withTransaction, NotAuthorizedError, BusinessRuleError } from '@/lib/db';
import { setRlsContext } from '@/lib/db/rls-context';
import { writeAuditEvent } from '@/services/audit-service';

const requestSchema = z.object({cycleDate:z.string().date(),dryRun:z.boolean().default(false)}).strict();
type RunActor = {userId:string|null;actorType:'USER'|'SYSTEM'};
export interface InterestRunResult {
  runId:string|null;cycleDate:string;status:string;fdCount:number;totalInterest:string;exceptionCount:number;replayed?:boolean;
}
type Context = {userId:string;branchId:null;roleName:string};
async function context(actor:RunActor):Promise<Context>{
  return withTransaction(async tx=>{
    const row=(await tx.query(`SELECT u.user_id,r.role_name FROM app_user u JOIN role r ON r.role_id=u.role_id
      WHERE u.status='ACTIVE' AND r.status='ACTIVE' AND
        (($1::uuid IS NOT NULL AND u.user_id=$1 AND r.role_name IN ('ADMIN','CENTRAL_OPS'))
         OR ($1::uuid IS NULL AND u.username='system' AND r.role_name='SYSTEM'))`,[actor.userId])).rows[0];
    if(!row)throw new NotAuthorizedError();
    return {userId:row.user_id,branchId:null,roleName:row.role_name};
  });
}
const runColumns = `run_id AS "runId",cycle_date::text AS "cycleDate",status,fd_count AS "fdCount",
  total_interest AS "totalInterest",exception_count AS "exceptionCount"`;
async function readRun(id:string,ctx:Context){
  return withTransaction(async tx=>{
    await setRlsContext(tx,ctx);
    const row=(await tx.query<InterestRunResult>(`SELECT ${runColumns} FROM interest_run WHERE run_id=$1`,[id])).rows[0];
    if(!row)throw new Error('Interest run unavailable.');
    return row;
  });
}

/** Commits the run control separately, then ledger/payout/date/audit in one transaction per FD. */
export async function recordInterestRunRequest(input:unknown,actor:RunActor):Promise<InterestRunResult>{
  const body=requestSchema.parse(input),ctx=await context(actor);
  const start=await withTransaction(async tx=>{
    await setRlsContext(tx,ctx);
    await writeAuditEvent({...actor,entityType:'interest_run',entityId:null,action:'INTEREST_RUN_INITIATED',
      newValues:{cycle_date:body.cycleDate,dry_run:body.dryRun}},tx);
    if(body.dryRun){
      const totals=(await tx.query(`SELECT count(*)::int AS count,
        COALESCE(sum(fn_calculate_fd_interest(principal_amount,interest_rate_at_opening)),0)::text AS amount
        FROM fixed_deposit WHERE status='ACTIVE' AND next_interest_date <= $1::date
        AND next_interest_date <= maturity_date`,[body.cycleDate])).rows[0];
      return {preview:{runId:null,cycleDate:body.cycleDate,status:'DRY_RUN',fdCount:totals.count,totalInterest:totals.amount,exceptionCount:0}};
    }
    const created=(await tx.query(`INSERT INTO interest_run(cycle_date,status,initiated_by)
      VALUES($1,'RUNNING',$2) ON CONFLICT(cycle_date) DO NOTHING RETURNING run_id`,[body.cycleDate,actor.userId])).rows[0];
    if(!created){
      const existing=(await tx.query<InterestRunResult>(`SELECT ${runColumns} FROM interest_run WHERE cycle_date=$1`,[body.cycleDate])).rows[0];
      if(!existing || existing.status!=='COMPLETED')throw new BusinessRuleError('RUN_IN_PROGRESS','This cycle requires operator review before another attempt.');
      return {preview:{...existing,replayed:true}};
    }
    const due=(await tx.query<{fd_id:string}>(`SELECT fd_id FROM fixed_deposit
      WHERE status='ACTIVE' AND next_interest_date <= $1::date AND next_interest_date <= maturity_date ORDER BY fd_id`,[body.cycleDate])).rows;
    return {runId:created.run_id as string,due};
  });
  if(start.preview)return start.preview;
  const runId=start.runId;
  if(!runId || !start.due)throw new Error('Interest control unavailable.');
  for(const {fd_id:fdId} of start.due){
    try{
      await withTransaction(async tx=>{
        await setRlsContext(tx,ctx);
        const fd=(await tx.query(`SELECT fd_id,account_id,principal_amount,interest_rate_at_opening
          FROM fixed_deposit WHERE fd_id=$1 AND status='ACTIVE' AND next_interest_date <= $2::date
          AND next_interest_date <= maturity_date FOR UPDATE`,[fdId,body.cycleDate])).rows[0];
        if(!fd)return;
        const paid=(await tx.query('SELECT 1 FROM interest_payout WHERE fd_id=$1 AND cycle_date=$2',[fdId,body.cycleDate])).rows[0];
        if(paid)return;
        const amount=(await tx.query('SELECT fn_calculate_fd_interest($1,$2) AS amount',[fd.principal_amount,fd.interest_rate_at_opening])).rows[0].amount;
        const posted=(await tx.query('CALL sp_post_interest_credit($1,$2,$3,$4,NULL,NULL,NULL)',
          [fd.account_id,amount,fdId,body.cycleDate])).rows[0];
        await tx.query(`INSERT INTO interest_payout(fd_id,interest_run_id,transaction_id,cycle_date,payout_date,interest_amount)
          VALUES($1,$2,$3,$4,CURRENT_DATE,$5)`,[fdId,runId,posted.p_transaction_id,body.cycleDate,amount]);
        await tx.query(`UPDATE fixed_deposit SET next_interest_date=next_interest_date+30,updated_at=now() WHERE fd_id=$1`,[fdId]);
        await tx.query('UPDATE interest_run SET fd_count=fd_count+1,total_interest=total_interest+$2::numeric WHERE run_id=$1',[runId,amount]);
      });
    }catch{
      // Earlier distributions are already committed. Store counts, never raw SQL errors.
      await withTransaction(async tx=>{
        await setRlsContext(tx,ctx);
        await tx.query('UPDATE interest_run SET exception_count=exception_count+1 WHERE run_id=$1',[runId]);
        await writeAuditEvent({...actor,entityType:'fixed_deposit',entityId:fdId,action:'INTEREST_PAYOUT_EXCEPTION',
          newValues:{run_id:runId,cycle_date:body.cycleDate}},tx);
      });
    }
  }
  await withTransaction(async tx=>{
    await setRlsContext(tx,ctx);
    await tx.query("UPDATE interest_run SET status='COMPLETED',completed_at=now() WHERE run_id=$1",[runId]);
  });
  return readRun(runId,ctx);
}

/** One bank-wide read transaction retrieves bounded interest run history. */
export async function listInterestRuns(user:{userId:string;roleName:string;branchId:string|null}){
  if(!['ADMIN','CENTRAL_OPS','AUDITOR'].includes(user.roleName))throw new NotAuthorizedError();
  return withTransaction(async tx=>{
    await setRlsContext(tx,user);
    return (await tx.query<InterestRunResult>(`SELECT ${runColumns} FROM interest_run ORDER BY cycle_date DESC LIMIT 100`)).rows;
  });
}
