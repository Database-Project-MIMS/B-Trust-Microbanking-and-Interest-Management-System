import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { colomboToday, parseAgentActivityRange } from '../../lib/validation/agent-activity.ts';

describe('P03-M02-T02: Colombo calendar dates', () => {
  test('today advances at Colombo midnight while UTC remains the previous day', () => {
    assert.equal(colomboToday(new Date('2026-09-01T18:29:59Z')), '2026-09-01');
    assert.equal(colomboToday(new Date('2026-09-01T18:30:00Z')), '2026-09-02');
  });
  test('real leap day is accepted without locale date parsing', () => {
    assert.deepEqual(parseAgentActivityRange(new URLSearchParams('from=2028-02-29')),
      { from: '2028-02-29', to: '2028-02-29' });
    assert.throws(() => parseAgentActivityRange(new URLSearchParams('from=2026-02-29')));
  });
});
