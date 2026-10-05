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

const ownerConnectionString =
  process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

function mockRequest(method, path, { body, token, csrfToken } = {}) {
  const cookies = {};
  if (token) cookies.mims_session = token;
  if (csrfToken) cookies.mims_csrf = csrfToken;

  return {
    method,
    url: `http://localhost${path}`,
    json: async () => body,
    headers: new Headers(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    cookies: {
      get: (name) => cookies[name] ? { value: cookies[name] } : undefined,
    },
  };
}

function csrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

describe("P01-M02-T03: Branch and agent APIs", () => {
  const runId = crypto.randomBytes(6).toString("hex");
  const prefix = `org_${runId}`;
  const branchCodePrefix = `O${runId}`.slice(0, 12).toUpperCase();
  const createdRoleIds = [];
  const usernames = {
    admin: `${prefix}_admin`,
    managerA: `${prefix}_manager_a`,
    managerB: `${prefix}_manager_b`,
    central: `${prefix}_central`,
  };

  let client;
  let branchAId;
  let branchBId;
  let createdBranchId;
  let ordinaryAgentId;
  let managerCreatedAgentId;
  let managerAId;
  let managerBId;
  let adminToken;
  let managerAToken;
  let managerBToken;
  let centralToken;

  async function ensureRole(roleName) {
    const inserted = await client.query(
      `INSERT INTO role (role_name, description)
       VALUES ($1, $2)
       ON CONFLICT (role_name) DO NOTHING
       RETURNING role_id`,
      [roleName, `${roleName} test role`],
    );
    if (inserted.rows[0]) {
      createdRoleIds.push(inserted.rows[0].role_id);
      return inserted.rows[0].role_id;
    }
    const existing = await client.query(
      `SELECT role_id FROM role WHERE role_name = $1`,
      [roleName],
    );
    return existing.rows[0].role_id;
  }

  async function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await client.query(
      `INSERT INTO user_session (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [userId, tokenHash],
    );
    return token;
  }

  async function createFixtureUser(roleId, username, branchId, label) {
    const userResult = await client.query(
      `INSERT INTO app_user (role_id, username, password_hash, status)
       VALUES ($1, $2, 'test-only-hash', 'ACTIVE')
       RETURNING user_id`,
      [roleId, username],
    );
    const userId = userResult.rows[0].user_id;

    if (branchId) {
      await client.query(
        `INSERT INTO agent (
           agent_id, branch_id, employee_no, nic_passport_no, full_name,
           date_of_birth, gender, phone, address, email, hired_date, status
         ) VALUES (
           $1, $2, $3, $4, $5,
           DATE '1990-01-01', 'OTHER', '+94110000000', 'Test address', $6,
           DATE '2020-01-01', 'ACTIVE'
         )`,
        [
          userId,
          branchId,
          `${branchCodePrefix}-${label}`,
          `${prefix}-${label}-nic`,
          `${label} test manager`,
          `${prefix}-${label}@example.test`,
        ],
      );
    }

    return { userId, token: await createSession(userId) };
  }

  function agentPayload(label, branchId = branchAId) {
    return {
      branchId,
      username: `${prefix}_${label}`,
      password: "Safe-Test-Password-123!",
      employeeNo: `${branchCodePrefix}-${label}`,
      nicPassportNo: `${prefix}-${label}-identity`,
      fullName: `${label} test agent`,
      dateOfBirth: "1992-05-10",
      gender: "OTHER",
      phone: "+94112223344",
      address: "Synthetic test address",
      email: `${prefix}-${label}@example.test`,
      hiredDate: "2024-01-15",
    };
  }

  before(async () => {
    client = new pg.Client({ connectionString: ownerConnectionString });
    await client.connect();

    const branches = await client.query(
      `INSERT INTO branch (branch_code, branch_name, address, district, phone)
       VALUES
         ($1, 'Organisation Test Branch A', 'Address A', 'District A', '+94110000001'),
         ($2, 'Organisation Test Branch B', 'Address B', 'District B', '+94110000002')
       RETURNING branch_id, branch_code`,
      [`${branchCodePrefix}A`, `${branchCodePrefix}B`],
    );
    branchAId = branches.rows.find((row) => row.branch_code.endsWith("A")).branch_id;
    branchBId = branches.rows.find((row) => row.branch_code.endsWith("B")).branch_id;

    const adminRoleId = await ensureRole("ADMIN");
    const managerRoleId = await ensureRole("BRANCH_MANAGER");
    const centralRoleId = await ensureRole("CENTRAL_OPS");
    await ensureRole("AGENT");

    const admin = await createFixtureUser(adminRoleId, usernames.admin, null, "ADMIN");
    const managerA = await createFixtureUser(
      managerRoleId,
      usernames.managerA,
      branchAId,
      "MGR-A",
    );
    const managerB = await createFixtureUser(
      managerRoleId,
      usernames.managerB,
      branchBId,
      "MGR-B",
    );
    const central = await createFixtureUser(
      centralRoleId,
      usernames.central,
      null,
      "CENTRAL",
    );

    managerAId = managerA.userId;
    managerBId = managerB.userId;
    adminToken = admin.token;
    managerAToken = managerA.token;
    managerBToken = managerB.token;
    centralToken = central.token;
  });

  after(async () => {
    if (!client) return;
    try {
      const users = await client.query(
        `SELECT user_id FROM app_user WHERE username LIKE $1`,
        [`${prefix}%`],
      );
      const userIds = users.rows.map((row) => row.user_id);
      if (userIds.length > 0) {
        await client.query(`DELETE FROM user_session WHERE user_id = ANY($1::uuid[])`, [userIds]);
        await client.query(`DELETE FROM agent WHERE agent_id = ANY($1::uuid[])`, [userIds]);
        await client.query(`DELETE FROM app_user WHERE user_id = ANY($1::uuid[])`, [userIds]);
      }
      await client.query(`DELETE FROM branch WHERE branch_code LIKE $1`, [`${branchCodePrefix}%`]);
      if (createdRoleIds.length > 0) {
        await client.query(`DELETE FROM role WHERE role_id = ANY($1::uuid[])`, [createdRoleIds]);
      }
    } finally {
      await client.end();
    }
  });

  test("unauthenticated branch listing returns 401", async () => {
    const response = await branchCollectionRoute.GET(
      mockRequest("GET", "/api/branches"),
    );
    assert.equal(response.status, 401);
  });

  test("ADMIN creates a branch", async () => {
    const csrf = csrfToken();
    const response = await branchCollectionRoute.POST(
      mockRequest("POST", "/api/branches", {
        token: adminToken,
        csrfToken: csrf,
        body: {
          branchCode: `${branchCodePrefix}C`,
          branchName: "Organisation Test Branch C",
          address: "Address C",
          district: "District C",
          phone: "+94110000003",
        },
      }),
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    createdBranchId = body.data.branchId;
    assert.equal(body.data.branchCode, `${branchCodePrefix}C`);
  });

  test("duplicate branch code returns 409", async () => {
    const csrf = csrfToken();
    const response = await branchCollectionRoute.POST(
      mockRequest("POST", "/api/branches", {
        token: adminToken,
        csrfToken: csrf,
        body: {
          branchCode: `${branchCodePrefix}C`,
          branchName: "Duplicate branch",
          address: "Address",
          district: "District",
          phone: "+94110000004",
        },
      }),
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "DUPLICATE_BRANCH_CODE");
  });

  test("BRANCH_MANAGER cannot create a branch", async () => {
    const csrf = csrfToken();
    const response = await branchCollectionRoute.POST(
      mockRequest("POST", "/api/branches", {
        token: managerAToken,
        csrfToken: csrf,
        body: {
          branchCode: `${branchCodePrefix}X`,
          branchName: "Forbidden branch",
          address: "Address",
          district: "District",
          phone: "+94110000005",
        },
      }),
    );
    assert.equal(response.status, 403);
  });

  test("BRANCH_MANAGER branch listing is restricted in SQL", async () => {
    const response = await branchCollectionRoute.GET(
      mockRequest("GET", "/api/branches", { token: managerAToken }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map((branch) => branch.branchId), [branchAId]);
  });

  test("ADMIN deactivates an unreferenced branch without deleting it", async () => {
    const csrf = csrfToken();
    const response = await branchItemRoute.PATCH(
      mockRequest("PATCH", `/api/branches/${createdBranchId}`, {
        token: adminToken,
        csrfToken: csrf,
        body: { status: "INACTIVE" },
      }),
      { params: Promise.resolve({ id: createdBranchId }) },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "INACTIVE");

    const stored = await client.query(
      `SELECT status FROM branch WHERE branch_id = $1`,
      [createdBranchId],
    );
    assert.equal(stored.rows[0].status, "INACTIVE");
  });

  test("branch with active staff cannot be deactivated", async () => {
    const csrf = csrfToken();
    const response = await branchItemRoute.PATCH(
      mockRequest("PATCH", `/api/branches/${branchAId}`, {
        token: adminToken,
        csrfToken: csrf,
        body: { status: "INACTIVE" },
      }),
      { params: Promise.resolve({ id: branchAId }) },
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "BRANCH_HAS_ACTIVE_AGENTS");
  });

  test("ADMIN creates an ordinary AGENT atomically", async () => {
    const csrf = csrfToken();
    const response = await agentCollectionRoute.POST(
      mockRequest("POST", "/api/agents", {
        token: adminToken,
        csrfToken: csrf,
        body: agentPayload("ordinary"),
      }),
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    ordinaryAgentId = body.data.agentId;
    assert.equal(body.data.roleName, "AGENT");
    assert.equal(body.data.branchId, branchAId);
    assert.equal("password" in body.data, false);
    assert.equal("passwordHash" in body.data, false);
  });

  test("agent lists exclude branch managers and enforce manager branch scope", async () => {
    const response = await agentCollectionRoute.GET(
      mockRequest("GET", "/api/agents", { token: managerAToken }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.data.some((agent) => agent.agentId === ordinaryAgentId));
    assert.ok(body.data.every((agent) => agent.branchId === branchAId));
    assert.ok(body.data.every((agent) => agent.roleName === "AGENT"));
    assert.ok(body.data.every((agent) => agent.agentId !== managerAId));
    assert.ok(body.data.every((agent) => agent.agentId !== managerBId));
  });

  test("CENTRAL_OPS can list ordinary agents bank-wide", async () => {
    const response = await agentCollectionRoute.GET(
      mockRequest("GET", "/api/agents", { token: centralToken }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.data.some((agent) => agent.agentId === ordinaryAgentId));
  });

  test("BRANCH_MANAGER creates an ordinary agent only in their own branch", async () => {
    const csrf = csrfToken();
    const payload = agentPayload("manager-created");
    delete payload.branchId;
    const response = await agentCollectionRoute.POST(
      mockRequest("POST", "/api/agents", {
        token: managerAToken,
        csrfToken: csrf,
        body: payload,
      }),
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    managerCreatedAgentId = body.data.agentId;
    assert.equal(body.data.branchId, branchAId);
    assert.equal(body.data.roleName, "AGENT");
  });

  test("ADMIN transfers an ordinary agent to another active branch", async () => {
    const csrf = csrfToken();
    const response = await agentItemRoute.PATCH(
      mockRequest("PATCH", `/api/agents/${managerCreatedAgentId}`, {
        token: adminToken,
        csrfToken: csrf,
        body: { branchId: branchBId },
      }),
      { params: Promise.resolve({ id: managerCreatedAgentId }) },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.branchId, branchBId);
  });

  test("BRANCH_MANAGER cannot create an agent in another branch", async () => {
    const csrf = csrfToken();
    const response = await agentCollectionRoute.POST(
      mockRequest("POST", "/api/agents", {
        token: managerAToken,
        csrfToken: csrf,
        body: agentPayload("cross-create", branchBId),
      }),
    );
    assert.equal(response.status, 403);
  });

  test("request cannot choose the created user's role", async () => {
    const csrf = csrfToken();
    const response = await agentCollectionRoute.POST(
      mockRequest("POST", "/api/agents", {
        token: adminToken,
        csrfToken: csrf,
        body: { ...agentPayload("role-injection"), roleName: "ADMIN" },
      }),
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "VALIDATION_FAILED");
  });

  test("duplicate employee number rolls back the app_user insert", async () => {
    const csrf = csrfToken();
    const duplicate = agentPayload("duplicate-employee");
    duplicate.employeeNo = `${branchCodePrefix}-ordinary`;
    const response = await agentCollectionRoute.POST(
      mockRequest("POST", "/api/agents", {
        token: adminToken,
        csrfToken: csrf,
        body: duplicate,
      }),
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "DUPLICATE_EMPLOYEE_NO");

    const orphan = await client.query(
      `SELECT user_id FROM app_user WHERE username = $1`,
      [duplicate.username],
    );
    assert.equal(orphan.rowCount, 0);
  });

  test("duplicate identity and email return their specific 409 codes", async () => {
    const identityCsrf = csrfToken();
    const duplicateIdentity = agentPayload("dup-nic");
    duplicateIdentity.nicPassportNo = `${prefix}-ordinary-identity`;
    const identityResponse = await agentCollectionRoute.POST(
      mockRequest("POST", "/api/agents", {
        token: adminToken,
        csrfToken: identityCsrf,
        body: duplicateIdentity,
      }),
    );
    assert.equal(identityResponse.status, 409);
    assert.equal((await identityResponse.json()).error.code, "DUPLICATE_IDENTITY");

    const emailCsrf = csrfToken();
    const duplicateEmail = agentPayload("dup-email");
    duplicateEmail.email = `${prefix}-ordinary@example.test`;
    const emailResponse = await agentCollectionRoute.POST(
      mockRequest("POST", "/api/agents", {
        token: adminToken,
        csrfToken: emailCsrf,
        body: duplicateEmail,
      }),
    );
    assert.equal(emailResponse.status, 409);
    assert.equal((await emailResponse.json()).error.code, "DUPLICATE_EMAIL");
  });

  test("BRANCH_MANAGER cannot update an agent in another branch", async () => {
    const csrf = csrfToken();
    const response = await agentItemRoute.PATCH(
      mockRequest("PATCH", `/api/agents/${ordinaryAgentId}`, {
        token: managerBToken,
        csrfToken: csrf,
        body: { phone: "+94119999999" },
      }),
      { params: Promise.resolve({ id: ordinaryAgentId }) },
    );
    assert.equal(response.status, 403);
  });

  test("agent deactivation also disables the login but does not delete either row", async () => {
    const csrf = csrfToken();
    const response = await agentItemRoute.PATCH(
      mockRequest("PATCH", `/api/agents/${ordinaryAgentId}`, {
        token: managerAToken,
        csrfToken: csrf,
        body: { status: "INACTIVE" },
      }),
      { params: Promise.resolve({ id: ordinaryAgentId }) },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "INACTIVE");

    const stored = await client.query(
      `SELECT a.status AS agent_status, u.status AS user_status
         FROM agent a
         JOIN app_user u ON u.user_id = a.agent_id
        WHERE a.agent_id = $1`,
      [ordinaryAgentId],
    );
    assert.equal(stored.rowCount, 1);
    assert.equal(stored.rows[0].agent_status, "INACTIVE");
    assert.equal(stored.rows[0].user_status, "INACTIVE");
  });

  test("active-only listing hides a deactivated agent while the unfiltered list retains it", async () => {
    const activeResponse = await agentCollectionRoute.GET(
      mockRequest("GET", "/api/agents?status=ACTIVE", { token: adminToken }),
    );
    const allResponse = await agentCollectionRoute.GET(
      mockRequest("GET", "/api/agents", { token: adminToken }),
    );
    assert.equal(activeResponse.status, 200);
    assert.equal(allResponse.status, 200);
    const active = (await activeResponse.json()).data;
    const all = (await allResponse.json()).data;
    assert.ok(active.every((agent) => agent.agentId !== ordinaryAgentId));
    assert.ok(all.some((agent) => agent.agentId === ordinaryAgentId));
  });

  test("state-changing routes require a CSRF token", async () => {
    const response = await agentItemRoute.PATCH(
      mockRequest("PATCH", `/api/agents/${ordinaryAgentId}`, {
        token: adminToken,
        body: { phone: "+94118888888" },
      }),
      { params: Promise.resolve({ id: ordinaryAgentId }) },
    );
    assert.equal(response.status, 403);
  });

  test("malformed resource IDs return 400 without reaching PostgreSQL", async () => {
    const csrf = csrfToken();
    const response = await agentItemRoute.PATCH(
      mockRequest("PATCH", "/api/agents/not-a-uuid", {
        token: adminToken,
        csrfToken: csrf,
        body: { phone: "+94117777777" },
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "VALIDATION_FAILED");
  });

  test("no branch or agent DELETE handler exists", () => {
    assert.equal(branchItemRoute.DELETE, undefined);
    assert.equal(agentItemRoute.DELETE, undefined);
  });

  test("the database restricts deleting an app_user referenced by an agent profile", async () => {
    await assert.rejects(
      () => client.query(`DELETE FROM app_user WHERE user_id = $1`, [ordinaryAgentId]),
      (error) => {
        assert.ok(
          error.code === "23001" || error.code === "23503",
          `Expected a restrict/FK violation, received ${error.code}`,
        );
        return true;
      },
    );
  });
});
