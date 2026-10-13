import {describe,test,before} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

describe('Password form accessibility and shared native constraints',()=>{
 let html;
 before(()=>{
  const env={...process.env};delete env.NODE_OPTIONS;
  const run=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tests/helpers/render-new-password-input.mjs'],{encoding:'utf8',env});
  assert.equal(run.status,0,run.stderr);html=JSON.parse(run.stdout);
 });
 test('required input communicates every requirement and enforces the length bounds',()=>{
  assert.match(html.required,/type="password"/);assert.match(html.required,/autoComplete="new-password"/i);
  assert.match(html.required,/minLength="8"/i);assert.match(html.required,/maxLength="128"/i);
  assert.match(html.required,/pattern="/);assert.match(html.required,/required=""/);
  for(const word of ['uppercase','lowercase','number','symbol'])assert.match(html.required,new RegExp(word));
  const help=html.required.match(/aria-describedby="([^"]+)"/)[1];
  assert.ok(html.required.includes(`<small id="${help}">`));
 });
 test('optional password changes retain existing accessible descriptions and allow empty input',()=>{
  assert.doesNotMatch(html.optional,/required=""/);assert.match(html.optional,/aria-describedby="other-help [^"]+"/);
 });
 test('agent, user management and reset screens all use the shared field',()=>{
  for(const path of ['components/organization/organization-table.tsx','app/admin/users/user-screen.tsx','app/reset-password/page.tsx']){
   const source=readFileSync(path,'utf8');assert.match(source,/<NewPasswordInput\b/);assert.doesNotMatch(source,/minLength=\{12\}/);
  }
  assert.doesNotMatch(readFileSync('app/sign-in/page.tsx','utf8'),/NewPasswordInput|PASSWORD_PATTERN/);
 });
});
