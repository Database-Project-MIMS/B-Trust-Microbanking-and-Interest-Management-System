import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createMigrationClient } from '../../lib/db/migration-client.mjs';

/** Creates a separately rebuilt test DB so destructive legacy fixtures cannot touch other suites. */
export async function isolatedOpsDatabase(prefix){
  assert.equal(process.env.MIMS_ISOLATED_TEST,'1');
  assert.match(prefix,/^[a-z_]+$/);
  const owner=new URL(process.env.DATABASE_MIGRATION_URL),app=new URL(process.env.DATABASE_URL);
  assert.equal(owner.pathname,'/mims_test_closeout');
  const admin=createMigrationClient(owner.href);await admin.connect();
  const name=`mims_test_${prefix}_${randomBytes(5).toString('hex')}`;
  let client;
  try{
    await admin.query(`CREATE DATABASE ${name}`);
    owner.pathname=app.pathname='/'+name;
    const result=spawnSync(process.execPath,['scripts/db-rebuild.mjs'],{encoding:'utf8',windowsHide:true,
      env:{...process.env,DATABASE_MIGRATION_URL:owner.href,DATABASE_URL:app.href},timeout:30000});
    assert.equal(result.status,0,'Separate fixture rebuild failed.');
    client=createMigrationClient(owner.href);await client.connect();
    return {client,async close(){try{await client.end();await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);}finally{await admin.end();}}};
  }catch(error){await client?.end();await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.end();throw error;}
}
