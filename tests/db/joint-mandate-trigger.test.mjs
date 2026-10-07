import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
    try {
        process.loadEnvFile();
    } catch {
        // ignore if loaded by runner
    }
}

const connectionString =
    process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

const ACC_PREFIX = "TEST-ACC-T03-";
const CUS_PREFIX = "TEST-MND-";

describe("P02-M03-T03: joint_mandate and holder validation trigger", () => {
    let client;
    let planIds;
    let agentId;
    let branchId;

    const cleanup = async () => {
        const scope = `SELECT account_id FROM account WHERE account_number LIKE $1`;
        await client.query(`DELETE FROM joint_mandate WHERE account_id IN (${scope})`, [`${ACC_PREFIX}%`]);
        await client.query(`DELETE FROM account_holder WHERE account_id IN (${scope})`, [`${ACC_PREFIX}%`]);
        await client.query("DELETE FROM account WHERE account_number LIKE $1", [`${ACC_PREFIX}%`]);
        await client.query("DELETE FROM customer WHERE customer_number LIKE $1", [`${CUS_PREFIX}%`]);
    };

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        const plans = await client.query("SELECT plan_id, plan_name FROM savings_plan");
        planIds = Object.fromEntries(plans.rows.map((p) => [p.plan_name, p.plan_id]));
        for (const name of ["Adult", "Joint"]) {
            assert.ok(planIds[name], `seeded '${name}' savings plan is required`);
        }
        const agent = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1",
        );
        assert.ok(agent.rows[0], "a seeded active agent is required");
        agentId = agent.rows[0].agent_id;
        branchId = agent.rows[0].branch_id;
    });

    beforeEach(cleanup);

    after(async () => {
        await cleanup();
        await client.end();
    });

    let accountSeq = 0;
    const makeAccount = async (planName) =>
        (
            await client.query(
                `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
                 VALUES ($1, $2, $3, $4) RETURNING account_id`,
                [planIds[planName], branchId, agentId, `${ACC_PREFIX}${String(++accountSeq).padStart(5, "0")}`],
            )
        ).rows[0].account_id;

    // dobExpr is a trusted literal SQL date expression from this file, never user input.
    let customerSeq = 0;
    const makeCustomer = async (dobExpr = "DATE '1990-01-01'") => {
        const n = ++customerSeq;
        return (
            await client.query(
                `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
                 VALUES ($1, $2, $3, 'Test Mandate Holder', ${dobExpr}, $4) RETURNING customer_id`,
                [branchId, `${CUS_PREFIX}${n}`, `${CUS_PREFIX}NIC-${n}`, `${CUS_PREFIX}${n}@example.test`],
            )
        ).rows[0].customer_id;
    };

    // One multi-row INSERT: the trigger sees the whole holder set in one statement.
    const holderInsert = (accountId, holders) => {
        const params = [accountId];
        const rows = holders.map(([customerId, type]) => {
            params.push(customerId, type);
            return `($1, $${params.length - 1}, $${params.length})`;
        });
        return [
            `INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ${rows.join(", ")}`,
            params,
        ];
    };

    const addHolders = (accountId, holders) => client.query(...holderInsert(accountId, holders));

    const customers = (n, dobExpr) => Promise.all(Array.from({ length: n }, () => makeCustomer(dobExpr)));

    const jointAccountWith = async (n) => {
        const accountId = await makeAccount("Joint");
        const ids = await customers(n);
        await addHolders(accountId, ids.map((id, i) => [id, i === 0 ? "PRIMARY" : "JOINT"]));
        return accountId;
    };

    // Every trigger error carries a stable message prefix and a named constraint for the service layer.
    const CONSTRAINT_BY_PREFIX = {
        INVALID_HOLDER_COUNT: "ck_account_holder_count",
        MISSING_PRIMARY_HOLDER: "ck_account_holder_one_primary",
        UNDERAGE_HOLDER: "ck_account_holder_adult",
        MANDATE_NOT_ALLOWED: "ck_joint_mandate_multi_holder_plan",
        INVALID_MANDATE_SIGNATORIES: "ck_joint_mandate_signatories_fit",
    };

    const expectError = async (sql, params, code, messagePrefix, runner = client) => {
        await runner.query("BEGIN");
        try {
            await runner.query(sql, params);
        } catch (err) {
            assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
            if (messagePrefix) {
                assert.ok(err.message.startsWith(messagePrefix), `unexpected message: ${err.message}`);
                assert.equal(err.constraint, CONSTRAINT_BY_PREFIX[messagePrefix]);
            }
            return err;
        } finally {
            await runner.query("ROLLBACK");
        }
        assert.fail(`statement should have failed with ${code}`);
    };

    const expectHolderError = (accountId, holders, messagePrefix) =>
        expectError(...holderInsert(accountId, holders).slice(0, 2), "P0001", messagePrefix);

    const insertMandate = (accountId, type, signatories, extra = "") =>
        [
            `INSERT INTO joint_mandate (account_id, mandate_type, required_signatories${extra ? ", effective_from, effective_to" : ""})
             VALUES ($1, $2, $3${extra ? ", $4, $5" : ""}) RETURNING mandate_id`,
            extra ? [accountId, type, signatories, ...extra] : [accountId, type, signatories],
        ];

    // ---------------------------------------------------------------- holder trigger: accept

    test("1. A single PRIMARY holder on an individual (Adult) plan is accepted", async () => {
        const accountId = await makeAccount("Adult");
        const [cus] = await customers(1);
        const res = await addHolders(accountId, [[cus, "PRIMARY"]]);
        assert.equal(res.rowCount, 1);
    });

    test("2. Two and four holders inserted together on the Joint plan are accepted", async () => {
        for (const n of [2, 4]) {
            const accountId = await makeAccount("Joint");
            const ids = await customers(n);
            const res = await addHolders(accountId, ids.map((id, i) => [id, i === 0 ? "PRIMARY" : "JOINT"]));
            assert.equal(res.rowCount, n);
        }
    });

    test("3. A holder who turns exactly 18 today counts as an adult", async () => {
        const accountId = await makeAccount("Adult");
        const [cus] = await customers(1, "(CURRENT_DATE - INTERVAL '18 years')::date");
        await addHolders(accountId, [[cus, "PRIMARY"]]);
    });

    // ---------------------------------------------------------------- holder trigger: reject

    test("4. One holder on the Joint plan is rejected (INVALID_HOLDER_COUNT)", async () => {
        const accountId = await makeAccount("Joint");
        const [cus] = await customers(1);
        await expectHolderError(accountId, [[cus, "PRIMARY"]], "INVALID_HOLDER_COUNT");
    });

    test("5. Five holders on the Joint plan are rejected (INVALID_HOLDER_COUNT)", async () => {
        const accountId = await makeAccount("Joint");
        const ids = await customers(5);
        await expectHolderError(
            accountId,
            ids.map((id, i) => [id, i === 0 ? "PRIMARY" : "JOINT"]),
            "INVALID_HOLDER_COUNT",
        );
    });

    test("6. Two holders on a single-holder plan are rejected (limits come from the plan row)", async () => {
        const accountId = await makeAccount("Adult");
        const ids = await customers(2);
        await expectHolderError(accountId, [[ids[0], "PRIMARY"], [ids[1], "JOINT"]], "INVALID_HOLDER_COUNT");
    });

    test("7. Adding a fifth holder to a full joint account in a later statement is rejected", async () => {
        const accountId = await jointAccountWith(4);
        const [extra] = await customers(1);
        await expectHolderError(accountId, [[extra, "JOINT"]], "INVALID_HOLDER_COUNT");
    });

    test("8. A joint account without a PRIMARY holder is rejected (MISSING_PRIMARY_HOLDER)", async () => {
        const accountId = await makeAccount("Joint");
        const ids = await customers(2);
        await expectHolderError(accountId, [[ids[0], "JOINT"], [ids[1], "JOINT"]], "MISSING_PRIMARY_HOLDER");
    });

    test("9. An under-18 holder on the Joint plan is rejected (UNDERAGE_HOLDER)", async () => {
        const accountId = await makeAccount("Joint");
        const [adult] = await customers(1);
        const [minor] = await customers(1, "(CURRENT_DATE - INTERVAL '10 years')::date");
        await expectHolderError(accountId, [[adult, "PRIMARY"], [minor, "JOINT"]], "UNDERAGE_HOLDER");
    });

    test("10. An under-18 holder on the Adult plan is rejected too (rule is data-driven, not Joint-only)", async () => {
        const accountId = await makeAccount("Adult");
        const [minor] = await customers(1, "(CURRENT_DATE - INTERVAL '10 years')::date");
        await expectHolderError(accountId, [[minor, "PRIMARY"]], "UNDERAGE_HOLDER");
    });

    test("11. A holder one day short of 18 is rejected", async () => {
        const accountId = await makeAccount("Adult");
        const [almost] = await customers(1, "(CURRENT_DATE - INTERVAL '18 years' + INTERVAL '1 day')::date");
        await expectHolderError(accountId, [[almost, "PRIMARY"]], "UNDERAGE_HOLDER");
    });

    test("12. A minor is accepted on a plan that does not require adults (Children)", async () => {
        const childPlan = await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Children'");
        assert.ok(childPlan.rows[0], "seeded 'Children' plan is required");
        const accountId = (
            await client.query(
                `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
                 VALUES ($1, $2, $3, $4) RETURNING account_id`,
                [childPlan.rows[0].plan_id, branchId, agentId, `${ACC_PREFIX}CHILD`],
            )
        ).rows[0].account_id;
        const [minor] = await customers(1, "(CURRENT_DATE - INTERVAL '8 years')::date");
        await addHolders(accountId, [[minor, "PRIMARY"]]);
    });

    // ---------------------------------------------------------------- mandate: accept

    test("13. ANY_ONE (1 signatory) and ALL_HOLDERS (= holder count) mandates are accepted", async () => {
        const anyOne = await jointAccountWith(2);
        const r1 = await client.query(...insertMandate(anyOne, "ANY_ONE", 1));
        assert.ok(r1.rows[0].mandate_id);

        const allHolders = await jointAccountWith(3);
        const r2 = await client.query(...insertMandate(allHolders, "ALL_HOLDERS", 3));
        assert.ok(r2.rows[0].mandate_id);
    });

    test("14. Mandate defaults: required_signatories 1, effective_from today, open-ended", async () => {
        const accountId = await jointAccountWith(2);
        const row = (
            await client.query(
                `INSERT INTO joint_mandate (account_id, mandate_type) VALUES ($1, 'ANY_ONE')
                 RETURNING required_signatories, effective_from, effective_to, created_at, updated_at`,
                [accountId],
            )
        ).rows[0];
        assert.equal(row.required_signatories, 1);
        assert.ok(row.effective_from instanceof Date);
        assert.equal(row.effective_to, null);
        assert.ok(row.created_at && row.updated_at);
    });

    // ---------------------------------------------------------------- mandate: reject

    test("15. A second mandate for the same account is rejected (23505)", async () => {
        const accountId = await jointAccountWith(2);
        await client.query(...insertMandate(accountId, "ANY_ONE", 1));
        const err = await expectError(...insertMandate(accountId, "ALL_HOLDERS", 2), "23505");
        assert.equal(err.constraint, "uq_joint_mandate_account");
    });

    test("16. An unknown mandate_type is rejected (23514)", async () => {
        const accountId = await jointAccountWith(2);
        const err = await expectError(...insertMandate(accountId, "MAJORITY", 1), "23514");
        assert.equal(err.constraint, "ck_joint_mandate_type");
    });

    test("17. ANY_ONE with more than one signatory is rejected (23514)", async () => {
        const accountId = await jointAccountWith(3);
        const err = await expectError(...insertMandate(accountId, "ANY_ONE", 2), "23514");
        assert.equal(err.constraint, "ck_joint_mandate_any_one_single");
    });

    test("18. Signatories outside 1 to 4 are rejected (23514)", async () => {
        const accountId = await jointAccountWith(2);
        for (const n of [0, 5]) {
            const err = await expectError(...insertMandate(accountId, "ALL_HOLDERS", n), "23514");
            assert.equal(err.constraint, "ck_joint_mandate_signatories_range");
        }
    });

    test("19. ALL_HOLDERS must equal the holder count (INVALID_MANDATE_SIGNATORIES)", async () => {
        const accountId = await jointAccountWith(3);
        await expectError(...insertMandate(accountId, "ALL_HOLDERS", 2), "P0001", "INVALID_MANDATE_SIGNATORIES");
    });

    test("20. More signatories than holders is rejected (INVALID_MANDATE_SIGNATORIES)", async () => {
        const accountId = await jointAccountWith(2);
        await expectError(...insertMandate(accountId, "ALL_HOLDERS", 4), "P0001", "INVALID_MANDATE_SIGNATORIES");
    });

    test("21. A mandate on a single-holder plan account is rejected (MANDATE_NOT_ALLOWED)", async () => {
        const accountId = await makeAccount("Adult");
        const [cus] = await customers(1);
        await addHolders(accountId, [[cus, "PRIMARY"]]);
        await expectError(...insertMandate(accountId, "ANY_ONE", 1), "P0001", "MANDATE_NOT_ALLOWED");
    });

    test("22. effective_to before effective_from is rejected (23514)", async () => {
        const accountId = await jointAccountWith(2);
        const err = await expectError(
            ...insertMandate(accountId, "ANY_ONE", 1, ["2026-10-10", "2026-10-01"]),
            "23514",
        );
        assert.equal(err.constraint, "ck_joint_mandate_effective_range");
    });

    test("23. A mandate for a non-existent account is rejected (23503)", async () => {
        const err = await expectError(
            ...insertMandate("00000000-0000-0000-0000-00000000dead", "ANY_ONE", 1),
            "23503",
        );
        assert.equal(err.constraint, "fk_joint_mandate_account");
    });

    test("24. A mandate update that breaks the fit is rejected", async () => {
        const accountId = await jointAccountWith(3);
        await client.query(...insertMandate(accountId, "ALL_HOLDERS", 3));
        await expectError(
            "UPDATE joint_mandate SET required_signatories = 2 WHERE account_id = $1",
            [accountId],
            "P0001",
            "INVALID_MANDATE_SIGNATORIES",
        );
    });

    test("25. A mandated account cannot be deleted (RESTRICT)", async () => {
        const accountId = await jointAccountWith(2);
        await client.query(...insertMandate(accountId, "ANY_ONE", 1));
        await client.query("BEGIN");
        try {
            await client.query("DELETE FROM account WHERE account_id = $1", [accountId]);
            assert.fail("delete should have been rejected");
        } catch (err) {
            assert.ok(["23001", "23503"].includes(err.code), `unexpected ${err.code}`);
        } finally {
            await client.query("ROLLBACK");
        }
    });

    // ---------------------------------------------------------------- UPDATE paths

    test("26. Swapping a holder for a minor via UPDATE is rejected (UNDERAGE_HOLDER)", async () => {
        const accountId = await jointAccountWith(2);
        const [minor] = await customers(1, "(CURRENT_DATE - INTERVAL '10 years')::date");
        await expectError(
            `UPDATE account_holder SET customer_id = $2
              WHERE account_id = $1 AND holder_type = 'JOINT'`,
            [accountId, minor],
            "P0001",
            "UNDERAGE_HOLDER",
        );
    });

    test("27. Demoting the only PRIMARY via UPDATE is rejected (MISSING_PRIMARY_HOLDER)", async () => {
        const accountId = await jointAccountWith(2);
        await expectError(
            "UPDATE account_holder SET holder_type = 'JOINT' WHERE account_id = $1 AND holder_type = 'PRIMARY'",
            [accountId],
            "P0001",
            "MISSING_PRIMARY_HOLDER",
        );
    });

    test("28. Moving a holder off a two-holder joint account via UPDATE is rejected", async () => {
        const accountId = await jointAccountWith(2);
        const other = await makeAccount("Joint");
        await expectError(
            "UPDATE account_holder SET account_id = $2 WHERE account_id = $1 AND holder_type = 'JOINT'",
            [accountId, other],
            "P0001",
            "INVALID_HOLDER_COUNT",
        );
    });

    // ---------------------------------------------------------------- mandate stays in step

    test("29. Adding a holder moves an ALL_HOLDERS mandate to the new count; ANY_ONE stays 1", async () => {
        const all = await jointAccountWith(2);
        await client.query(...insertMandate(all, "ALL_HOLDERS", 2));
        const any = await jointAccountWith(2);
        await client.query(...insertMandate(any, "ANY_ONE", 1));
        for (const accountId of [all, any]) {
            const [extra] = await customers(1);
            await addHolders(accountId, [[extra, "JOINT"]]);
        }
        const rows = await client.query(
            "SELECT account_id, required_signatories FROM joint_mandate WHERE account_id = ANY($1)",
            [[all, any]],
        );
        const bySignatories = Object.fromEntries(rows.rows.map((r) => [r.account_id, r.required_signatories]));
        assert.equal(bySignatories[all], 3);
        assert.equal(bySignatories[any], 1);
    });

    // ---------------------------------------------------------------- concurrency

    test("30. Concurrent holder inserts are serialised: the fifth holder cannot slip in", async () => {
        const accountId = await jointAccountWith(3);
        const [h4, h5] = await customers(2);
        const a = new pg.Client({ connectionString });
        const b = new pg.Client({ connectionString });
        await a.connect();
        await b.connect();
        try {
            await a.query("BEGIN");
            await a.query(...holderInsert(accountId, [[h4, "JOINT"]]));

            await b.query("BEGIN");
            let settled = false;
            const bAttempt = b
                .query(...holderInsert(accountId, [[h5, "JOINT"]]))
                .then(() => ({ ok: true }), (error) => ({ ok: false, error }))
                .finally(() => {
                    settled = true;
                });

            await new Promise((resolve) => setTimeout(resolve, 400));
            assert.equal(settled, false, "second insert must wait for the first transaction's lock");

            await a.query("COMMIT");
            const outcome = await bAttempt;
            assert.equal(outcome.ok, false, "fifth holder must be rejected once the fourth is committed");
            assert.equal(outcome.error.code, "P0001");
            assert.ok(outcome.error.message.startsWith("INVALID_HOLDER_COUNT"));
            await b.query("ROLLBACK");

            const count = await client.query("SELECT count(*)::int AS n FROM account_holder WHERE account_id = $1", [accountId]);
            assert.equal(count.rows[0].n, 4);
        } finally {
            await a.end();
            await b.end();
        }
    });

    // ---------------------------------------------------------------- application role

    test("31. As mims_app under branch scope, a minor in another branch is still rejected (definer sees all rows)", async () => {
        const otherBranch = await client.query("SELECT branch_id FROM branch WHERE branch_id <> $1 LIMIT 1", [branchId]);
        assert.ok(otherBranch.rows[0], "a second seeded branch is required");
        const accountId = await makeAccount("Joint");
        const [adult] = await customers(1);
        const minor = (
            await client.query(
                `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
                 VALUES ($1, $2, $3, 'Test Hidden Minor', (CURRENT_DATE - INTERVAL '10 years')::date, $4)
                 RETURNING customer_id`,
                [otherBranch.rows[0].branch_id, `${CUS_PREFIX}HIDDEN`, `${CUS_PREFIX}NIC-HIDDEN`, `${CUS_PREFIX}HIDDEN@example.test`],
            )
        ).rows[0].customer_id;

        const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
        await app.connect();
        try {
            await app.query("BEGIN");
            await app.query(
                `SELECT set_config('app.current_user_id', '', true),
                        set_config('app.current_branch_id', $1, true),
                        set_config('app.current_user_role', 'AGENT', true)`,
                [branchId],
            );
            const visible = await app.query("SELECT 1 FROM customer WHERE customer_id = $1", [minor]);
            assert.equal(visible.rowCount, 0, "precondition: row-level security hides the other branch's customer");
            await app.query("ROLLBACK");

            await expectError(
                ...holderInsert(accountId, [[adult, "PRIMARY"], [minor, "JOINT"]]).slice(0, 2),
                "P0001",
                "UNDERAGE_HOLDER",
                {
                    query: async (sql, params) => {
                        if (sql === "BEGIN") {
                            await app.query("BEGIN");
                            return app.query(
                                `SELECT set_config('app.current_user_id', '', true),
                                        set_config('app.current_branch_id', $1, true),
                                        set_config('app.current_user_role', 'AGENT', true)`,
                                [branchId],
                            );
                        }
                        return app.query(sql, params);
                    },
                },
            );
        } finally {
            await app.end();
        }
    });

    test("32. The application role cannot delete mandates or call the definer functions", async () => {
        const privileges = await client.query(
            `SELECT has_table_privilege('mims_app', 'joint_mandate', 'SELECT') AS sel,
                    has_table_privilege('mims_app', 'joint_mandate', 'INSERT') AS ins,
                    has_table_privilege('mims_app', 'joint_mandate', 'UPDATE') AS upd,
                    has_table_privilege('mims_app', 'joint_mandate', 'DELETE') AS del,
                    has_function_privilege('mims_app', 'fn_check_account_holder_sets(uuid[])', 'EXECUTE') AS run_check,
                    has_function_privilege('mims_app', 'fn_validate_joint_mandate_fit()', 'EXECUTE') AS run_fit`,
        );
        assert.deepEqual(privileges.rows[0], {
            sel: true, ins: true, upd: true, del: false, run_check: false, run_fit: false,
        });

        const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
        await app.connect();
        try {
            await assert.rejects(app.query("DELETE FROM joint_mandate"), { code: "42501" });
            await assert.rejects(
                app.query("SELECT fn_check_account_holder_sets(ARRAY[]::uuid[])"),
                { code: "42501" },
            );
        } finally {
            await app.end();
        }
    });
});
