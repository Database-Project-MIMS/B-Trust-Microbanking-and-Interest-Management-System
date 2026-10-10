import {after,before,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fdFixture,pool,requireDisposableDatabase} from '../helpers/customer-fixed-deposits.mjs';
import {useCustomerRuntime} from '../helpers/customer-runtime.mjs';
import {withTransaction} from '../../lib/db/index.ts';
import {setRlsContext} from '../../lib/db/rls-context.ts';
import {recordInterestRunRequest} from '../../services/interest-request-service.ts';
import {closeAccount} from '../../services/account-service.ts';
describe('Savings daily balances, FD catch-up and principal maturity under runtime role',()=>{
 let owner,f,restore,channel;
 before(async()=>{owner=await pool.connect();await requireDisposableDatabase(owner);f=await fdFixture(owner);channel=(await owner.query("SELECT channel_id FROM transaction_channel WHERE channel_name='SYSTEM'")).rows[0].channel_id;restore=useCustomerRuntime(pool);});
 after(async()=>{await restore?.();owner?.release();await pool.end();});
 const ctx=()=>({userId:f.centralId,roleName:'CENTRAL_OPS',branchId:null});
 const tx=callback=>withTransaction(async client=>{await setRlsContext(client,ctx());return callback(client);});
 async function history(accountId,date,balance,amount=balance){await owner.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,balance_after,branch_id)
 VALUES($1,$2,$3,$4,'DEPOSIT',$5,$6::timestamptz,$7,$8)`,[accountId,f.centralId,channel,randomUUID(),amount,date,balance,f.branchId]);}
 test('daily closing balance honors opening date, changing balances and Colombo midnight',async()=>{
 const a=await f.account([f.customerId]);await owner.query("UPDATE account SET opened_date='2001-01-10',current_balance=73000 WHERE account_id=$1",[a.account_id]);
 await history(a.account_id,'2001-01-10T00:00:00+05:30','36500');await history(a.account_id,'2001-01-15T00:00:00+05:30','73000','36500');
 const run=(await owner.query("INSERT INTO interest_run(cycle_date,status,initiated_by) VALUES('2001-01-20','RUNNING',$1) RETURNING run_id",[f.centralId])).rows[0].run_id;
 const rate=(await owner.query('SELECT p.interest_rate::text AS rate FROM account a JOIN savings_plan p USING(plan_id) WHERE a.account_id=$1',[a.account_id])).rows[0].rate;
 const expected=(await owner.query('SELECT round((36500*5+73000*5)*$1::numeric/365,2)::text AS amount',[rate])).rows[0].amount;
 const result=await tx(c=>c.query("SELECT fn_post_savings_interest($1,$2,'2001-01-20')::text AS amount",[a.account_id,run]));assert.equal(result.rows[0].amount,expected);
 assert.equal((await tx(c=>c.query("SELECT fn_post_savings_interest($1,$2,'2001-01-20')::text AS amount",[a.account_id,run]))).rows[0].amount,'0');
 const payout=(await owner.query('SELECT source_type,fd_id,period_start::text,period_end::text FROM interest_payout WHERE account_id=$1',[a.account_id])).rows[0];
 assert.deepEqual(payout,{source_type:'SAVINGS',fd_id:null,period_start:'2001-01-10',period_end:'2001-01-20'});
 const run2=(await owner.query("INSERT INTO interest_run(cycle_date,status,initiated_by) VALUES('2001-01-25','RUNNING',$1) RETURNING run_id",[f.centralId])).rows[0].run_id;
 await tx(c=>c.query("SELECT fn_post_savings_interest($1,$2,'2001-01-25')",[a.account_id,run2]));
 assert.equal((await owner.query('SELECT period_start::text FROM interest_payout WHERE account_id=$1 AND interest_run_id=$2',[a.account_id,run2])).rows[0].period_start,'2001-01-20');
 });
 test('no funded days produces no phantom ledger or payout',async()=>{
 const a=await f.account([f.customerId]);await owner.query("UPDATE account SET opened_date='2001-01-01',current_balance=0 WHERE account_id=$1",[a.account_id]);
 const run=(await owner.query("INSERT INTO interest_run(cycle_date,status,initiated_by) VALUES('2001-02-01','RUNNING',$1) RETURNING run_id",[f.centralId])).rows[0].run_id;
 assert.equal((await tx(c=>c.query("SELECT fn_post_savings_interest($1,$2,'2001-02-01')::text AS amount",[a.account_id,run]))).rows[0].amount,'0.00');
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM transaction WHERE account_id=$1',[a.account_id])).rows[0].n,0);
 });
 test('overdue FD pays every eligible 30-day period and returns principal exactly once',async()=>{
 const a=await f.account([f.customerId]);await owner.query("UPDATE account SET opened_date='2002-07-02',current_balance=0 WHERE account_id=$1",[a.account_id]);
 const fd=await f.deposit(a.account_id,'ACTIVE','100000.00','2002-01-01');
 const result=await recordInterestRunRequest({cycleDate:'2002-07-03',dryRun:false},{userId:f.centralId,actorType:'USER'});
 const stored=(await owner.query('SELECT status,next_interest_date::text FROM fixed_deposit WHERE fd_id=$1',[fd])).rows[0];assert.equal(stored.status,'MATURED');
 const receipts=(await owner.query('SELECT count(*)::int AS n FROM fd_maturity_receipt WHERE fd_id=$1',[fd])).rows[0];assert.equal(receipts.n,1);
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM interest_payout WHERE fd_id=$1',[fd])).rows[0].n,6);
 assert.equal((await owner.query('SELECT a.current_balance=100000+(SELECT sum(interest_amount) FROM interest_payout WHERE fd_id=$2) AS valid FROM account a WHERE account_id=$1',[a.account_id,fd])).rows[0].valid,true);
 const id=(await tx(c=>c.query("SELECT fn_return_fd_principal($1,'2002-07-03') AS id",[fd]))).rows[0].id;
 assert.equal(id,(await owner.query('SELECT transaction_id FROM fd_maturity_receipt WHERE fd_id=$1',[fd])).rows[0].transaction_id);
 const replay=await recordInterestRunRequest({cycleDate:'2002-07-03'},{userId:f.centralId,actorType:'USER'});assert.equal(replay.replayed,true);assert.equal(replay.totalInterest,result.totalInterest);
 });
 test('future cycle is rejected before audit or control and staff cannot invoke maturity capability',async()=>{
 const before=(await owner.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n;
 await assert.rejects(()=>recordInterestRunRequest({cycleDate:'2999-01-01'},{userId:f.centralId,actorType:'USER'}),{code:'VALIDATION_FAILED'});
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n,before);
 await assert.rejects(()=>withTransaction(async c=>{await setRlsContext(c,{userId:f.agentId,roleName:'AGENT',branchId:f.branchId});await c.query("SELECT fn_return_fd_principal($1,'2002-07-03')",[f.activeId]);}));
 });
 test('a delayed savings run pays every unpaid funded day beyond thirty days',async()=>{
 const a=await f.account([f.customerId]);await owner.query("UPDATE account SET opened_date='2003-01-01',current_balance=36500 WHERE account_id=$1",[a.account_id]);
 await history(a.account_id,'2003-01-01T00:00:00+05:30','36500');
 const run=(await owner.query("INSERT INTO interest_run(cycle_date,status,initiated_by) VALUES('2003-03-02','RUNNING',$1) RETURNING run_id",[f.centralId])).rows[0].run_id;
 const expected=(await owner.query('SELECT round(36500*60*p.interest_rate/365,2)::text AS amount FROM account a JOIN savings_plan p USING(plan_id) WHERE a.account_id=$1',[a.account_id])).rows[0].amount;
 assert.equal((await tx(c=>c.query("SELECT fn_post_savings_interest($1,$2,'2003-03-02')::text AS amount",[a.account_id,run]))).rows[0].amount,expected);
 });
 test('a partial transfer pair is rejected at commit and leaves no ledger row',async()=>{
 const a=await f.account([f.customerId]),group=randomUUID();
 await owner.query('BEGIN');try{
 await owner.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,balance_after,branch_id,transfer_group_id)
 VALUES($1,$2,$3,$4,'TRANSFER_OUT',1,0,$5,$6)`,[a.account_id,f.managerId,channel,randomUUID(),f.branchId,group]);
 await assert.rejects(()=>owner.query('COMMIT'),e=>e.code==='23514'&&e.constraint==='ck_transfer_pair');
 }finally{await owner.query('ROLLBACK');}
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM transaction WHERE transfer_group_id=$1',[group])).rows[0].n,0);
 });
 test('maturity audit failure rolls back principal, receipt and FD state together',async()=>{
 const a=await f.account([f.customerId]);await owner.query('UPDATE account SET current_balance=0 WHERE account_id=$1',[a.account_id]);
 const fd=await f.deposit(a.account_id,'ACTIVE','100000','2004-01-01');await owner.query("UPDATE fixed_deposit SET next_interest_date='2004-08-01' WHERE fd_id=$1",[fd]);
 await owner.query(`CREATE FUNCTION qa_maturity_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.entity_id='${fd}'::uuid AND NEW.action='FD_MATURED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END$$`);
 await owner.query('CREATE TRIGGER qa_maturity_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION qa_maturity_failure()');
 try{await assert.rejects(()=>tx(c=>c.query("SELECT fn_return_fd_principal($1,'2004-07-02')",[fd])));
 assert.equal((await owner.query('SELECT current_balance::text AS b FROM account WHERE account_id=$1',[a.account_id])).rows[0].b,'0.00');
 assert.equal((await owner.query('SELECT status FROM fixed_deposit WHERE fd_id=$1',[fd])).rows[0].status,'ACTIVE');
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM fd_maturity_receipt WHERE fd_id=$1',[fd])).rows[0].n,0);
 }finally{await owner.query('DROP TRIGGER qa_maturity_failure ON audit_log');await owner.query('DROP FUNCTION qa_maturity_failure()');}
 });
 test('zero-balance closure cannot discard accrued interest and succeeds after settlement',async()=>{
 const a=await f.account([f.customerId]);await owner.query("UPDATE account SET opened_date='2005-01-01',current_balance=0 WHERE account_id=$1",[a.account_id]);
 await history(a.account_id,'2005-01-01T00:00:00+05:30','36500');
 await owner.query(`INSERT INTO transaction(account_id,initiated_by_user_id,channel_id,reference_number,transaction_type,amount,transaction_date,balance_after,branch_id)
 VALUES($1,$2,$3,$4,'WITHDRAWAL',36500,'2005-01-02T00:00:00+05:30',0,$5)`,[a.account_id,f.managerId,channel,randomUUID(),f.branchId]);
 const actor={userId:f.managerId,roleName:'BRANCH_MANAGER',branchId:f.branchId};
 await assert.rejects(()=>closeAccount(a.account_id,actor),{code:'UNSETTLED_SAVINGS_INTEREST'});
 await owner.query("UPDATE account SET savings_interest_through=(clock_timestamp() AT TIME ZONE 'Asia/Colombo')::date WHERE account_id=$1",[a.account_id]);
 assert.equal((await closeAccount(a.account_id,actor)).status,'CLOSED');
 });
});
