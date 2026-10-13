import {describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {passwordSchema} from '../../lib/validation/password.ts';
import {createAgentSchema} from '../../lib/validation/organization.ts';
import {PASSWORD_PATTERN} from '../../lib/validation/password-policy.ts';
import {createAgent} from '../../services/agent-service.ts';
import {invalidPasswords,minimumPassword} from '../helpers/password-cases.mjs';

describe('Password creation/change policy',()=>{
  for(const [reason,password] of invalidPasswords){
    test(`rejects ${reason}`,()=>{
      assert.equal(passwordSchema.safeParse(password).success,false);
      assert.equal(createAgentSchema.shape.password.safeParse(password).success,false);
    });
  }
  for(const password of [minimumPassword,'Ab1!'+'x'.repeat(124),' Ab1!xyz ', 'Abcdef1£']){
    test(`accepts a valid ${password.length}-character password without altering it`,()=>{
      assert.equal(passwordSchema.parse(password),password);
    });
  }
  test('native browser and server patterns agree on character classes',()=>{
    const browserPattern=new RegExp(`^(?:${PASSWORD_PATTERN})$`,'v');
    for(const [,password] of invalidPasswords.filter(([,value])=>typeof value==='string'&&value.length>=8&&value.length<=128)){
      assert.equal(browserPattern.test(password),false);
    }
    assert.equal(browserPattern.test(minimumPassword),true);
    assert.equal(browserPattern.test('Abcdef1£'),true);
  });
  test('direct agent-service calls cannot bypass validation before hashing/database access',async()=>{
    await assert.rejects(()=>createAgent({password:'abcdefgh',branchId:'11111111-1111-4111-8111-111111111111'},null),e=>e.name==='ZodError');
  });
});
