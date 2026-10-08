import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { NextRequest } from 'next/server';
import { createActivityFixture,pool,requireDisposableDatabase } from '../helpers/agent-activity.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
import { prepareRpt01 } from '../../services/rpt01-report-service.ts';
import { GET } from '../../app/api/reports/agent-transactions/route.ts';
import { streamCsv } from '../../lib/report/csv-export.ts';

function parseCsv(text) {
  const records=[]; let row=[],cell='',quoted=false;
  for(let index=0;index<text.length;index++) {
    const char=text[index];
    if(char==='"') { if(quoted && text[index+1]==='"'){cell+='"';index++;}else quoted=!quoted; }
    else if(char===','&&!quoted){row.push(cell);cell='';}
    else if(char==='\r'&&!quoted&&text[index+1]==='\n'){row.push(cell);records.push(row);row=[];cell='';index++;}
    else cell+=char;
  }
  return records;
}
describe('P05-M02-T02 live session API, exact parity and audited report preparation',()=>{
  let client,fixture,restore;
  before(async()=>{client=await pool.connect();await requireDisposableDatabase(client);restore=useCustomerRuntime(pool);});
  beforeEach(async()=>{fixture=await createActivityFixture(client);});
  after(async()=>{await restore?.();client?.release();await pool.end();});
  async function request(role='manager',query='',agent=fixture.agentId) {
    const params=new URLSearchParams('from=2026-09-01&to=2026-09-01'+query);
    if(agent)params.set('agentId',agent);
    return GET(new NextRequest('http://localhost/api/reports/agent-transactions?'+params.toString(),{
      headers:fixture.tokens[role]?{cookie:'mims_session='+fixture.tokens[role]}:{},
    }));
  }
  async function json(role='manager',query='',agent) {
    const response=await request(role,query,agent);return {status:response.status,body:await response.json(),headers:response.headers};
  }
  async function auditCount(){return (await client.query("SELECT COUNT(*)::int AS count FROM audit_log WHERE action='REPORT_ACCESSED' AND user_id=$1",[fixture.managerId])).rows[0].count;}
  test('manager receives minimal scoped rows and separate exact page/grand totals',async()=>{
    const {status,body,headers}=await json();assert.equal(status,200);
    const row=body.data.rows[0];assert.equal(row.depositTotal,'0.30');assert.equal(row.netTotal,null);
    assert.equal(body.data.grandTotal.depositTotal,'0.30');assert.equal(body.data.grandTotal.netTotal,'UNRESOLVED');
    assert.equal(body.data.filters.branchId,fixture.branchId);assert.equal(body.data.timeZone,'Asia/Colombo');
    assert.equal(headers.get('cache-control'),'private, no-store');
    assert.ok(!JSON.stringify(body).includes('nic_passport'));assert.equal(await auditCount(),1);
  });
  test('CSV exports all filtered rows, matching JSON values and keyed totals',async()=>{
    const expected=(await json()).body.data;
    const response=await request('manager','&format=csv');
    assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/csv/);
    const csv=parseCsv(await response.text()),header=csv[0],detail=csv.find(row=>row[0]==='DETAIL'),grand=csv.find(row=>row[0]==='GRAND_TOTAL');
    assert.equal(detail[header.indexOf('Deposits LKR')],expected.rows[0].depositTotal);
    assert.equal(grand[header.indexOf('Net LKR')],expected.grandTotal.netTotal);
    assert.ok(csv.every(row=>row.length===header.length));assert.equal(await auditCount(),2);
    assert.ok(csv.some(row=>row.includes('Excluded unattributed transactions: 1; unsigned LKR 200.00')));
  });
  test('CSV uses complete filters while page subtotal matches the selected JSON page',async()=>{
    const expected=(await json('manager','&pageSize=1',null)).body.data;
    const response=await request('manager','&format=csv&pageSize=1',null);
    const csv=parseCsv(await response.text()),header=csv[0];
    assert.equal(csv.filter(row=>row[0]==='DETAIL').length,expected.totalRows);
    assert.equal(csv.find(row=>row[0]==='PAGE_SUBTOTAL')[header.indexOf('Deposits LKR')],expected.subtotals.depositTotal);
    assert.equal(csv.find(row=>row[0]==='GRAND_TOTAL')[header.indexOf('Deposits LKR')],expected.grandTotal.depositTotal);
  });
  test('all report bankwide roles are supported',async()=>{
    for(const role of ['admin','central','auditor'])assert.equal((await json(role)).status,200);
  });
  test('missing/forged sessions and unsupported AGENT/CUSTOMER roles are denied',async()=>{
    assert.equal((await json('missing')).status,401);
    assert.equal((await json('agent')).status,403);assert.equal((await json('customer')).status,403);
    await client.query('DELETE FROM user_session WHERE user_id=$1',[fixture.managerId]);assert.equal((await json()).status,401);
  });
  test('cross-branch parameters cannot broaden manager data or create access audits',async()=>{
    assert.equal((await json('manager','&branchId='+fixture.otherBranchId)).status,403);assert.equal(await auditCount(),0);
    const response=await request('manager','&format=csv&branchId='+fixture.otherBranchId);
    assert.equal(response.status,403);assert.equal(await auditCount(),0);
  });
  test('invalid, repeated, unknown and injected fields return safe 400 errors',async()=>{
    for(const query of ['&from=2026-02-29','&branchId=no','&page=0','&pageSize=101','&format=pdf',
      '&sort=employeeNo%3BDROP%20TABLE%20agent','&direction=sideways','&unexpected=1','&page=1&page=2','&to=2026-08-01']){
      const result=await json('manager',query);assert.equal(result.status,400,query);
      assert.deepEqual(result.body.error,{code:'VALIDATION_FAILED',message:'The request contains invalid or missing fields.'});
    }
    assert.equal(await auditCount(),0);
  });
  test('empty and beyond-last pages preserve full-filter totals',async()=>{
    const result=(await json('manager','&page=100')).body.data;
    assert.deepEqual(result.rows,[]);assert.equal(result.grandTotal.depositTotal,'0.30');assert.equal(result.subtotals.depositTotal,'0');
    const empty=await json('manager','',randomUUID());assert.equal(empty.status,200);assert.deepEqual(empty.body.data.rows,[]);
  });
  test('stale direct service actors fail even when caller supplies an allowed role',async()=>{
    await assert.rejects(prepareRpt01({from:'2026-09-01',to:'2026-09-01',format:'json',page:1,pageSize:25,sort:'employeeNo',direction:'asc'},
      {userId:fixture.agentId,username:'forged',roleId:randomUUID(),roleName:'ADMIN',branchId:null}));
  });
  test('agent transfers retain old posting branch history for the old manager',async()=>{
    await client.query('UPDATE agent SET branch_id=$1 WHERE agent_id=$2',[fixture.otherBranchId,fixture.agentId]);
    assert.equal((await json()).body.data.rows[0].depositTotal,'0.30');
    assert.equal((await json('otherManager')).body.data.rows[0].depositTotal,'8.00');
  });
  test('generation never changes financial rows/balances and clears transaction-local state',async()=>{
    const before=(await client.query('SELECT current_balance::text,(SELECT COUNT(*)::text FROM transaction WHERE account_id=$1) AS count FROM account WHERE account_id=$1',[fixture.accountId])).rows[0];
    await json();
    const after=(await client.query('SELECT current_balance::text,(SELECT COUNT(*)::text FROM transaction WHERE account_id=$1) AS count FROM account WHERE account_id=$1',[fixture.accountId])).rows[0];
    assert.deepEqual(after,before);
    const tx=await pool.connect();try{assert.equal((await tx.query("SELECT NULLIF(current_setting('app.current_user_id',true),'') AS id")).rows[0].id,null);}finally{tx.release();}
  });
  test('completed and cancelled CSV streams remove their private temporary spools',async()=>{
    const before=new Set((await readdir(tmpdir())).filter(name=>name.startsWith('mims-rpt01-')));
    const response=await request('manager','&format=csv');await response.text();
    const cancelled=await request('manager','&format=csv');await cancelled.body.cancel();
    const partial=await request('manager','&format=csv'),reader=partial.body.getReader();
    const decoder=new TextDecoder();
    for(;;){const next=await reader.read();assert.equal(next.done,false);if(decoder.decode(next.value).includes('"DETAIL"'))break;}
    await reader.cancel();
    const after=(await readdir(tmpdir())).filter(name=>name.startsWith('mims-rpt01-')&&!before.has(name));
    assert.deepEqual(after,[]);
  });
  test('CSV snapshot stays unchanged after preparation commits and later postings arrive',async()=>{
    const prepared=await prepareRpt01({from:'2026-09-01',to:'2026-09-01',agentId:fixture.agentId,
      format:'csv',page:1,pageSize:25,sort:'employeeNo',direction:'asc'},
      {userId:fixture.managerId,username:'synthetic',roleId:randomUUID(),roleName:'BRANCH_MANAGER',branchId:fixture.branchId});
    await fixture.insert({amount:'7.00'});
    const response=streamCsv(prepared.result,{columns:[{key:'employeeNo',label:'Employee'},{key:'depositTotal',label:'Deposits'}],
      rows:prepared.csvRows,cleanup:prepared.cleanup});
    const csv=parseCsv(await response.text());
    assert.equal(csv.find(row=>row[0]==='DETAIL')[2],'0.30');
    assert.equal(csv.find(row=>row[0]==='GRAND_TOTAL')[2],'0.30');
    assert.equal((await json()).body.data.grandTotal.depositTotal,'7.30');
  });
  test('empty CSV still includes its header and exact zero totals',async()=>{
    const response=await request('manager','&format=csv',randomUUID());
    const csv=parseCsv(await response.text()),header=csv[0];
    assert.equal(csv.filter(row=>row[0]==='DETAIL').length,0);
    assert.equal(csv.find(row=>row[0]==='GRAND_TOTAL')[header.indexOf('Net LKR')],'0.00');
  });
  test('audit failure returns safe 500 and rolls back report preparation',async()=>{
    const originalConnect=pool.connect;
    async function connect(){
      const tx=await originalConnect.call(pool),query=tx.query.bind(tx);
      tx.query=function(sql,...values){
        if(typeof sql==='string'&&sql.includes('INSERT INTO audit_log'))return Promise.reject(new Error('Synthetic private SQL audit failure'));
        return query(sql,...values);
      };
      const release=tx.release.bind(tx);tx.release=error=>{tx.query=query;release(error);};return tx;
    }
    pool.connect=callback=>{
      const result=connect();
      if(!callback)return result;
      result.then(tx=>callback(null,tx,tx.release),error=>callback(error));
    };
    try{
      const result=await json();assert.equal(result.status,500);
      assert.equal(JSON.stringify(result.body).includes('SQL'),false);assert.equal(await auditCount(),0);
      const before=new Set((await readdir(tmpdir())).filter(name=>name.startsWith('mims-rpt01-')));
      assert.equal((await request('manager','&format=csv')).status,500);
      assert.deepEqual((await readdir(tmpdir())).filter(name=>name.startsWith('mims-rpt01-')&&!before.has(name)),[]);
    }finally{pool.connect=originalConnect;}
  });
});
