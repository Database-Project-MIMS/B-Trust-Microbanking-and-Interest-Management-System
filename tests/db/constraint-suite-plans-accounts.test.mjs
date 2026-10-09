import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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

const MISSING = "00000000-0000-0000-0000-00000000dead";

// P06-M03-T02: the canonical constraint reference for savings_plan, account, account_holder and
// joint_mandate. Every test runs inside a transaction that is rolled back, so nothing is committed
// and each violation is proved in isolation. The completeness guard at the end fails when a
// constraint is added to one of the four tables without being listed (and therefore tested) here.
describe("P06-M03-T02: constraint suite — savings_plan, account, account_holder, joint_mandate", () => {
    let client;
    let planIds;
    let branchId;
    let agentId;
    const covered = new Set();

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        const plans = await client.query("SELECT plan_id, plan_name FROM savings_plan");
        planIds = Object.fromEntries(plans.rows.map((p) => [p.plan_name, p.plan_id]));
        for (const name of ["Adult", "Joint"]) assert.ok(planIds[name], `seeded '${name}' plan is required`);
        const agent = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1",
        );
        assert.ok(agent.rows[0], "a seeded active agent is required");
        agentId = agent.rows[0].agent_id;
        branchId = agent.rows[0].branch_id;
    });

    beforeEach(() => client.query("BEGIN"));
    afterEach(() => client.query("ROLLBACK"));
    after(async () => {
        await client.end();
    });

    // Runs `sql` inside a savepoint, asserts it fails with the SQLSTATE (and constraint, when given),
    // then rolls back to the savepoint so the test can continue with its fixtures intact.
    const violates = async (sql, params, code, constraint) => {
        await client.query("SAVEPOINT expected_failure");
        try {
            await assert.rejects(client.query(sql, params), (err) => {
                assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
                if (constraint) assert.equal(err.constraint, constraint);
                return true;
            });
        } finally {
            await client.query("ROLLBACK TO SAVEPOINT expected_failure");
            await client.query("RELEASE SAVEPOINT expected_failure");
        }
        if (constraint) covered.add(constraint);
    };

    const tag = () => randomUUID().slice(0, 10);

    const insertPlan = (overrides = {}) => {
        const v = { plan_name: `CS-${tag()}`, interest_rate: "0.1000", min_balance: "0", status: "ACTIVE",
            min_age_years: null, max_age_years: null, min_holders: 1, max_holders: 1, ...overrides };
        return [
            `INSERT INTO savings_plan (plan_name, interest_rate, min_balance, status, min_age_years, max_age_years, min_holders, max_holders)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING plan_id`,
            [v.plan_name, v.interest_rate, v.min_balance, v.status, v.min_age_years, v.max_age_years, v.min_holders, v.max_holders],
        ];
    };

    const accountSql = `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number, current_balance, status)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING account_id`;
    const accountParams = (o = {}) => [o.plan_id ?? planIds.Adult, o.branch_id ?? branchId,
        o.opened_by_agent_id ?? agentId, o.account_number ?? `CS-${tag()}`, o.current_balance ?? "0", o.status ?? "ACTIVE"];
    const makeAccount = async (planName = "Adult", o = {}) =>
        (await client.query(accountSql, accountParams({ plan_id: planIds[planName], ...o }))).rows[0].account_id;

    const makeCustomer = async (dob = "1990-01-01") => {
        const n = tag();
        return (await client.query(
            `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
             VALUES ($1,$2,$3,'Synthetic Constraint Holder',$4,$5) RETURNING customer_id`,
            [branchId, `CS-${n}`, `CS-NIC-${n}`, dob, `cs-${n}@example.invalid`],
        )).rows[0].customer_id;
    };

    // Sequential on purpose: one pg client cannot run queries concurrently.
    const makeCustomers = async (count) => {
        const ids = [];
        for (let i = 0; i < count; i += 1) ids.push(await makeCustomer());
        return ids;
    };

    // One statement for the whole holder set: the holder trigger validates after each statement.
    const holderInsert = (accountId, holders) => {
        const params = [accountId];
        const rows = holders.map(([customerId, type]) => {
            params.push(customerId, type);
            return `($1, $${params.length - 1}, $${params.length})`;
        });
        return [`INSERT INTO account_holder (account_id, customer_id, holder_type) VALUES ${rows.join(", ")}`, params];
    };
    const addHolders = (accountId, holders) => client.query(...holderInsert(accountId, holders));
    const jointAccount = async (holderCount = 2) => {
        const accountId = await makeAccount("Joint");
        const customers = await makeCustomers(holderCount);
        await addHolders(accountId, customers.map((id, i) => [id, i === 0 ? "PRIMARY" : "JOINT"]));
        return { accountId, customers };
    };

    describe("savings_plan", () => {
        test("UNIQUE plan_name: a duplicate name is rejected (23505)", async () => {
            await violates(...insertPlan({ plan_name: "Adult" }), "23505", "savings_plan_plan_name_key");
        });

        test("CHECK age range: max_age_years < min_age_years is rejected (23514)", async () => {
            await violates(...insertPlan({ min_age_years: 20, max_age_years: 10 }), "23514", "chk_savings_plan_age_range");
        });

        test("CHECK holder range: max_holders < min_holders is rejected (23514)", async () => {
            await violates(...insertPlan({ min_holders: 3, max_holders: 2 }), "23514", "chk_savings_plan_holder_range");
        });

        test("CHECK min_balance >= 0: a negative minimum is rejected (23514)", async () => {
            await violates(...insertPlan({ min_balance: "-0.01" }), "23514", "chk_savings_plan_min_balance_nonneg");
        });

        test("CHECK status: an unknown status is rejected (23514)", async () => {
            await violates(...insertPlan({ status: "RETIRED" }), "23514", "savings_plan_status_check");
        });

        test("interest_rate domain: a rate outside [0, 1] is rejected (23514)", async () => {
            for (const rate of ["1.0001", "-0.0001", "10"]) {
                await violates(...insertPlan({ interest_rate: rate }), "23514");
            }
            // Boundaries are accepted: 0 and 1 are valid fractions.
            for (const rate of ["0", "1"]) await client.query(...insertPlan({ interest_rate: rate }));
        });

        test("deleting a plan that accounts reference is rejected (23503, RESTRICT)", async () => {
            await makeAccount("Adult");
            await violates("DELETE FROM savings_plan WHERE plan_id = $1", [planIds.Adult], "23503", "fk_account_plan");
        });
    });

    describe("account", () => {
        test("CHECK balance >= 0: a negative balance is rejected on INSERT and UPDATE (23514)", async () => {
            await violates(accountSql, accountParams({ current_balance: "-1" }), "23514", "ck_account_balance_non_negative");
            const id = await makeAccount();
            await violates("UPDATE account SET current_balance = -0.01 WHERE account_id = $1", [id], "23514", "ck_account_balance_non_negative");
        });

        test("CHECK status: an unknown status is rejected (23514)", async () => {
            await violates(accountSql, accountParams({ status: "DORMANT" }), "23514", "ck_account_status");
        });

        test("UNIQUE account_number: a duplicate number is rejected (23505)", async () => {
            await client.query(accountSql, accountParams({ account_number: "CS-DUPLICATE-1" }));
            await violates(accountSql, accountParams({ account_number: "CS-DUPLICATE-1" }), "23505", "uq_account_account_number");
        });

        test("FK plan_id, branch_id and opened_by_agent_id: dangling references are rejected (23503)", async () => {
            await violates(accountSql, accountParams({ plan_id: MISSING }), "23503", "fk_account_plan");
            await violates(accountSql, accountParams({ branch_id: MISSING }), "23503", "fk_account_branch");
            await violates(accountSql, accountParams({ opened_by_agent_id: MISSING }), "23503", "fk_account_opened_by_agent");
        });

        test("FK RESTRICT: an account referenced by account_holder cannot be deleted (23503)", async () => {
            const accountId = await makeAccount();
            await addHolders(accountId, [[await makeCustomer(), "PRIMARY"]]);
            await violates("DELETE FROM account WHERE account_id = $1", [accountId], "23503", "fk_account_holder_account");
        });

        test("FK RESTRICT: an account referenced by a joint_mandate cannot be deleted (23503)", async () => {
            const { accountId } = await jointAccount(2);
            await client.query(
                "INSERT INTO joint_mandate (account_id, mandate_type, required_signatories) VALUES ($1,'ALL_HOLDERS',2)", [accountId]);
            await violates("DELETE FROM account WHERE account_id = $1", [accountId], "23503");
        });

        test("FK RESTRICT: an account with a ledger row cannot be deleted (23503)", async () => {
            const accountId = await makeAccount("Adult", { current_balance: "100.00" });
            const { rows: [ctx] } = await client.query(`SELECT
                (SELECT user_id FROM app_user WHERE status='ACTIVE' ORDER BY username LIMIT 1) AS user_id,
                (SELECT channel_id FROM transaction_channel WHERE status='ACTIVE' ORDER BY channel_name LIMIT 1) AS channel_id`);
            await client.query(
                `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number,
                    transaction_type, amount, transaction_date)
                 VALUES ($1,$2,$3,$4,'DEPOSIT',100.00,now())`,
                [accountId, ctx.user_id, ctx.channel_id, `CS-REF-${tag()}`]);
            await client.query("SAVEPOINT expected_failure");
            await assert.rejects(client.query("DELETE FROM account WHERE account_id = $1", [accountId]), (err) => {
                assert.equal(err.code, "23503");
                assert.match(err.constraint, /transaction/);
                return true;
            });
            await client.query("ROLLBACK TO SAVEPOINT expected_failure");
        });
    });

    describe("account_holder", () => {
        test("UNIQUE (account_id, customer_id): the same customer cannot hold an account twice (23505)", async () => {
            const accountId = await makeAccount();
            const customerId = await makeCustomer();
            await addHolders(accountId, [[customerId, "PRIMARY"]]);
            await violates(...holderInsert(accountId, [[customerId, "JOINT"]]), "23505", "uq_account_holder_account_customer");
        });

        test("UNIQUE partial index: an account cannot have two PRIMARY holders (23505)", async () => {
            const accountId = await makeAccount("Joint");
            const [a, b] = await makeCustomers(2);
            await violates(...holderInsert(accountId, [[a, "PRIMARY"], [b, "PRIMARY"]]), "23505", "uq_account_holder_one_primary");
        });

        test("CHECK holder_type: an unknown holder type is rejected (23514)", async () => {
            const accountId = await makeAccount();
            await violates(...holderInsert(accountId, [[await makeCustomer(), "OWNER"]]), "23514", "ck_account_holder_type");
        });

        test("FK account_id and customer_id: dangling references are rejected (23503)", async () => {
            const accountId = await makeAccount();
            await violates(...holderInsert(MISSING, [[await makeCustomer(), "PRIMARY"]]), "23503", "fk_account_holder_account");
            await violates(...holderInsert(accountId, [[MISSING, "PRIMARY"]]), "23503", "fk_account_holder_customer");
        });

        test("FK RESTRICT: a customer who holds an account cannot be deleted (23503)", async () => {
            const accountId = await makeAccount();
            const customerId = await makeCustomer();
            await addHolders(accountId, [[customerId, "PRIMARY"]]);
            await violates("DELETE FROM customer WHERE customer_id = $1", [customerId], "23503", "fk_account_holder_customer");
        });
    });

    describe("joint_mandate", () => {
        const mandate = (accountId, type, signatories, from = null, to = null) => [
            `INSERT INTO joint_mandate (account_id, mandate_type, required_signatories, effective_from, effective_to)
             VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5::date)`,
            [accountId, type, signatories, from, to],
        ];

        test("UNIQUE account_id: one mandate per account (23505)", async () => {
            const { accountId } = await jointAccount(2);
            await client.query(...mandate(accountId, "ALL_HOLDERS", 2));
            await violates(...mandate(accountId, "ANY_ONE", 1), "23505", "uq_joint_mandate_account");
        });

        test("CHECK mandate_type: an unknown type is rejected (23514)", async () => {
            const { accountId } = await jointAccount(2);
            await violates(...mandate(accountId, "MAJORITY", 2), "23514", "ck_joint_mandate_type");
        });

        test("CHECK required_signatories BETWEEN 1 AND 4: 0 and 5 are rejected (23514)", async () => {
            const { accountId } = await jointAccount(2);
            await violates(...mandate(accountId, "ALL_HOLDERS", 0), "23514", "ck_joint_mandate_signatories_range");
            await violates(...mandate(accountId, "ALL_HOLDERS", 5), "23514", "ck_joint_mandate_signatories_range");
        });

        test("CHECK ANY_ONE implies one signatory: ANY_ONE with 2 is rejected (23514)", async () => {
            const { accountId } = await jointAccount(2);
            await violates(...mandate(accountId, "ANY_ONE", 2), "23514", "ck_joint_mandate_any_one_single");
        });

        test("CHECK effective_to >= effective_from: an inverted range is rejected (23514)", async () => {
            const { accountId } = await jointAccount(2);
            await violates(...mandate(accountId, "ALL_HOLDERS", 2, "2026-06-10", "2026-06-09"), "23514", "ck_joint_mandate_effective_range");
        });

        test("FK account_id: a mandate for a missing account is rejected (23503)", async () => {
            await violates(...mandate(MISSING, "ANY_ONE", 1), "23503", "fk_joint_mandate_account");
        });
    });

    describe("trg_validate_joint_mandate: holder-count rules on a Joint plan", () => {
        test("a Joint account with 1 holder is rejected (INVALID_HOLDER_COUNT)", async () => {
            const accountId = await makeAccount("Joint");
            await client.query("SAVEPOINT expected_failure");
            await assert.rejects(client.query(...holderInsert(accountId, [[await makeCustomer(), "PRIMARY"]])), (err) => {
                assert.equal(err.code, "P0001");
                assert.ok(err.message.startsWith("INVALID_HOLDER_COUNT"), err.message);
                assert.equal(err.constraint, "ck_account_holder_count");
                return true;
            });
            await client.query("ROLLBACK TO SAVEPOINT expected_failure");
        });

        test("a Joint account with 5 holders is rejected (INVALID_HOLDER_COUNT)", async () => {
            const accountId = await makeAccount("Joint");
            const customers = await makeCustomers(5);
            await client.query("SAVEPOINT expected_failure");
            await assert.rejects(
                client.query(...holderInsert(accountId, customers.map((id, i) => [id, i === 0 ? "PRIMARY" : "JOINT"]))),
                (err) => {
                    assert.equal(err.code, "P0001");
                    assert.ok(err.message.startsWith("INVALID_HOLDER_COUNT"), err.message);
                    assert.equal(err.constraint, "ck_account_holder_count");
                    return true;
                },
            );
            await client.query("ROLLBACK TO SAVEPOINT expected_failure");
        });

        test("2 and 4 holders are accepted (the boundaries of max_holders)", async () => {
            for (const count of [2, 4]) {
                const { accountId } = await jointAccount(count);
                const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM account_holder WHERE account_id=$1", [accountId]);
                assert.equal(rows[0].n, count);
            }
        });
    });

    // Completeness guard: new CHECK / UNIQUE / FK constraints on these tables must be added above.
    test("every CHECK, UNIQUE and FOREIGN KEY on the four tables has a negative test in this suite", async () => {
        const { rows } = await client.query(`SELECT c.conname FROM pg_constraint c
            WHERE c.conrelid IN ('savings_plan'::regclass, 'account'::regclass, 'account_holder'::regclass, 'joint_mandate'::regclass)
              AND c.contype IN ('c','u','f')
            UNION
            SELECT i.indexname FROM pg_indexes i
            WHERE i.schemaname = 'public' AND i.tablename IN ('savings_plan','account','account_holder','joint_mandate')
              AND i.indexdef LIKE 'CREATE UNIQUE INDEX%' AND i.indexname NOT LIKE '%\\_pkey'`);
        const uncovered = rows.map((r) => r.conname).filter((name) => !covered.has(name)).sort();
        assert.deepEqual(uncovered, [], `constraints without a negative test: ${uncovered.join(", ")}`);
    });
});
