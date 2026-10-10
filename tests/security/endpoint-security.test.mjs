import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { pool, createFixture, requireDisposableDatabase } from '../helpers/customer-registration.mjs';
import { useCustomerRuntime } from '../helpers/customer-runtime.mjs';
import { roles, routes } from '../helpers/security-routes.mjs';

const payloads = ["'; DROP TABLE app_user; --", "' OR '1'='1", "' UNION SELECT password_hash FROM app_user --",
  '1; SELECT pg_sleep(10) --', "' AND 1=1 --", "admin'--", "1' ORDER BY 100 --",
  "' OR 1=1; COPY app_user TO '/tmp/pwned' --"];
const missingId = '00000000-0000-4000-8000-000000000099';
const handlers = new Map();
for (const item of routes) {
  const module = await import(`../../app/api/${item.path}/route.ts`);
  handlers.set(`${item.method} ${item.path}`, module[item.method]);
}
function discovered(directory = 'app/api', prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return discovered(path, prefix + entry.name + '/');
    if (entry.name !== 'route.ts') return [];
    return [...readFileSync(path,'utf8').matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)]
      .map(match => `${match[1]} ${prefix.slice(0,-1)}`);
  });
}
function setNested(body, path, value) {
  const parts = path.split('.');
  let target = body;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]] ??= /^\d+$/.test(parts[i+1]) ? [] : {};
  }
  target[parts.at(-1)] = value;
}

describe('P06-M01-T01/T02: actual endpoint injection and independent role matrix', () => {
  let client, fixture, restore;
  const users = {};
  const csrf = randomBytes(32).toString('hex');
  before(async () => {
    client = await pool.connect();
    await requireDisposableDatabase(client);
    fixture = await createFixture(client);
    for (const role of roles) users[role] = await fixture.staff(role);
    restore = useCustomerRuntime(pool);
    assert.equal((await pool.query('SELECT current_user AS role')).rows[0].role,'mims_app');
  });
  after(async () => { await restore?.(); client?.release(); await pool.end(); });

  async function call(item, role, injection) {
    const token = randomBytes(32).toString('hex');
    await client.query(`INSERT INTO user_session(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 hour')`,
      [users[role],createHash('sha256').update(token).digest('hex')]);
    const params = { id: item.path === 'agents/[id]/activity' && role === 'AGENT' ? users[role] : missingId,
      key: 'NONEXISTENT_SECURITY_PARAMETER' };
    const body = structuredClone(item.body);
    const query = new URLSearchParams();
    const headers = { cookie: `mims_session=${token}; mims_csrf=${csrf}`, 'x-csrf-token': csrf,
      'content-type':'application/json', 'idempotency-key':`SEC-${randomUUID()}`, origin:'http://localhost' };
    if (injection) {
      const [position,...rest] = injection.field.split('.');
      const name = rest.join('.');
      if (position === 'path') params[name] = injection.value;
      if (position === 'query') query.set(name,injection.value);
      if (position === 'body') setNested(body,name,injection.value);
      if (position === 'header') headers[name] = injection.value;
      if (position === 'cookie') headers.cookie = `mims_session=${encodeURIComponent(injection.value)}; mims_csrf=${csrf}`;
    }
    const path = item.path.replace('[id]',encodeURIComponent(params.id)).replace('[key]',encodeURIComponent(params.key));
    const request = new NextRequest(`http://localhost/api/${path}?${query}`, { method:item.method, headers,
      ...(item.method === 'GET' ? {} : { body:JSON.stringify(body) }) });
    const handler = handlers.get(`${item.method} ${item.path}`);
    assert.equal(typeof handler,'function');
    return handler(request,{ params:Promise.resolve(params) });
  }
  async function fingerprint(excludeAudit = false) {
    // Authentication intentionally changes session last_seen/login_attempt. Business
    // rows and audits must be identical on a role denial, not just equal counts.
    const tables = ['branch','agent','customer','customer_agent','customer_document','account','account_holder',
      'joint_mandate','transaction','transaction_reversal','fixed_deposit','fd_maturity_receipt','fd_opening_request','account_opening_request','interest_run','interest_payout','password_reset_token','audit_log','savings_plan','fd_plan','system_parameter'];
    const fields = tables.filter(table => !excludeAudit || table !== 'audit_log').map(table =>
      `(SELECT md5(COALESCE(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text),'')) FROM ${table} t) AS "${table}"`);
    return (await client.query(`SELECT ${fields.join(',')}`)).rows[0];
  }
  async function safe(response) {
    if (response.status === 204) return;
    const text = await response.text();
    const inspected = response.status >= 400 ? text : text.replaceAll('password_hash','[literal request text]');
    assert.ok(!/password_hash|postgres(?:ql)?:\/\/|SQLSTATE|syntax error at|violates .*constraint|stack|\bat .*\.ts:\d+/i.test(inspected),text);
    if (response.status < 400) assert.ok(!/"password_hash"\s*:/.test(text),'Password hash field leaked.');
  }
  test('every actual exported handler is represented exactly once', () => {
    assert.deepEqual(routes.map(item=>`${item.method} ${item.path}`).sort(),discovered().sort());
  });
  test('valid free-text input binds injection strings as data without executing SQL',async()=>{
    const branchRoute=routes.find(item=>item.path==='branches' && item.method==='POST');
    for(const literal of payloads){
      const branchCode='SQL-'+randomUUID().slice(0,8);
      const item={...branchRoute,body:{branchCode,branchName:literal,address:'Synthetic street',district:'Colombo',phone:'0110000000'}};
      const response=await call(item,'ADMIN');
      assert.equal(response.status,201,await response.clone().text());
      assert.equal((await client.query('SELECT branch_name FROM branch WHERE branch_code=$1',[branchCode])).rows[0].branch_name,literal);
      assert.equal((await client.query("SELECT to_regclass('public.app_user') IS NOT NULL AS ok")).rows[0].ok,true);
    }
  });
  for (const item of routes) for (const role of roles) test(`${item.method} /api/${item.path}: ${role}`, async () => {
    const permitted = item.allowed.includes(role);
    const original = permitted ? null : await fingerprint();
    const response = await call(item,role);
    if (permitted) assert.ok([200,201,204,400,404,409,422].includes(response.status),`Allowed role hit ${response.status}: ${await response.clone().text()}`);
    else {
      assert.equal(response.status,403,await response.clone().text());
      assert.deepEqual(await fingerprint(),original,'Denied request altered business rows or audit.');
    }
    await safe(response);
  });
  for (const item of routes) for (const field of item.fields) for (const value of payloads)
    test(`${item.method} /api/${item.path} ${field}: ${value}`, async () => {
      const original = await fingerprint(true);
      const started = performance.now();
      const response = await call(item,item.allowed[0],{ field,value });
      assert.ok(performance.now()-started < 5000,'Injection caused a pg_sleep delay.');
      assert.ok([200,201,204,400,401,403,404,409,422].includes(response.status),`Unsafe status ${response.status}: ${await response.clone().text()}`);
      await safe(response);
      assert.deepEqual(await fingerprint(true),original,'Injection changed business or financial state.');
      assert.equal((await client.query("SELECT to_regclass('public.app_user') IS NOT NULL AS present")).rows[0].present,true);
    });
});
