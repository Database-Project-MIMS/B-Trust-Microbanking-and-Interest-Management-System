import {before,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
describe('P06 controlled financial UI initial rendering',()=>{
  let output;
  before(()=>{
    const env={...process.env};delete env.NODE_OPTIONS;
    const run=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tests/helpers/render-fd-runtime.mjs'],{env,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);output=JSON.parse(run.stdout);
  });
  test('customer gets loading status with no opening action; authorized staff get the opening link',()=>{
    assert.match(output.customer,/role="status"/);assert.doesNotMatch(output.customer,/href="\/fixed-deposits\/new"/);
    assert.match(output.staff,/href="\/fixed-deposits\/new"/);
  });
  test('auditor gets history only; controller must preview before a confirmation can appear',()=>{
    assert.doesNotMatch(output.auditor,/<form/);assert.match(output.controller,/<form/);
    assert.match(output.controller,/Preview distributions/);assert.doesNotMatch(output.controller,/Confirm and process/);
  });
  test('report blocks filter submission while loading and does not render prototype financial values',()=>{
    assert.match(output.report,/<fieldset disabled/);assert.match(output.report,/Generating report/);assert.doesNotMatch(output.report,/Sample Customer|999999/);
  });
  test('report metadata describes unbounded, one-sided and inclusive bounded periods',()=>{
    assert.match(output.allDates,/<dd>All dates<\/dd>/);
    assert.match(output.fromDate,/<dd>2026-03-01 to Any date<\/dd>/);
    assert.match(output.toDate,/<dd>Any date to 2026-03-31<\/dd>/);
    assert.match(output.dateRange,/<dd>2026-03-01 to 2026-03-31<\/dd>/);
  });
});
