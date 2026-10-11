import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

describe('P06-M02-T04: accessible record controls and reference details', () => {
  let output;
  before(() => {
    const env = { ...process.env }; delete env.NODE_OPTIONS;
    const run = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'tests/helpers/render-record-controls.mjs'], { env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr); output = JSON.parse(run.stdout);
  });
  test('explicit view links describe the record and edit appears only when permitted', () => {
    assert.match(output.readOnly, /aria-label="View details for Savings account"/); assert.match(output.readOnly, /href="\/accounts\/example"/);
    assert.doesNotMatch(output.readOnly, />Edit</); assert.match(output.editable, /href="\/customers\/example\?edit=1"/);
    assert.match(output.editable, /aria-label="Edit Synthetic Customer"/);
  });
  test('edit form labels inputs, retains initial data and separates cancel from save', () => {
    assert.match(output.form, /<form[^>]+aria-label="Edit customer"/); assert.match(output.form, /Full name \(required\)/);
    assert.match(output.form, /name="fullName"[^>]*value="Synthetic Customer"/);
    assert.match(output.form, /value="FEMALE" selected=""/); assert.match(output.form, /type="button">Cancel/); assert.match(output.form, /type="submit">Save changes/);
    assert.doesNotMatch(output.form, /name="nicPassportNo"|name="dateOfBirth"|name="currentBalance"/);
  });
  test('reference views use native keyboard-accessible expansion and definition-list fields', () => {
    assert.match(output.preview, /<details><summary/); assert.match(output.preview, /<dt>Description<\/dt><dd[^>]*>—<\/dd>/);
    assert.match(output.preview, /13\.75%/);
    assert.match(output.plan, /View details for Joint/); assert.match(output.plan, /Maximum holders/); assert.match(output.plan, /All holders must be adults/);
    assert.doesNotMatch(output.plan, />Edit<\/button>/);
  });
});
