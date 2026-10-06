import { randomBytes } from 'node:crypto';
export { pool, createFixture, requireDisposableDatabase } from './customer-relations.mjs';

export function registrationInput(fixture, overrides = {}) {
  const suffix = randomBytes(6).toString('hex');
  return { fullName: 'Synthetic Registration Customer', nicPassportNo: `P${suffix.toUpperCase()}`,
    dateOfBirth: '1990-01-01', email: `register-${suffix}@example.invalid`,
    branchId: fixture.branchId, agentId: fixture.agentId,
    documents: [{ docType: 'NIC', filePath: `synthetic/${suffix}/nic.pdf` },
      { docType: 'ADDRESS_PROOF', filePath: `synthetic/${suffix}/address.pdf` }], ...overrides };
}

export function actor(fixture, roleName = 'AGENT', userId = fixture.agentId, branchId = fixture.branchId) {
  return { userId, roleName, branchId };
}

export async function counts(client) {
  const result = await client.query(`SELECT
    (SELECT count(*)::int FROM customer) AS customers,
    (SELECT count(*)::int FROM customer_document) AS documents,
    (SELECT count(*)::int FROM customer_agent) AS assignments,
    (SELECT count(*)::int FROM audit_log) AS audits`);
  return result.rows[0];
}
