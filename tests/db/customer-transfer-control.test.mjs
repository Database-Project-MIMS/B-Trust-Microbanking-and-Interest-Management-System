import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fdFixture,pool,requireDisposableDatabase,financialSnapshot} from '../helpers/customer-fixed-deposits.mjs';

describe('P06-M04-T03: direct runtime customer transfer capabilities',()=>{
  let client,fixture,hours,calendar,today;
  before(async()=>{
    client=await pool.connect();await requireDisposableDatabase(client);
    hours=(await client.query("SELECT param_key,param_value FROM system_parameter WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END')")).rows;
    today=(await client.query("SELECT (now() AT TIME ZONE 'Asia/Colombo')::date::text AS today")).rows[0].today;
    calendar=(await client.query('SELECT is_business_day,open_time::text,close_time::text FROM business_calendar WHERE calendar_date=$1',[today])).rows[0];
    await client.query("UPDATE system_parameter SET param_value=CASE param_key WHEN 'BUSINESS_HOUR_START' THEN '00:00' ELSE '23:59:59.999999' END WHERE param_key IN ('BUSINESS_HOUR_START','BUSINESS_HOUR_END')");
    await client.query('INSERT INTO business_calendar(calendar_date,is_business_day) VALUES($1,true) ON CONFLICT(calendar_date) DO UPDATE SET is_business_day=true,open_time=NULL,close_time=NULL',[today]);
  });
  beforeEach(async()=>{fixture=await fdFixture(client);});
  after(async()=>{
    if(client){
      for(const row of hours??[])await client.query('UPDATE system_parameter SET param_value=$1 WHERE param_key=$2',[row.param_value,row.param_key]);
      if(calendar)await client.query('UPDATE business_calendar SET is_business_day=$1,open_time=$2,close_time=$3 WHERE calendar_date=$4',[calendar.is_business_day,calendar.open_time,calendar.close_time,today]);
      else if(today)await client.query('DELETE FROM business_calendar WHERE calendar_date=$1',[today]);
      client.release();
    }
    await pool.end();
  });
  async function context(actor=fixture.customerLoginId,role='CUSTOMER',branch=''){
    await client.query('SET LOCAL ROLE mims_app');
    await client.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.current_user_role',$2,true),set_config('app.current_branch_id',$3,true)",[actor,role,branch]);
  }
  const args=()=>[fixture.ownAccount.account_id,fixture.otherAccount.account_number,'12.34',fixture.customerLoginId,randomUUID(),'Synthetic direct transfer'];
  const call=value=>client.query('SELECT transfer_group_id,debit_id,source_balance FROM fn_post_customer_transfer($1,$2,$3,$4,$5,$6)',value);
  test('runtime function grants are narrow and the legacy customer withdrawal capability is revoked',async()=>{
    const grants=(await client.query(`SELECT
      has_function_privilege('mims_app','fn_post_customer_transfer(uuid,varchar,numeric,uuid,varchar,varchar)','EXECUTE') AS transfer,
      has_function_privilege('mims_app','sp_try_customer_withdrawal(uuid,numeric,uuid,uuid,uuid[],varchar,varchar)','EXECUTE') AS withdrawal`)).rows[0];
    assert.deepEqual(grants,{transfer:true,withdrawal:false});
  });
  test('direct invocation commits a balanced pair under customer context without exposing recipient balance',async()=>{
    await client.query('BEGIN');await context();
    const result=(await call(args())).rows[0];await client.query('COMMIT');
    assert.deepEqual(Object.keys(result).sort(),['debit_id','source_balance','transfer_group_id']);assert.equal(result.source_balance,'123444.44');
    const pair=(await client.query("SELECT count(*)::int AS n,sum(CASE WHEN transaction_type='TRANSFER_OUT' THEN -amount ELSE amount END)::text AS net FROM transaction WHERE transfer_group_id=$1",[result.transfer_group_id])).rows[0];
    assert.deepEqual(pair,{n:2,net:'0.00'});
  });
  test('stored identity and source ownership cannot be forged by bypassing the service',async()=>{
    const snapshot=await financialSnapshot(client);
    for(const [actor,role,branch,value] of [
      [fixture.agentId,'CUSTOMER','',args()],
      [fixture.customerLoginId,'AGENT',fixture.branchId,args()],
      [fixture.customerLoginId,'CUSTOMER',fixture.branchId,args()],
      [fixture.customerLoginId,'CUSTOMER','',[fixture.otherAccount.account_id,...args().slice(1)]],
      [fixture.customerLoginId,'CUSTOMER','',[...args().slice(0,3),fixture.agentId,...args().slice(4)]],
    ]){
      await client.query('BEGIN');await context(actor,role,branch);
      try{await assert.rejects(call(value),error=>error.code==='42501');}finally{await client.query('ROLLBACK');}
      assert.deepEqual(await financialSnapshot(client),snapshot);
    }
  });
  test('exact amounts and transfer keys are validated in SQL; unset context fails closed',async()=>{
    const snapshot=await financialSnapshot(client);
    for(const amount of ['0','-1','0.001','NaN','Infinity','10000000000000']){
      await client.query('BEGIN');await context();const value=args();value[2]=amount;
      try{await assert.rejects(call(value),error=>error.code==='22023');}finally{await client.query('ROLLBACK');}
    }
    await client.query('BEGIN');await client.query('SET LOCAL ROLE mims_app');
    try{await assert.rejects(call(args()),error=>error.code==='42501');}finally{await client.query('ROLLBACK');}
    assert.deepEqual(await financialSnapshot(client),snapshot);
  });
  test('legacy and core withdrawal paths deny customer context even when called directly',async()=>{
    const channel=(await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name='CASH'")).rows[0].channel_id;
    const snapshot=await financialSnapshot(client);
    for(const name of ['sp_try_customer_withdrawal','sp_try_post_withdrawal']){
      await client.query('BEGIN');await context();
      try{await assert.rejects(client.query(`CALL ${name}($1,1,$2,$3,$4::uuid[],$5,NULL,NULL,NULL,NULL,NULL,NULL)`,
        [fixture.ownAccount.account_id,channel,fixture.customerLoginId,[fixture.customerId],randomUUID()]),error=>['42501','P0001'].includes(error.code));}
      finally{await client.query('ROLLBACK');}
    }
    assert.deepEqual(await financialSnapshot(client),snapshot);
  });
  test('SQL method resolver rejects old channels, missing values and inactive methods',async()=>{
    for(const method of [null,'ONLINE','BRANCH_COUNTER','CARD'])await assert.rejects(
      client.query('SELECT fn_transaction_method_channel($1)',[method]),error=>error.code==='P0001'&&error.message==='INVALID_METHOD');
    await client.query("UPDATE transaction_channel SET status='INACTIVE' WHERE channel_name='CHEQUE'");
    try{await assert.rejects(client.query("SELECT fn_transaction_method_channel('CHEQUE')"),error=>error.code==='P0001'&&error.message==='METHOD_UNAVAILABLE');}
    finally{await client.query("UPDATE transaction_channel SET status='ACTIVE' WHERE channel_name='CHEQUE'");}
  });
});
