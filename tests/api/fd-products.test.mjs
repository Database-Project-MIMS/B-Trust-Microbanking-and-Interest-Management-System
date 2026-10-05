import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { GET } from "../../app/api/fd-products/route.ts";
import { PATCH } from "../../app/api/fd-products/[id]/route.ts";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
    try { process.loadEnvFile(); } catch { }
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

function createMockRequest(method, url, body, cookies = {}, headers = {}) {
    return {
        method,
        url,
        json: async () => body,
        headers: new Headers(headers),
        cookies: {
            get: (name) => cookies[name] ? { value: cookies[name] } : undefined,
        },
    };
}

describe("P01-M05-T02: FD Products API & Service Tests", () => {
    const runId = crypto.randomBytes(6).toString("hex");
    const usernames = {
        admin: `fd_admin_${runId}`,
        agent: `fd_agent_${runId}`,
        manager: `fd_manager_${runId}`,
    };

    let client;
    let testBranchId;
    let testFdPlan;
    let replacementFdPlanId;
    let adminToken;
    let agentToken;
    let managerToken;
    const createdRoleIds = [];

    async function ensureRole(roleName, description) {
        const inserted = await client.query(
            `INSERT INTO role (role_name, description)
             VALUES ($1, $2)
             ON CONFLICT (role_name) DO NOTHING
             RETURNING role_id`,
            [roleName, description]
        );

        if (inserted.rows.length === 1) {
            createdRoleIds.push(inserted.rows[0].role_id);
            return inserted.rows[0].role_id;
        }

        const existing = await client.query(
            `SELECT role_id FROM role WHERE role_name = $1`,
            [roleName]
        );
        return existing.rows[0].role_id;
    }

    async function setupUser(roleId, username, profileLabel = null) {
        const userResult = await client.query(
            `INSERT INTO app_user (role_id, username, password_hash, status)
             VALUES ($1, $2, 'test-only-hash', 'ACTIVE')
             RETURNING user_id`,
            [roleId, username]
        );
        const userId = userResult.rows[0].user_id;

        if (profileLabel) {
            await client.query(
                `INSERT INTO agent (
                    agent_id, branch_id, employee_no, nic_passport_no, full_name,
                    date_of_birth, gender, phone, address, email, hired_date, status
                 ) VALUES (
                    $1, $2, $3, $4, $5,
                    DATE '1990-01-01', 'OTHER', '+94000000000', 'Test address', $6,
                    CURRENT_DATE, 'ACTIVE'
                 )`,
                [
                    userId,
                    testBranchId,
                    `FD-${profileLabel}-${runId}`,
                    `NIC-${profileLabel}-${runId}`,
                    `FD ${profileLabel} test user`,
                    `fd-${profileLabel.toLowerCase()}-${runId}@example.test`,
                ]
            );
        }

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await client.query(
            `INSERT INTO user_session (user_id, token_hash, expires_at)
             VALUES ($1, $2, now() + interval '1 hour')`,
            [userId, tokenHash]
        );
        return token;
    }

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();

        const fdResult = await client.query(
            `SELECT fd_plan_id, plan_name, tenure_months, interest_rate, description,
                    status, effective_from, effective_to, created_at, updated_at
             FROM fd_plan
             WHERE status = 'ACTIVE'
             ORDER BY tenure_months
             LIMIT 1`
        );
        assert.equal(fdResult.rows.length, 1, "An active FD plan fixture must exist");
        testFdPlan = fdResult.rows[0];

        const branchResult = await client.query(
            `INSERT INTO branch (
                branch_code, branch_name, address, district, phone, status
             ) VALUES ($1, 'FD API Test Branch', 'Test address', 'Test district', '+94000000000', 'ACTIVE')
             RETURNING branch_id`,
            [`FD-${runId}`]
        );
        testBranchId = branchResult.rows[0].branch_id;

        const adminRoleId = await ensureRole("ADMIN", "Administrator");
        const agentRoleId = await ensureRole("AGENT", "Banking agent");
        const managerRoleId = await ensureRole("BRANCH_MANAGER", "Branch manager");

        adminToken = await setupUser(adminRoleId, usernames.admin);
        agentToken = await setupUser(agentRoleId, usernames.agent, "AGENT");
        managerToken = await setupUser(managerRoleId, usernames.manager, "MANAGER");
    });

    after(async () => {
        if (!client) return;

        try {
            if (testFdPlan) {
                await client.query(
                    `DELETE FROM fd_plan
                     WHERE fd_plan_id <> $1
                       AND plan_name = $2`,
                    [testFdPlan.fd_plan_id, testFdPlan.plan_name]
                );
                await client.query(
                    `UPDATE fd_plan
                     SET plan_name = $1,
                         tenure_months = $2,
                         interest_rate = $3,
                         description = $4,
                         status = $5,
                         effective_from = $6,
                         effective_to = $7,
                         created_at = $8,
                         updated_at = $9
                     WHERE fd_plan_id = $10`,
                    [
                        testFdPlan.plan_name,
                        testFdPlan.tenure_months,
                        testFdPlan.interest_rate,
                        testFdPlan.description,
                        testFdPlan.status,
                        testFdPlan.effective_from,
                        testFdPlan.effective_to,
                        testFdPlan.created_at,
                        testFdPlan.updated_at,
                        testFdPlan.fd_plan_id,
                    ]
                );
            }

            const users = await client.query(
                `SELECT user_id FROM app_user WHERE username = ANY($1)`,
                [Object.values(usernames)]
            );
            const userIds = users.rows.map((row) => row.user_id);
            if (userIds.length > 0) {
                await client.query(`DELETE FROM user_session WHERE user_id = ANY($1)`, [userIds]);
                await client.query(`DELETE FROM agent WHERE agent_id = ANY($1)`, [userIds]);
                await client.query(`DELETE FROM app_user WHERE user_id = ANY($1)`, [userIds]);
            }

            if (testBranchId) {
                await client.query(`DELETE FROM branch WHERE branch_id = $1`, [testBranchId]);
            }
            if (createdRoleIds.length > 0) {
                await client.query(`DELETE FROM role WHERE role_id = ANY($1)`, [createdRoleIds]);
            }
        } finally {
            await client.end();
        }
    });

    test("1. GET /api/fd-products returns products", async () => {
        const request = createMockRequest(
            "GET",
            "http://localhost/api/fd-products",
            null,
            { mims_session: adminToken }
        );
        const response = await GET(request);
        assert.equal(response.status, 200);

        const body = await response.json();
        assert.ok(body.data.length >= 3);
        for (const product of body.data) {
            assert.equal(typeof product.interestRate, "string");
            const rate = Number.parseFloat(product.interestRate);
            assert.ok(rate >= 0 && rate <= 1);
        }
    });

    test("2. Non-authenticated request returns 401", async () => {
        const request = createMockRequest("GET", "http://localhost/api/fd-products", null);
        const response = await GET(request);
        assert.equal(response.status, 401);
    });

    test("3. PATCH by ADMIN updates rate successfully with CSRF", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/fd-products/${testFdPlan.fd_plan_id}`,
            { interestRate: "0.1900" },
            { mims_session: adminToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, {
            params: Promise.resolve({ id: testFdPlan.fd_plan_id }),
        });
        assert.equal(response.status, 200);

        const body = await response.json();
        replacementFdPlanId = body.data.fdPlanId;
        assert.equal(body.data.interestRate, "0.1900");
        assert.notEqual(replacementFdPlanId, testFdPlan.fd_plan_id);
    });

    test("4. PATCH by AGENT returns 403", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const targetId = replacementFdPlanId ?? testFdPlan.fd_plan_id;
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/fd-products/${targetId}`,
            { interestRate: "0.2000" },
            { mims_session: agentToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: targetId }) });
        assert.equal(response.status, 403);
    });

    test("5. PATCH by BRANCH_MANAGER returns 403", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const targetId = replacementFdPlanId ?? testFdPlan.fd_plan_id;
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/fd-products/${targetId}`,
            { interestRate: "0.2000" },
            { mims_session: managerToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: targetId }) });
        assert.equal(response.status, 403);
    });

    test("6. Invalid rate returns 400", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const targetId = replacementFdPlanId ?? testFdPlan.fd_plan_id;
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/fd-products/${targetId}`,
            { interestRate: "1.5000" },
            { mims_session: adminToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: targetId }) });
        assert.equal(response.status, 400);
    });

    test("7. CSRF token missing on PATCH returns 403", async () => {
        const targetId = replacementFdPlanId ?? testFdPlan.fd_plan_id;
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/fd-products/${targetId}`,
            { interestRate: "0.1800" },
            { mims_session: adminToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: targetId }) });
        assert.equal(response.status, 403);
    });
});
