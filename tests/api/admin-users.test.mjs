import {after,before,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {fdFixture,pool,requireDisposableDatabase} from '../helpers/customer-fixed-deposits.mjs';
import {useCustomerRuntime} from '../helpers/customer-runtime.mjs';
import {GET,POST} from '../../app/api/admin/users/route.ts';
import {PATCH} from '../../app/api/admin/users/[id]/route.ts';
import {POST as issueReset} from '../../app/api/admin/users/[id]/reset/route.ts';
import {POST as consumeReset} from '../../app/api/auth/reset/route.ts';
import {verifyPassword} from '../../lib/auth/password.ts';
import {GET as audit} from '../../app/api/audit/route.ts';
describe('Runtime user management, profile integrity and session revocation',()=>{
 let owner,f,restore;const csrf=randomBytes(32).toString('hex');
 before(async()=>{owner=await pool.connect();await requireDisposableDatabase(owner);f=await fdFixture(owner);restore=useCustomerRuntime(pool);});
 after(async()=>{await restore?.();owner?.release();await pool.end();});
 function request(method,body,token=f.tokens.admin){return new NextRequest('http://localhost/api/admin/users',{method,headers:{cookie:`mims_session=${token}; mims_csrf=${csrf}`,'x-csrf-token':csrf,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
 test('bank-wide user creation hashes password and listing never exposes hashes',async()=>{
 const username='qa-'+randomUUID(),password=randomBytes(16).toString('hex');const r=await POST(request('POST',{username,password,roleName:'AUDITOR'}));assert.equal(r.status,201,await r.clone().text());const id=(await r.json()).data.userId;
 const hash=(await owner.query('SELECT password_hash FROM app_user WHERE user_id=$1',[id])).rows[0].password_hash;assert.notEqual(hash,password);assert.equal(await verifyPassword(hash,password),true);
 const list=await GET(request('GET'));assert.equal(list.status,200);assert.doesNotMatch(await list.text(),/password_hash|synthetic-unusable-hash/);
 const token=await f.session(id);const update=await PATCH(request('PATCH',{status:'INACTIVE'}),{params:Promise.resolve({id})});assert.equal(update.status,200,await update.clone().text());
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM user_session WHERE user_id=$1',[id])).rows[0].n,0);
 assert.equal((await GET(request('GET',undefined,token))).status,401);
 });
 test('customer creation requires a live unlinked customer and duplicate link rolls back',async()=>{
 const body={username:'qa-c-'+randomUUID(),password:randomBytes(16).toString('hex'),roleName:'CUSTOMER',customerId:f.emptyCustomerId};
 const r=await POST(request('POST',body));assert.equal(r.status,201,await r.clone().text());const id=(await r.json()).data.userId;
 assert.equal((await owner.query('SELECT app_user_id FROM customer WHERE customer_id=$1',[f.emptyCustomerId])).rows[0].app_user_id,id);
 assert.equal((await POST(request('POST',{...body,username:'qa-c-'+randomUUID()}))).status,409);
 assert.equal((await POST(request('POST',{...body,username:'qa-c-'+randomUUID(),customerId:undefined}))).status,400);
 });
 test('branch manager creation includes its profile in the same transaction',async()=>{
 const m=randomUUID().slice(0,8);const body={username:'qa-m-'+m,password:randomBytes(16).toString('hex'),roleName:'BRANCH_MANAGER',profile:{branchId:f.branchId,employeeNo:'QA-'+m,nicPassportNo:'P'+m,fullName:'Synthetic Manager',dateOfBirth:'1990-01-01',gender:'OTHER',phone:'0110000000',address:'Synthetic Road',email:m+'@example.invalid',hiredDate:'2020-01-01'}};
 const r=await POST(request('POST',body));assert.equal(r.status,201,await r.clone().text());const id=(await r.json()).data.userId;
 assert.equal((await owner.query('SELECT branch_id FROM agent WHERE agent_id=$1',[id])).rows[0].branch_id,f.branchId);
 });
 test('roles, CSRF, self-deactivation and assigned-agent deactivation fail closed',async()=>{
 assert.equal((await GET(request('GET',undefined,f.tokens.manager))).status,403);
 const r=await POST(new NextRequest('http://localhost/api/admin/users',{method:'POST',headers:{cookie:`mims_session=${f.tokens.admin}`},body:'{}'}));assert.equal(r.status,403);
 assert.equal((await PATCH(request('PATCH',{status:'INACTIVE'}),{params:Promise.resolve({id:f.adminId})})).status,409);
 assert.equal((await PATCH(request('PATCH',{status:'INACTIVE'}),{params:Promise.resolve({id:f.agentId})})).status,409);
 });
 test('user and audit searches reject duplicate and unknown filters',async()=>{
 for(const [handler,path] of [[GET,'/api/admin/users'],[audit,'/api/audit']])for(const suffix of ['?page=1&page=2','?unknown=1']){
 const r=await handler(new NextRequest('http://localhost'+path+suffix,{headers:{cookie:`mims_session=${f.tokens.admin}`}}));assert.equal(r.status,400);
 }
 });
 test('reset links expire, are superseded, consume once and revoke all sessions',async()=>{
 const id=await f.staff('AUDITOR'),context={params:Promise.resolve({id})};const password=randomBytes(16).toString('hex');
 const first=await issueReset(request('POST'),context);assert.equal(first.status,200,await first.clone().text());const old=(await first.json()).data.token;
 const issued=await issueReset(request('POST'),context);const token=(await issued.json()).data.token;await f.session(id);
 assert.equal((await consumeReset(request('POST',{token:old,password}))).status,400);
 const responses=await Promise.all([consumeReset(request('POST',{token,password})),consumeReset(request('POST',{token,password}))]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM user_session WHERE user_id=$1',[id])).rows[0].n,0);
 assert.equal(await verifyPassword((await owner.query('SELECT password_hash FROM app_user WHERE user_id=$1',[id])).rows[0].password_hash,password),true);
 assert.equal((await consumeReset(request('POST',{token,password}))).status,400);
 const expired=(await issueReset(request('POST'),context));const t=(await expired.json()).data.token;
 await owner.query("UPDATE password_reset_token SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id=$1 AND used_at IS NULL",[id]);
 assert.equal((await consumeReset(request('POST',{token:t,password}))).status,400);
 });
 test('database rejects disabling the last active administrator',async()=>{
 await owner.query('BEGIN');try{
 const admins=(await owner.query("SELECT u.user_id FROM app_user u JOIN role r USING(role_id) WHERE r.role_name='ADMIN' AND u.status='ACTIVE'")).rows;
 for(const {user_id:id} of admins.slice(1))await owner.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1",[id]);
 await assert.rejects(()=>owner.query("UPDATE app_user SET status='INACTIVE' WHERE user_id=$1",[admins[0].user_id]),e=>e.code==='P0001'&&e.message==='LAST_ADMINISTRATOR');
 }finally{await owner.query('ROLLBACK');}
 });
});
