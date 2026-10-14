import {before,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
describe('P06-M04-T03: rendered transfer and posting method forms',()=>{
  let output;
  before(()=>{
    const env={...process.env};delete env.NODE_OPTIONS;
    const run=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','tests/helpers/render-customer-transfer-methods.mjs'],{env,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);output=JSON.parse(run.stdout);
  });
  test('customer form contains only owned sources and an explicit recipient account-number input',()=>{
    assert.match(output.customer,/From my account \(required\)/);assert.match(output.customer,/OWN-00000001/);
    assert.match(output.customer,/Recipient account number \(required\)/);assert.match(output.customer,/Review transfer/);
    assert.match(output.customer,/LKR 1,234\.56/);assert.doesNotMatch(output.customer,/Holder authorization|Destination balance|Withdraw/);
  });
  test('no owned account gives an explicit empty state without a transfer button',()=>{
    assert.match(output.empty,/no active savings accounts/);assert.doesNotMatch(output.empty,/Review transfer/);
  });
  test('both staff forms label Method and offer exactly Cash/Cheque',()=>{
    for(const html of [output.deposit,output.withdraw]){
      assert.match(html,/Method \(required\)/);
      assert.match(html,/value="CASH"[^>]*>Cash/);assert.match(html,/value="CHEQUE"[^>]*>Cheque/);
      assert.doesNotMatch(html,/Channel \(required\)|BRANCH COUNTER|ONLINE/);
    }
  });
});
