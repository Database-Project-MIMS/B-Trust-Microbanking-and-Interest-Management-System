import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { GET } from "../../app/api/plans/route.ts";
import { PATCH } from "../../app/api/plans/[id]/route.ts";

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

describe("P01-M03-T03: Savings Plan API Tests", () => {
    const runId = crypto.randomBytes(6).toString("hex");
    const usernames = {
        admin: `plan_admin_${runId}`,
        centralOps: `plan_centralops_${runId}`,
        agent: `plan_agent_${runId}`,
    };

    let client;
    let testBranchId;
    let testPlan;
    let adminToken;
    let centralOpsToken;
    let agentToken;
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
                    `PLAN-${profileLabel}-${runId}`,
                    `NIC-${profileLabel}-${runId}`,
                    `Plan ${profileLabel} test user`,
                    `plan-${profileLabel.toLowerCase()}-${runId}@example.test`,
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

        const planResult = await client.query(
            `SELECT plan_id, plan_name, interest_rate, min_balance, description, status,
                    min_age_years, max_age_years, min_holders, max_holders, requires_all_adult
             FROM savings_plan
             WHERE plan_name = 'Teen'`
        );
        assert.equal(planResult.rows.length, 1, "The Teen plan fixture must exist");
        testPlan = planResult.rows[0];

        const branchResult = await client.query(
            `INSERT INTO branch (
                branch_code, branch_name, address, district, phone, status
             ) VALUES ($1, 'Plan API Test Branch', 'Test address', 'Test district', '+94000000000', 'ACTIVE')
             RETURNING branch_id`,
            [`PLAN-${runId}`]
        );
        testBranchId = branchResult.rows[0].branch_id;

        const adminRoleId = await ensureRole("ADMIN", "Administrator");
        const centralOpsRoleId = await ensureRole("CENTRAL_OPS", "Central Operations Staff");
        const agentRoleId = await ensureRole("AGENT", "Banking agent");

        adminToken = await setupUser(adminRoleId, usernames.admin);
        centralOpsToken = await setupUser(centralOpsRoleId, usernames.centralOps);
        agentToken = await setupUser(agentRoleId, usernames.agent, "AGENT");
    });

    after(async () => {
        if (!client) return;

        try {
            if (testPlan) {
                await client.query(
                    `UPDATE savings_plan
                     SET interest_rate = $1,
                         min_balance = $2,
                         description = $3,
                         status = $4,
                         min_age_years = $5,
                         max_age_years = $6,
                         min_holders = $7,
                         max_holders = $8,
                         requires_all_adult = $9
                     WHERE plan_id = $10`,
                    [
                        testPlan.interest_rate,
                        testPlan.min_balance,
                        testPlan.description,
                        testPlan.status,
                        testPlan.min_age_years,
                        testPlan.max_age_years,
                        testPlan.min_holders,
                        testPlan.max_holders,
                        testPlan.requires_all_adult,
                        testPlan.plan_id,
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

    test("1. GET /api/plans returns all 5 plans to any authenticated role", async () => {
        const request = createMockRequest(
            "GET",
            "http://localhost/api/plans",
            null,
            { mims_session: agentToken }
        );
        const response = await GET(request);
        assert.equal(response.status, 200);

        const body = await response.json();
        assert.equal(body.data.length, 5);
        for (const plan of body.data) {
            assert.equal(typeof plan.interestRate, "string");
            const rate = Number.parseFloat(plan.interestRate);
            assert.ok(rate > 0 && rate <= 1);
        }
    });

    test("2. Non-authenticated request returns 401", async () => {
        const request = createMockRequest("GET", "http://localhost/api/plans", null);
        const response = await GET(request);
        assert.equal(response.status, 401);
    });

    test("3. PATCH by ADMIN updates a plan successfully with CSRF", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { description: "Updated by test" },
            { mims_session: adminToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, {
            params: Promise.resolve({ id: testPlan.plan_id }),
        });
        assert.equal(response.status, 200);

        const body = await response.json();
        assert.equal(body.data.description, "Updated by test");
    });

    test("4. PATCH by CENTRAL_OPS also succeeds", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { minBalance: "600.00" },
            { mims_session: centralOpsToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, {
            params: Promise.resolve({ id: testPlan.plan_id }),
        });
        assert.equal(response.status, 200);

        const body = await response.json();
        assert.equal(body.data.minBalance, "600.00");
    });

    test("5. PATCH by AGENT returns 403", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { minBalance: "700.00" },
            { mims_session: agentToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: testPlan.plan_id }) });
        assert.equal(response.status, 403);
    });

    test("6. Interest rate above 1 returns 400", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { interestRate: "1.5000" },
            { mims_session: adminToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: testPlan.plan_id }) });
        assert.equal(response.status, 400);
    });

    test("7. CSRF token missing on PATCH returns 403", async () => {
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { minBalance: "800.00" },
            { mims_session: adminToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: testPlan.plan_id }) });
        assert.equal(response.status, 403);
    });

    test("8. maxAgeYears < minAgeYears in the same request returns 400", async () => {
        const csrfToken = crypto.randomBytes(32).toString("hex");
        const request = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { minAgeYears: 30, maxAgeYears: 20 },
            { mims_session: adminToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );

        const response = await PATCH(request, { params: Promise.resolve({ id: testPlan.plan_id }) });
        assert.equal(response.status, 400);
    });

    test("9. maxHolders below the current minHolders (partial update) returns 409", async () => {
        // Teen's min_holders/max_holders are both 1 by seed data, so lowering
        // maxHolders below 1 is impossible; instead raise minHolders first, then
        // send a maxHolders that conflicts with it, without resending minHolders,
        // to prove the service re-validates against the CURRENT row, not just
        // the payload (this is exactly what the zod .refine() alone cannot catch).
        const csrfToken = crypto.randomBytes(32).toString("hex");

        const raiseMinHolders = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { minHolders: 2, maxHolders: 4 },
            { mims_session: adminToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );
        const raiseResponse = await PATCH(raiseMinHolders, {
            params: Promise.resolve({ id: testPlan.plan_id }),
        });
        assert.equal(raiseResponse.status, 200);

        const conflictingUpdate = createMockRequest(
            "PATCH",
            `http://localhost/api/plans/${testPlan.plan_id}`,
            { maxHolders: 1 },
            { mims_session: adminToken, mims_csrf: csrfToken },
            { "x-csrf-token": csrfToken }
        );
        const conflictResponse = await PATCH(conflictingUpdate, {
            params: Promise.resolve({ id: testPlan.plan_id }),
        });
        assert.equal(conflictResponse.status, 409);
    });
});
