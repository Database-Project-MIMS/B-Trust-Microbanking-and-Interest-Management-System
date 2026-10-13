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
import {POST as createAgent} from '../../app/api/agents/route.ts';
import {invalidPasswords,minimumPassword} from '../helpers/password-cases.mjs';
import {PASSWORD_REQUIREMENTS} from '../../lib/validation/password-policy.ts';
describe('Runtime user management, profile integrity and session revocation',()=>{
 let owner,f,restore;const csrf=randomBytes(32).toString('hex');
 before(async()=>{owner=await pool.connect();await requireDisposableDatabase(owner);f=await fdFixture(owner);restore=useCustomerRuntime(pool);});
 after(async()=>{await restore?.();owner?.release();await pool.end();});
 function request(method,body,token=f.tokens.admin){return new NextRequest('http://localhost/api/admin/users',{method,headers:{cookie:`mims_session=${token}; mims_csrf=${csrf}`,'x-csrf-token':csrf,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
 function agentProfile(){const m=randomUUID().slice(0,8);return {branchId:f.branchId,employeeNo:'QA-'+m,nicPassportNo:'P'+m,fullName:'Synthetic Agent',dateOfBirth:'1990-01-01',gender:'OTHER',phone:'0110000000',address:'Synthetic Road',email:m+'@example.invalid',hiredDate:'2020-01-01'};}
 async function passwordState(id){return (await owner.query(`SELECT u.password_hash,
 (SELECT count(*)::int FROM user_session WHERE user_id=u.user_id) AS sessions,
 (SELECT jsonb_agg(jsonb_build_array(reset_id,used_at) ORDER BY reset_id) FROM password_reset_token WHERE user_id=u.user_id) AS resets
 FROM app_user u WHERE user_id=$1`,[id])).rows[0];}
 async function rejected(response){assert.equal(response.status,400,await response.clone().text());assert.deepEqual(await response.json(),{error:{code:'VALIDATION_FAILED',message:PASSWORD_REQUIREMENTS}});}
 for(const [reason,password] of invalidPasswords){
 test(`API rejects ${reason} during customer and agent login creation without writes`,async()=>{
 const username='qa-policy-'+randomUUID(),profile=agentProfile();
 const before=(await owner.query('SELECT app_user_id FROM customer WHERE customer_id=$1',[f.emptyCustomerId])).rows[0];
 await rejected(await POST(request('POST',{username,password,roleName:'CUSTOMER',customerId:f.emptyCustomerId})));
 await rejected(await POST(request('POST',{username,password,roleName:'AGENT',profile})));
 await rejected(await createAgent(request('POST',{username,password,...profile})));
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM app_user WHERE username=$1',[username])).rows[0].n,0);
 assert.deepEqual((await owner.query('SELECT app_user_id FROM customer WHERE customer_id=$1',[f.emptyCustomerId])).rows[0],before);
 });
 test(`API rejects ${reason} during customer/agent password changes and reset without consuming controls`,async()=>{
 for(const id of [f.agentId,f.customerLoginId]){
 const context={params:Promise.resolve({id})};const issued=await issueReset(request('POST'),context);
 assert.equal(issued.status,200);const token=(await issued.json()).data.token;
 const before=await passwordState(id);
 await rejected(await PATCH(request('PATCH',{password}),context));
 await rejected(await consumeReset(request('POST',{token,password})));
 assert.deepEqual(await passwordState(id),before);
 // The rejected password must leave the same link usable for a valid replacement.
 assert.equal((await consumeReset(request('POST',{token,password:minimumPassword}))).status,200);
 assert.equal(await verifyPassword((await passwordState(id)).password_hash,minimumPassword),true);
 await f.session(id);
 }
 });
 }
 test('agent endpoint accepts an eight-character password and stores only its hash',async()=>{
 const username='qa-policy-'+randomUUID();const r=await createAgent(request('POST',{username,password:minimumPassword,...agentProfile()}));
 assert.equal(r.status,201,await r.clone().text());
 const hash=(await owner.query('SELECT password_hash FROM app_user WHERE username=$1',[username])).rows[0].password_hash;
 assert.notEqual(hash,minimumPassword);assert.equal(await verifyPassword(hash,minimumPassword),true);
 });
 test('admin password updates accept the eight-character boundary and revoke sessions',async()=>{
 const id=await f.staff('AUDITOR');await f.session(id);
 const r=await PATCH(request('PATCH',{password:minimumPassword}),{params:Promise.resolve({id})});assert.equal(r.status,200,await r.clone().text());
 const state=await passwordState(id);assert.equal(state.sessions,0);assert.equal(await verifyPassword(state.password_hash,minimumPassword),true);
 });
 test('bank-wide user creation hashes password and listing never exposes hashes',async()=>{
 const username='qa-'+randomUUID(),password=minimumPassword;const r=await POST(request('POST',{username,password,roleName:'AUDITOR'}));assert.equal(r.status,201,await r.clone().text());const id=(await r.json()).data.userId;
 const hash=(await owner.query('SELECT password_hash FROM app_user WHERE user_id=$1',[id])).rows[0].password_hash;assert.notEqual(hash,password);assert.equal(await verifyPassword(hash,password),true);
 const list=await GET(request('GET'));assert.equal(list.status,200);assert.doesNotMatch(await list.text(),/password_hash|synthetic-unusable-hash/);
 const token=await f.session(id);const update=await PATCH(request('PATCH',{status:'INACTIVE'}),{params:Promise.resolve({id})});assert.equal(update.status,200,await update.clone().text());
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM user_session WHERE user_id=$1',[id])).rows[0].n,0);
 assert.equal((await GET(request('GET',undefined,token))).status,401);
 });
 test('customer creation requires a live unlinked customer and duplicate link rolls back',async()=>{
 const body={username:'qa-c-'+randomUUID(),password:minimumPassword,roleName:'CUSTOMER',customerId:f.emptyCustomerId};
 const r=await POST(request('POST',body));assert.equal(r.status,201,await r.clone().text());const id=(await r.json()).data.userId;
 assert.equal((await owner.query('SELECT app_user_id FROM customer WHERE customer_id=$1',[f.emptyCustomerId])).rows[0].app_user_id,id);
 assert.equal((await POST(request('POST',{...body,username:'qa-c-'+randomUUID()}))).status,409);
 assert.equal((await POST(request('POST',{...body,username:'qa-c-'+randomUUID(),customerId:undefined}))).status,400);
 });
 test('branch manager creation includes its profile in the same transaction',async()=>{
 const m=randomUUID().slice(0,8);const body={username:'qa-m-'+m,password:minimumPassword,roleName:'BRANCH_MANAGER',profile:{branchId:f.branchId,employeeNo:'QA-'+m,nicPassportNo:'P'+m,fullName:'Synthetic Manager',dateOfBirth:'1990-01-01',gender:'OTHER',phone:'0110000000',address:'Synthetic Road',email:m+'@example.invalid',hiredDate:'2020-01-01'}};
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
 const id=await f.staff('AUDITOR'),context={params:Promise.resolve({id})};const password=minimumPassword;
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
