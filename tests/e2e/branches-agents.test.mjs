import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import * as branchCollectionRoute from "../../app/api/branches/route.ts";
import * as branchItemRoute from "../../app/api/branches/[id]/route.ts";
import * as agentCollectionRoute from "../../app/api/agents/route.ts";
import * as agentItemRoute from "../../app/api/agents/[id]/route.ts";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
  try { process.loadEnvFile(); } catch { }
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

function request(method, path, { body, token, csrf } = {}) {
  return {
    method,
    url: `http://localhost${path}`,
    json: async () => body,
    headers: new Headers(csrf ? { "x-csrf-token": csrf } : {}),
    cookies: {
      get: (name) => {
        if (name === "mims_session" && token) return { value: token };
        if (name === "mims_csrf" && csrf) return { value: csrf };
        return undefined;
      },
    },
  };
}

describe("P01-M02-T04: branch and agent administration workflow", () => {
  const runId = crypto.randomBytes(5).toString("hex");
  const branchCode = `UI${runId}`.toUpperCase();
  const username = `ui_${runId}_admin`;
  const agentUsername = `ui_${runId}_agent`;
  let client;
  let adminId;
  let adminToken;
  let branchId;
  let agentId;
  let createdAgentRoleId;

  before(async () => {
    assert.ok(connectionString, "DATABASE_URL or DATABASE_MIGRATION_URL is required");
    client = new pg.Client({ connectionString });
    await client.connect();

    const role = await client.query(
      `INSERT INTO role (role_name, description)
       VALUES ('ADMIN', 'Administrator')
       ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
       RETURNING role_id`,
    );
    const user = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash, status)
       VALUES ($1, $2, 'test-only-hash', 'ACTIVE')
       RETURNING user_id`,
      [role.rows[0].role_id, username],
    );
    adminId = user.rows[0].user_id;
    const agentRole = await client.query(
      `INSERT INTO role (role_name, description, status)
       VALUES ('AGENT', 'Ordinary branch agent', 'ACTIVE')
       ON CONFLICT (role_name) DO NOTHING
       RETURNING role_id`,
    );
    createdAgentRoleId = agentRole.rows[0]?.role_id;
    adminToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(adminToken).digest("hex");
    await client.query(
      `INSERT INTO user_session (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [adminId, tokenHash],
    );
  });

  after(async () => {
    if (!client) return;
    try {
      await client.query(`DELETE FROM user_session WHERE user_id = $1`, [adminId]);
      if (agentId) {
        await client.query(`DELETE FROM agent WHERE agent_id = $1`, [agentId]);
        await client.query(`DELETE FROM app_user WHERE user_id = $1`, [agentId]);
      }
      await client.query(`DELETE FROM app_user WHERE user_id = $1`, [adminId]);
      if (branchId) await client.query(`DELETE FROM branch WHERE branch_id = $1`, [branchId]);
      if (createdAgentRoleId) await client.query(`DELETE FROM role WHERE role_id = $1`, [createdAgentRoleId]);
    } finally {
      await client.end();
    }
  });

  test("ADMIN creates, lists and deactivates a branch and its ordinary agent", async () => {
    const createBranchCsrf = crypto.randomBytes(32).toString("hex");
    const branchResponse = await branchCollectionRoute.POST(
      request("POST", "/api/branches", {
        token: adminToken,
        csrf: createBranchCsrf,
        body: {
          branchCode,
          branchName: "UI Workflow Branch",
          address: "1 Synthetic Test Road",
          district: "Colombo",
          phone: "+94110000009",
        },
      }),
    );
    assert.equal(branchResponse.status, 201);
    branchId = (await branchResponse.json()).data.branchId;

    const createAgentCsrf = crypto.randomBytes(32).toString("hex");
    const agentResponse = await agentCollectionRoute.POST(
      request("POST", "/api/agents", {
        token: adminToken,
        csrf: createAgentCsrf,
        body: {
          branchId,
          username: agentUsername,
          password: "Safe-Test-Password-123!",
          employeeNo: `EMP-${runId}`,
          nicPassportNo: `NIC-${runId}`,
          fullName: "UI Workflow Agent",
          dateOfBirth: "1992-05-10",
          gender: "OTHER",
          phone: "+94112223344",
          address: "2 Synthetic Test Road",
          email: `${agentUsername}@example.test`,
          hiredDate: "2024-01-15",
        },
      }),
    );
    const agentBody = await agentResponse.json();
    assert.equal(agentResponse.status, 201, JSON.stringify(agentBody));
    agentId = agentBody.data.agentId;

    const activeList = await agentCollectionRoute.GET(
      request("GET", "/api/agents?status=ACTIVE", { token: adminToken }),
    );
    assert.equal(activeList.status, 200);
    assert.ok((await activeList.json()).data.some((agent) => agent.agentId === agentId));

    const deactivateAgentCsrf = crypto.randomBytes(32).toString("hex");
    const deactivatedAgent = await agentItemRoute.PATCH(
      request("PATCH", `/api/agents/${agentId}`, {
        token: adminToken,
        csrf: deactivateAgentCsrf,
        body: { status: "INACTIVE" },
      }),
      { params: Promise.resolve({ id: agentId }) },
    );
    assert.equal(deactivatedAgent.status, 200);

    const activeAfterDeactivate = await agentCollectionRoute.GET(
      request("GET", "/api/agents?status=ACTIVE", { token: adminToken }),
    );
    assert.ok(!(await activeAfterDeactivate.json()).data.some((agent) => agent.agentId === agentId));

    const allAfterDeactivate = await agentCollectionRoute.GET(
      request("GET", "/api/agents", { token: adminToken }),
    );
    assert.ok((await allAfterDeactivate.json()).data.some((agent) => agent.agentId === agentId));

    const deactivateBranchCsrf = crypto.randomBytes(32).toString("hex");
    const deactivatedBranch = await branchItemRoute.PATCH(
      request("PATCH", `/api/branches/${branchId}`, {
        token: adminToken,
        csrf: deactivateBranchCsrf,
        body: { status: "INACTIVE" },
      }),
      { params: Promise.resolve({ id: branchId }) },
    );
    assert.equal(deactivatedBranch.status, 200);
    assert.equal((await deactivatedBranch.json()).data.status, "INACTIVE");
  });
});
