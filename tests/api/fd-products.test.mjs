import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { GET } from "../../app/api/fd-products/route.ts";
import { PATCH } from "../../app/api/fd-products/[id]/route.ts";
import crypto from "node:crypto";

if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
    try { process.loadEnvFile(); } catch { }
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

// Helper to create a fake NextRequest
function createMockRequest(method, url, body, cookies, headers) {
    const hdr = new Headers(headers || {});
    return {
        method,
        url,
        json: async () => body,
        headers: hdr,
        cookies: {
            get: (name) => {
                if (cookies && cookies[name]) return { value: cookies[name] };
                return undefined;
            }
        }
    };
}

describe("P01-M05-T02: FD Products API & Service Tests", () => {
    let client;
    let testFdPlanId;
    let adminToken;
    let agentToken;
    let managerToken;

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();

        // 1. Get a test FD Plan ID
        const fdRes = await client.query(`SELECT fd_plan_id FROM fd_plan WHERE status = 'ACTIVE' ORDER BY tenure_months LIMIT 1`);
        if (fdRes.rows.length > 0) {
            testFdPlanId = fdRes.rows[0].fd_plan_id;
        }

        // 2. Create test roles (no seed data exists yet)
        const adminRole = await client.query(
            `INSERT INTO role (role_name, description)
             VALUES ('ADMIN', 'Test admin role')
             ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
             RETURNING role_id`
        );
        const agentRole = await client.query(
            `INSERT INTO role (role_name, description)
             VALUES ('AGENT', 'Test agent role')
             ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
             RETURNING role_id`
        );
        const managerRole = await client.query(
            `INSERT INTO role (role_name, description)
             VALUES ('BRANCH_MANAGER', 'Test branch manager role')
             ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
             RETURNING role_id`
        );

        const setupUser = async (roleId, username) => {
            const userRes = await client.query(
                `INSERT INTO app_user (role_id, username, password_hash, status) 
                 VALUES ($1, $2, 'dummy', 'ACTIVE') RETURNING user_id`,
                [roleId, username]
            );
            const userId = userRes.rows[0].user_id;
            
            const token = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
            
            await client.query(
                `INSERT INTO user_session (user_id, token_hash, expires_at)
                 VALUES ($1, $2, now() + interval '1 hour')`,
                [userId, tokenHash]
            );
            return token;
        };

        adminToken = await setupUser(adminRole.rows[0].role_id, 'testadmin');
        agentToken = await setupUser(agentRole.rows[0].role_id, 'testagent');
        managerToken = await setupUser(managerRole.rows[0].role_id, 'testmanager');
    });

    after(async () => {
        // Cleanup in FK order: sessions → users → roles
        const userIds = await client.query(
            `SELECT user_id FROM app_user WHERE username IN ('testadmin', 'testagent', 'testmanager')`
        );
        const ids = userIds.rows.map(r => r.user_id);
        if (ids.length > 0) {
            await client.query(`DELETE FROM user_session WHERE user_id = ANY($1)`, [ids]);
            await client.query(`DELETE FROM app_user WHERE user_id = ANY($1)`, [ids]);
        }
        await client.query(`DELETE FROM role WHERE role_name IN ('ADMIN', 'AGENT', 'BRANCH_MANAGER')`);
        await client.end();
    });

    test("1. GET /api/fd-products returns products (including seed data)", async () => {
        const req = createMockRequest("GET", "http://localhost/api/fd-products", null, { mims_session: adminToken });
        const res = await GET(req);
        
        assert.equal(res.status, 200, "Should return 200 OK");
        
        const body = await res.json();
        assert.ok(body.data.length >= 3, "Should return at least 3 active products");
        
        for (const p of body.data) {
            assert.equal(typeof p.interestRate, "string");
            const rate = parseFloat(p.interestRate);
            assert.ok(rate > 0 && rate <= 1, "Rate must be a fraction between 0 and 1");
        }
    });

    test("2. Non-authenticated request returns 401", async () => {
        const req = createMockRequest("GET", "http://localhost/api/fd-products", null, {});
        const res = await GET(req);
        assert.equal(res.status, 401);
    });

    test("3. PATCH by ADMIN updates rate successfully with CSRF", async () => {
        const csrfHex = crypto.randomBytes(32).toString("hex");

        const req = createMockRequest(
            "PATCH", 
            "http://localhost/api/fd-products/" + testFdPlanId, 
            { interestRate: "0.1900" }, 
            { mims_session: adminToken, mims_csrf: csrfHex },
            { "x-csrf-token": csrfHex }
        );
        
        const res = await PATCH(req, { params: { id: testFdPlanId } });
        assert.equal(res.status, 200);
        
        const body = await res.json();
        assert.equal(body.data.interestRate, "0.1900");
    });

    test("4. PATCH by AGENT returns 403", async () => {
        const csrfHex = crypto.randomBytes(32).toString("hex");

        const req = createMockRequest(
            "PATCH", 
            "http://localhost/api/fd-products/" + testFdPlanId, 
            { interestRate: "0.2000" }, 
            { mims_session: agentToken, mims_csrf: csrfHex },
            { "x-csrf-token": csrfHex }
        );
        
        const res = await PATCH(req, { params: { id: testFdPlanId } });
        assert.equal(res.status, 403);
    });

    test("5. PATCH by BRANCH_MANAGER returns 403", async () => {
        const csrfHex = crypto.randomBytes(32).toString("hex");

        const req = createMockRequest(
            "PATCH", 
            "http://localhost/api/fd-products/" + testFdPlanId, 
            { interestRate: "0.2000" }, 
            { mims_session: managerToken, mims_csrf: csrfHex },
            { "x-csrf-token": csrfHex }
        );
        
        const res = await PATCH(req, { params: { id: testFdPlanId } });
        assert.equal(res.status, 403);
    });

    test("6. Invalid rate (> 1 or <= 0) returns 400", async () => {
        const csrfHex = crypto.randomBytes(32).toString("hex");

        const req = createMockRequest(
            "PATCH", 
            "http://localhost/api/fd-products/" + testFdPlanId, 
            { interestRate: "1.5000" }, 
            { mims_session: adminToken, mims_csrf: csrfHex },
            { "x-csrf-token": csrfHex }
        );
        
        const res = await PATCH(req, { params: { id: testFdPlanId } });
        assert.equal(res.status, 400);
    });

    test("7. CSRF token missing on PATCH returns 403", async () => {
        const req = createMockRequest(
            "PATCH", 
            "http://localhost/api/fd-products/" + testFdPlanId, 
            { interestRate: "0.1800" }, 
            { mims_session: adminToken }, // Missing CSRF
            {}
        );
        
        const res = await PATCH(req, { params: { id: testFdPlanId } });
        assert.equal(res.status, 403);
    });
});
