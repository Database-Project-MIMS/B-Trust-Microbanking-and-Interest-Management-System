import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware.ts';

function response(mode, headers = {}) {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = mode;
    return middleware(new NextRequest('https://bank.example.invalid/sign-in', { headers }));
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}
function directives(result) {
  return Object.fromEntries(result.headers.get('content-security-policy').split('; ')
    .map(value => { const [name, ...sources] = value.split(' '); return [name, sources]; }));
}

describe('P06 enforced nonce CSP', () => {
  test('fresh responses use distinct cryptographic nonces and forward the matching rendering policy', () => {
    const first = response('production'), second = response('production');
    const nonce = first.headers.get('x-middleware-request-x-nonce');
    assert.match(nonce, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.match(Buffer.from(nonce, 'base64').toString(), /^[0-9a-f-]{36}$/);
    assert.notEqual(nonce, second.headers.get('x-middleware-request-x-nonce'));
    assert.equal(first.headers.get('x-middleware-request-content-security-policy'), first.headers.get('content-security-policy'));
    assert.ok(directives(first)['script-src'].includes(`'nonce-${nonce}'`));
  });
  test('caller-supplied CSP and nonce cannot authorize injected scripts', () => {
    const result = response('production', { 'x-nonce': 'attacker', 'content-security-policy': "script-src * 'unsafe-inline'" });
    assert.notEqual(result.headers.get('x-middleware-request-x-nonce'), 'attacker');
    assert.doesNotMatch(result.headers.get('content-security-policy'), /attacker|script-src \*/);
    assert.doesNotMatch(directives(result)['script-src'].join(' '), /unsafe-inline|unsafe-eval/);
  });
  test('production denies framing, plugins, external connections and arbitrary inline/eval scripts', () => {
    const policy = directives(response('production'));
    assert.deepEqual(policy['default-src'], ["'self'"]);
    assert.deepEqual(policy['connect-src'], ["'self'"]);
    assert.deepEqual(policy['object-src'], ["'none'"]);
    assert.deepEqual(policy['frame-ancestors'], ["'none'"]);
    assert.deepEqual(policy['form-action'], ["'self'"]);
    assert.deepEqual(policy['base-uri'], ["'self'"]);
    assert.ok(policy['script-src'].includes("'strict-dynamic'"));
    assert.doesNotMatch(policy['script-src'].join(' '), /unsafe-inline|unsafe-eval/);
    assert.ok(Object.hasOwn(policy, 'upgrade-insecure-requests'));
  });
  test('development permits HMR without weakening the production policy', () => {
    const dev = directives(response('development'));
    assert.ok(dev['script-src'].includes("'unsafe-eval'"));
    assert.ok(dev['connect-src'].includes('ws:'));
    assert.equal(Object.hasOwn(dev, 'upgrade-insecure-requests'), false);
    assert.doesNotMatch(directives(response('production'))['script-src'].join(' '), /unsafe-eval/);
  });
});
