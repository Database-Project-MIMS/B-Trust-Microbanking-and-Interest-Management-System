import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createMigrationClient} from '../../lib/db/migration-client.mjs';
import {isolatedOpsDatabase} from '../helpers/isolated-ops-database.mjs';

test('Temporary owner cleanup waits for a privileged connection to close without forcing termination',async()=>{
  assert.equal(process.env.MIMS_ISOLATED_TEST,'1');
  const ownerUrl=new URL(process.env.DATABASE_MIGRATION_URL);
  assert.equal(ownerUrl.hostname,'127.0.0.1');
  assert.equal(ownerUrl.pathname,'/mims_test_closeout');
  const fixture=await isolatedOpsDatabase('cleanup');
  const name=(await fixture.client.query('SELECT current_database() AS name')).rows[0].name;
  assert.match(name,/^mims_test_cleanup_[0-9a-f]+$/);
  const control=createMigrationClient(ownerUrl.href);
  const privilegedUrl=new URL(ownerUrl.href);
  // This superuser exists only in scripts/verify-phase-01.mjs's disposable cluster.
  privilegedUrl.username='mims_test_admin';privilegedUrl.pathname='/'+name;
  const privileged=createMigrationClient(privilegedUrl.href);
  let closing,connected=false,settled=false;
  try{
    await control.connect();connected=true;await privileged.connect();
    const permissions=(await control.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.deepEqual(permissions,{rolsuper:false,rolbypassrls:false});
    // Reproduce the previous teardown error while both fixture connections remain open.
    await assert.rejects(()=>control.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`),error=>error.code==='42501');
    closing=fixture.close();
    const result=closing.then(()=>{settled=true;return {ok:true};},error=>{settled=true;return {ok:false,error};});
    const deadline=Date.now()+3000;
    let observed=false;
    while(!settled&&Date.now()<deadline){
      const active=await control.query(`SELECT 1 FROM pg_stat_activity
        WHERE datname='mims_test_closeout' AND usename=current_user AND state='active'
          AND query LIKE 'DROP DATABASE%' AND strpos(query,$1)>0`,[name]);
      if(active.rowCount){observed=true;break;}
      await delay(25);
    }
    assert.equal(observed,true,'Cleanup must wait while the privileged fixture connection is still open.');
    await privileged.end();
    const outcome=await result;
    assert.equal(outcome.ok,true,outcome.error?.message);
    assert.equal((await control.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount,0);
  }finally{
    await privileged.end();
    if(closing)await closing.catch(()=>{});else await fixture.close();
    if(connected)await control.query(`DROP DATABASE IF EXISTS ${name}`);
    await control.end();
  }
});
