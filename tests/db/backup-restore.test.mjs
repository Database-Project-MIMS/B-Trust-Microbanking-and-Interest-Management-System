import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createMigrationClient } from '../../lib/db/migration-client.mjs';
import { collectSeedMetrics,evaluateSeedMetrics } from '../../scripts/seed-validation.mjs';

test('P06-M05-T02: real pg_dump/pg_restore retains every table, money, policy and sequence',async t=>{
  assert.equal(process.env.MIMS_ISOLATED_TEST,'1','Use the isolated verifier.');
  const url = new URL(process.env.DATABASE_MIGRATION_URL);
  assert.equal(url.pathname,'/mims_test_closeout');
  assert.equal(url.hostname,'127.0.0.1');
  const suffix=randomBytes(6).toString('hex');
  const sourceName=`mims_test_backup_${suffix}`,targetName=`mims_test_restore_${suffix}`;
  const workspace=mkdtempSync(join(tmpdir(),'mims-backup-'));
  const dump=join(workspace,'backup.dump');
  const parent=createMigrationClient(url.href); await parent.connect();
  const bin=process.env.PG_BIN ?? ['18','17','16','15'].map(v=>`C:/Program Files/PostgreSQL/${v}/bin`)
    .find(p=>existsSync(join(p,'pg_dump.exe')));
  const binary=name=>bin?join(bin,process.platform==='win32'?`${name}.exe`:name):name;
  const libpq={...process.env,PGHOST:url.hostname,PGPORT:url.port,PGUSER:url.username,PGPASSWORD:decodeURIComponent(url.password)};
  function run(executable,args,env=libpq){
    const result=spawnSync(executable,args,{env,encoding:'utf8',windowsHide:true});
    // Never include connection URLs/passwords in diagnostics.
    assert.equal(result.status,0,`Verification command failed: ${executable.split(/[\\/]/).pop()}`);
    return result;
  }
  let source,target;
  async function snapshot(client){
    const tables=(await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
    const data={};
    for(const {tablename} of tables){
      assert.match(tablename,/^[a-z_][a-z0-9_]*$/);
      data[tablename]=(await client.query(`SELECT count(*)::text AS count,
        md5(COALESCE(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS checksum
        FROM public.${tablename} t`)).rows[0];
    }
    const money=(await client.query(`SELECT (SELECT sum(current_balance)::text FROM account) AS balances,
      (SELECT sum(principal_amount)::text FROM fixed_deposit) AS principal,
      (SELECT sum(interest_amount)::text FROM interest_payout) AS interest`)).rows[0];
    const catalog=(await client.query(`SELECT c.relname,c.relrowsecurity,
      pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','v','S') ORDER BY c.relname`)).rows;
    const constraints=(await client.query(`SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' ORDER BY c.relname,k.conname`)).rows.map(row=>({...row,
        // pg_dump reparses varchar enum arrays as individual ::text elements.
        // Normalize only this equivalent cast distribution, retaining all operators.
        definition:row.definition.replace(/\('([^']*)'::character varying\)::text/g,"'$1'::character varying")
          .replace(/\(ARRAY\[([^\]]*)\]\)::text\[\]/g,'ARRAY[$1]')}));
    const policies=(await client.query(`SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
      WHERE schemaname='public' ORDER BY tablename,policyname`)).rows;
    const sequences={};
    for(const {sequencename} of (await client.query(`SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`)).rows){
      assert.match(sequencename,/^[a-z_][a-z0-9_]*$/);
      sequences[sequencename]=(await client.query(`SELECT last_value::text,is_called FROM public.${sequencename}`)).rows[0];
    }
    return {data,money,catalog,constraints,policies,sequences};
  }
  try {
    for(const name of [sourceName,targetName]) await parent.query(`CREATE DATABASE ${name}`);
    url.pathname='/'+sourceName;
    const app=new URL(process.env.DATABASE_URL); app.pathname='/'+sourceName;
    run(process.execPath,['scripts/db-rebuild.mjs'],{...process.env,DATABASE_MIGRATION_URL:url.href,DATABASE_URL:app.href});
    source=createMigrationClient(url.href);await source.connect();
    const original=await snapshot(source);
    await t.test('source meets global seed minimums before backup',async()=>{
      const results=evaluateSeedMetrics(await collectSeedMetrics(source));
      assert.deepEqual(results.filter(row=>!row.ok),[]);
    });
    run(binary('pg_dump'),['--format=custom','--file',dump,'--dbname',sourceName]);
    run(binary('pg_restore'),['--exit-on-error','--dbname',targetName,dump]);
    url.pathname='/'+targetName;
    target=createMigrationClient(url.href);await target.connect();
    await t.test('restored rows/checksums, exact financial totals, constraints, RLS, ownership and sequences match',async()=>{
      assert.deepEqual(await snapshot(target),original);
    });
    run(process.execPath,['scripts/migrate.mjs','verify'],{...process.env,DATABASE_MIGRATION_URL:url.href});
    console.log(`BACKUP/RESTORE: ${Object.keys(original.data).length} tables match; exact money, constraints, RLS and sequences match.`);
  } finally {
    await source?.end();await target?.end();
    for(const name of [sourceName,targetName]) await parent.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await parent.end();
    const absolute=resolve(workspace);
    assert.ok(absolute.startsWith(resolve(tmpdir())+sep)&&absolute.split(/[\\/]/).pop().startsWith('mims-backup-'));
    rmSync(absolute,{recursive:true,force:true});
  }
});
