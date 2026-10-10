// Disposable local UI QA only; never targets the developer or production database.
import {writeFileSync} from 'node:fs';
import {fdFixture,pool,requireDisposableDatabase} from './customer-fixed-deposits.mjs';
import {hashPassword} from '../../lib/auth/password.ts';
const client=await pool.connect();
try{
 await requireDisposableDatabase(client);const f=await fdFixture(client);
 const hash=await hashPassword('Browser-QA-2026!');
 for(const [role,id] of Object.entries({admin:f.adminId,manager:f.managerId,agent:f.agentId,customer:f.customerLoginId,central:f.centralId,auditor:f.auditorId}))await client.query('UPDATE app_user SET username=$1,password_hash=$2 WHERE user_id=$3',[`qa.${role}`,hash,id]);
 await client.query("UPDATE system_parameter SET param_value='00:00' WHERE param_key='BUSINESS_HOUR_START'");
 await client.query("UPDATE system_parameter SET param_value='23:59:59' WHERE param_key='BUSINESS_HOUR_END'");
 const a=await f.account([f.customerId]);
 writeFileSync('test-results/preview-fixture.json',JSON.stringify({accountId:a.account_id,accountNumber:a.account_number,customerId:f.customerId,branchId:f.branchId}));
}finally{client.release();await pool.end();}
