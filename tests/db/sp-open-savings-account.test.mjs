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

const ownerUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

const CUS_PREFIX = "TEST-OPN-";

// Stable message prefix -> named constraint, so services can map errors without parsing text.
const CONSTRAINT_BY_PREFIX = {
    PLAN_NOT_FOUND: "ck_open_account_plan",
    AGENT_NOT_ELIGIBLE: "ck_open_account_agent",
    ACTOR_MISMATCH: "ck_open_account_actor",
    INVALID_HOLDER_COUNT: "ck_account_holder_count",
    HOLDER_NOT_FOUND: "ck_open_account_holder_exists",
    MISSING_PRIMARY_HOLDER: "ck_account_holder_one_primary",
    PLAN_ELIGIBILITY_FAILED: "ck_open_account_eligibility",
    DOCUMENTS_NOT_VERIFIED: "ck_open_account_documents",
    MANDATE_REQUIRED: "ck_open_account_mandate",
    MANDATE_NOT_ALLOWED: "ck_joint_mandate_multi_holder_plan",
    INVALID_MANDATE_TYPE: "ck_joint_mandate_type",
    INVALID_DEPOSIT_AMOUNT: "ck_open_account_deposit",
    BELOW_MINIMUM_BALANCE: "ck_open_account_minimum_balance",
    CHANNEL_REQUIRED: "ck_open_account_channel",
    CHANNEL_NOT_FOUND: "ck_open_account_channel",
    OUTSIDE_BUSINESS_HOURS: "ck_open_account_business_hours",
    INVALID_HOLDERS_PAYLOAD: "ck_open_account_holders_payload",
    UNDERAGE_HOLDER: "ck_account_holder_adult",
    INVALID_MANDATE_SIGNATORIES: "ck_joint_mandate_signatories_fit",
};

const YEARS_AGO = (n) => `(CURRENT_DATE - INTERVAL '${n} years')::date`;

describe("P02-M03-T04: sp_open_savings_account", () => {
    let client;
    let plans;
    let agentId;
    let branchId;
    let branchCode;
    let channelId;
    let otherBranchId;
    let otherAgentId;
    let seq = 0;

    const cleanupCommitted = async () => {
        await client.query(
            `DELETE FROM customer_document WHERE customer_id IN
               (SELECT customer_id FROM customer WHERE customer_number LIKE $1)`,
            [`${CUS_PREFIX}%`],
        );
        await client.query(
            `DELETE FROM account_holder WHERE customer_id IN
               (SELECT customer_id FROM customer WHERE customer_number LIKE $1)`,
            [`${CUS_PREFIX}%`],
        );
        await client.query("DELETE FROM customer WHERE customer_number LIKE $1", [`${CUS_PREFIX}%`]);
    };

    before(async () => {
        client = new pg.Client({ connectionString: ownerUrl });
        await client.connect();
        plans = Object.fromEntries(
            (await client.query("SELECT plan_id, plan_name, min_balance FROM savings_plan")).rows.map((p) => [p.plan_name, p]),
        );
        for (const name of ["Adult", "Joint", "Children", "Teen", "Senior"]) {
            assert.ok(plans[name], `seeded '${name}' savings plan is required`);
        }
        const agent = await client.query(
            `SELECT a.agent_id, a.branch_id, b.branch_code
               FROM agent a JOIN branch b ON b.branch_id = a.branch_id
              WHERE a.status = 'ACTIVE' ORDER BY a.employee_no LIMIT 1`,
        );
        assert.ok(agent.rows[0], "a seeded active agent is required");
        ({ agent_id: agentId, branch_id: branchId, branch_code: branchCode } = agent.rows[0]);
        const other = await client.query(
            "SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' AND branch_id <> $1 LIMIT 1",
            [branchId],
        );
        assert.ok(other.rows[0], "an active agent in a second branch is required");
        ({ agent_id: otherAgentId, branch_id: otherBranchId } = other.rows[0]);
        const channel = await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'");
        assert.ok(channel.rows[0], "seeded BRANCH_COUNTER channel is required");
        channelId = channel.rows[0].channel_id;
        await cleanupCommitted();
    });

    beforeEach(async () => {
        await client.query("ROLLBACK").catch(() => {});
    });

    after(async () => {
        await client.query("ROLLBACK").catch(() => {});
        await cleanupCommitted();
        await client.end();
    });

    // Every scenario runs in a transaction that is rolled back: nothing persists, which also keeps
    // the immutable ledger and audit tables free of test debris.
    // BR-08: deposits need business hours; M1's fn_is_business_hour honours a business_calendar row,
    // so each scenario pins today as an all-day business day (rolled back with the scenario).
    const setToday = (c, isBusinessDay) =>
        c.query(
            `INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
             VALUES ((now() AT TIME ZONE 'Asia/Colombo')::date, $1, '00:00', '23:59:59', 'TEST-OPN calendar')
             ON CONFLICT (calendar_date) DO UPDATE
                SET is_business_day = EXCLUDED.is_business_day, open_time = '00:00', close_time = '23:59:59'`,
            [isBusinessDay],
        );

    // For tests that commit: pin today as a business day, then put back whatever row existed.
    const withOpenCalendar = async (fn) => {
        const original = (
            await client.query("SELECT * FROM business_calendar WHERE calendar_date = (now() AT TIME ZONE 'Asia/Colombo')::date")
        ).rows[0];
        await setToday(client, true);
        try {
            await fn();
        } finally {
            await client.query("DELETE FROM business_calendar WHERE calendar_date = (now() AT TIME ZONE 'Asia/Colombo')::date");
            if (original) {
                await client.query(
                    `INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [original.calendar_date, original.is_business_day, original.open_time, original.close_time, original.description],
                );
            }
        }
    };

    const scenario = (fn) => async () => {
        await client.query("BEGIN");
        try {
            await setToday(client, true);
            await fn(client);
        } finally {
            await client.query("ROLLBACK");
        }
    };

    const makeCustomer = async (c, { dob = "DATE '1990-01-01'", verified = true, status = "ACTIVE", branch = branchId } = {}) => {
        const n = ++seq;
        const id = (
            await c.query(
                `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email, status)
                 VALUES ($1, $2, $3, 'Test Opening Holder', ${dob}, $4, $5) RETURNING customer_id`,
                [branch, `${CUS_PREFIX}${Date.now()}-${n}`, `${CUS_PREFIX}NIC-${Date.now()}-${n}`, `${CUS_PREFIX}${Date.now()}-${n}@example.test`, status],
            )
        ).rows[0].customer_id;
        if (verified) {
            await c.query(
                `INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date)
                 VALUES ($1, 'NIC', '/synthetic/test.pdf', $2, now())`,
                [id, agentId],
            );
        }
        return id;
    };

    const individualHolders = (customerId) => [{ customer_id: customerId, holder_type: "PRIMARY" }];
    const jointHolders = (ids) => ids.map((id, i) => ({ customer_id: id, holder_type: i === 0 ? "PRIMARY" : "JOINT" }));

    const callArgs = (o = {}) => {
        const a = {
            plan: plans.Adult.plan_id,
            branch: branchId,
            agent: agentId,
            holders: [],
            mandate: null,
            deposit: null,
            channel: null,
            actor: agentId,
            ...o,
        };
        return [
            a.plan, a.branch, a.agent,
            a.holders === null ? null : JSON.stringify(a.holders),
            a.mandate === null ? null : JSON.stringify(a.mandate),
            a.deposit, a.channel, a.actor,
        ];
    };

    const CALL_SQL = `CALL sp_open_savings_account($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb,
                                                    $6::numeric, $7::uuid, $8::uuid, NULL, NULL, NULL)`;

    const open = async (c, overrides) => (await c.query(CALL_SQL, callArgs(overrides))).rows[0];

    const expectFail = async (c, overrides, prefix, { code = "P0001" } = {}) => {
        await c.query("SAVEPOINT attempt");
        try {
            await c.query(CALL_SQL, callArgs(overrides));
        } catch (err) {
            await c.query("ROLLBACK TO SAVEPOINT attempt");
            assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
            if (prefix) {
                assert.ok(err.message.startsWith(prefix), `expected ${prefix}, got: ${err.message}`);
                assert.equal(err.constraint, CONSTRAINT_BY_PREFIX[prefix]);
            }
            return err;
        }
        assert.fail(`CALL should have failed with ${prefix ?? code}`);
    };

    const count = async (c, sql, params) => (await c.query(sql, params)).rows[0].n;

    // ---------------------------------------------------------------- success paths

    test("1. Opens an individual account with no deposit", scenario(async (c) => {
        const cus = await makeCustomer(c);
        const out = await open(c, { holders: individualHolders(cus) });

        assert.ok(out.p_account_id);
        assert.match(out.p_account_number, new RegExp(`^${branchCode.toUpperCase()}-\\d{8}$`));
        assert.equal(out.p_current_balance, "0.00");

        const acc = (await c.query("SELECT plan_id, branch_id, opened_by_agent_id, status, current_balance FROM account WHERE account_id = $1", [out.p_account_id])).rows[0];
        assert.equal(acc.plan_id, plans.Adult.plan_id);
        assert.equal(acc.branch_id, branchId);
        assert.equal(acc.opened_by_agent_id, agentId);
        assert.equal(acc.status, "ACTIVE");

        const holders = await c.query("SELECT customer_id, holder_type FROM account_holder WHERE account_id = $1", [out.p_account_id]);
        assert.deepEqual(holders.rows, [{ customer_id: cus, holder_type: "PRIMARY" }]);
        assert.equal(await count(c, "SELECT count(*)::int AS n FROM joint_mandate WHERE account_id = $1", [out.p_account_id]), 0);
        assert.equal(await count(c, "SELECT count(*)::int AS n FROM transaction WHERE account_id = $1", [out.p_account_id]), 0);

        // The existing audit trigger records the account, attributed to the acting user.
        const audit = await c.query(
            "SELECT user_id, actor_type, action FROM audit_log WHERE entity_type = 'account' AND entity_id = $1",
            [out.p_account_id],
        );
        assert.equal(audit.rowCount, 1);
        assert.deepEqual(audit.rows[0], { user_id: agentId, actor_type: "USER", action: "INSERT" });
    }));

    test("2. An initial deposit writes one ledger row and the same balance, exactly", scenario(async (c) => {
        const cus = await makeCustomer(c);
        const out = await open(c, { holders: individualHolders(cus), deposit: "1500.50", channel: channelId });

        assert.equal(out.p_current_balance, "1500.50");
        const ledger = await c.query(
            "SELECT transaction_type, amount, reference_number, initiated_by_user_id, channel_id FROM transaction WHERE account_id = $1",
            [out.p_account_id],
        );
        assert.equal(ledger.rowCount, 1);
        assert.deepEqual(ledger.rows[0], {
            transaction_type: "DEPOSIT",
            amount: "1500.50",
            reference_number: `OPEN-${out.p_account_number}`,
            initiated_by_user_id: agentId,
            channel_id: channelId,
        });

        const check = await c.query(
            `SELECT a.current_balance = COALESCE(SUM(t.amount), 0) AS balanced
               FROM account a LEFT JOIN transaction t ON t.account_id = a.account_id
              WHERE a.account_id = $1 GROUP BY a.current_balance`,
            [out.p_account_id],
        );
        assert.equal(check.rows[0].balanced, true);

        const audit = await c.query(
            "SELECT new_values FROM audit_log WHERE entity_type = 'transaction' AND user_id = $1 AND new_values ->> 'account_id' = $2",
            [agentId, out.p_account_id],
        );
        assert.equal(audit.rowCount, 1);
        assert.equal(audit.rows[0].new_values.amount, 1500.5);
    }));

    test("3. A deposit exactly at the plan minimum is accepted; 0 and NULL mean no deposit", scenario(async (c) => {
        const min = plans.Adult.min_balance;
        const a = await open(c, { holders: individualHolders(await makeCustomer(c)), deposit: min, channel: channelId });
        assert.equal(a.p_current_balance, min);

        for (const deposit of [0, null]) {
            const out = await open(c, { holders: individualHolders(await makeCustomer(c)), deposit });
            assert.equal(out.p_current_balance, "0.00");
            assert.equal(await count(c, "SELECT count(*)::int AS n FROM transaction WHERE account_id = $1", [out.p_account_id]), 0);
        }
    }));

    test("4. A minor opens a Children account (age rules come from the plan row)", scenario(async (c) => {
        const child = await makeCustomer(c, { dob: YEARS_AGO(8) });
        const out = await open(c, { plan: plans.Children.plan_id, holders: individualHolders(child) });
        assert.ok(out.p_account_id);
    }));

    test("5. A joint account with an ANY_ONE mandate (signatories default to 1)", scenario(async (c) => {
        const ids = [await makeCustomer(c), await makeCustomer(c)];
        const out = await open(c, {
            plan: plans.Joint.plan_id,
            holders: jointHolders(ids),
            mandate: { mandate_type: "ANY_ONE" },
            deposit: "5000.00",
            channel: channelId,
        });
        assert.equal(out.p_current_balance, "5000.00");
        const mandate = (await c.query("SELECT mandate_id, mandate_type, required_signatories FROM joint_mandate WHERE account_id = $1", [out.p_account_id])).rows[0];
        assert.equal(mandate.mandate_type, "ANY_ONE");
        assert.equal(mandate.required_signatories, 1);
        const audit = await c.query("SELECT 1 FROM audit_log WHERE entity_type = 'joint_mandate' AND entity_id = $1", [mandate.mandate_id]);
        assert.equal(audit.rowCount, 1);
    }));

    test("6. A four-holder joint account with ALL_HOLDERS (signatories default to the holder count)", scenario(async (c) => {
        const ids = [];
        for (let i = 0; i < 4; i++) ids.push(await makeCustomer(c));
        const out = await open(c, {
            plan: plans.Joint.plan_id,
            holders: jointHolders(ids),
            mandate: { mandate_type: "ALL_HOLDERS" },
        });
        const mandate = (await c.query("SELECT required_signatories FROM joint_mandate WHERE account_id = $1", [out.p_account_id])).rows[0];
        assert.equal(mandate.required_signatories, 4);
        assert.equal(await count(c, "SELECT count(*)::int AS n FROM account_holder WHERE account_id = $1", [out.p_account_id]), 4);
    }));

    // ---------------------------------------------------------------- plan, agent, actor

    test("7. An unknown or inactive plan is rejected (PLAN_NOT_FOUND)", scenario(async (c) => {
        const cus = await makeCustomer(c);
        await expectFail(c, { plan: "00000000-0000-0000-0000-00000000dead", holders: individualHolders(cus) }, "PLAN_NOT_FOUND");
        await c.query("UPDATE savings_plan SET status = 'INACTIVE' WHERE plan_id = $1", [plans.Adult.plan_id]);
        await expectFail(c, { holders: individualHolders(cus) }, "PLAN_NOT_FOUND");
    }));

    test("8. The opening agent must be an active agent of the stated branch (AGENT_NOT_ELIGIBLE)", scenario(async (c) => {
        const cus = await makeCustomer(c);
        await expectFail(c, { agent: "00000000-0000-0000-0000-00000000dead", holders: individualHolders(cus) }, "AGENT_NOT_ELIGIBLE");
        await expectFail(c, { branch: otherBranchId, holders: individualHolders(cus) }, "AGENT_NOT_ELIGIBLE");
        await expectFail(c, { agent: otherAgentId, holders: individualHolders(cus) }, "AGENT_NOT_ELIGIBLE");
    }));

    test("9. An acting user is required and must match the session user (ACTOR_MISMATCH)", scenario(async (c) => {
        const cus = await makeCustomer(c);
        await expectFail(c, { actor: null, holders: individualHolders(cus) }, "ACTOR_MISMATCH");
        await c.query("SELECT set_config('app.current_user_id', $1, true)", [otherAgentId]);
        await expectFail(c, { holders: individualHolders(cus) }, "ACTOR_MISMATCH");
    }));

    // ---------------------------------------------------------------- holders

    test("10. Holder counts outside the plan's range are rejected (INVALID_HOLDER_COUNT)", scenario(async (c) => {
        const ids = [];
        for (let i = 0; i < 5; i++) ids.push(await makeCustomer(c));
        const mandate = { mandate_type: "ANY_ONE" };
        await expectFail(c, { plan: plans.Joint.plan_id, holders: jointHolders(ids.slice(0, 1)), mandate }, "INVALID_HOLDER_COUNT");
        await expectFail(c, { plan: plans.Joint.plan_id, holders: jointHolders(ids), mandate }, "INVALID_HOLDER_COUNT");
        await expectFail(c, { holders: jointHolders(ids.slice(0, 2)) }, "INVALID_HOLDER_COUNT");
        await expectFail(c, { holders: [] }, "INVALID_HOLDER_COUNT");
        await expectFail(c, { holders: null }, "INVALID_HOLDER_COUNT");
    }));

    test("11. Unknown or inactive customers are rejected (HOLDER_NOT_FOUND)", scenario(async (c) => {
        await expectFail(c, { holders: individualHolders("00000000-0000-0000-0000-00000000dead") }, "HOLDER_NOT_FOUND");
        const inactive = await makeCustomer(c, { status: "INACTIVE" });
        await expectFail(c, { holders: individualHolders(inactive) }, "HOLDER_NOT_FOUND");
    }));

    test("12. A joint account needs a PRIMARY holder (MISSING_PRIMARY_HOLDER)", scenario(async (c) => {
        const ids = [await makeCustomer(c), await makeCustomer(c)];
        await expectFail(c, {
            plan: plans.Joint.plan_id,
            holders: ids.map((id) => ({ customer_id: id, holder_type: "JOINT" })),
            mandate: { mandate_type: "ANY_ONE" },
        }, "MISSING_PRIMARY_HOLDER");
    }));

    test("13. An ineligible primary applicant is rejected (PLAN_ELIGIBILITY_FAILED)", scenario(async (c) => {
        const minor = await makeCustomer(c, { dob: YEARS_AGO(10) });
        await expectFail(c, { holders: individualHolders(minor) }, "PLAN_ELIGIBILITY_FAILED");
        const adult = await makeCustomer(c);
        await expectFail(c, { plan: plans.Children.plan_id, holders: individualHolders(adult) }, "PLAN_ELIGIBILITY_FAILED");
    }));

    test("14. An under-18 joint holder is stopped by the database trigger (UNDERAGE_HOLDER)", scenario(async (c) => {
        const ids = [await makeCustomer(c), await makeCustomer(c, { dob: YEARS_AGO(12) })];
        await expectFail(c, {
            plan: plans.Joint.plan_id,
            holders: jointHolders(ids),
            mandate: { mandate_type: "ANY_ONE" },
        }, "UNDERAGE_HOLDER");
    }));

    test("15. Every holder needs a verified document (DOCUMENTS_NOT_VERIFIED)", scenario(async (c) => {
        const verified = await makeCustomer(c);
        const unverified = await makeCustomer(c, { verified: false });
        await expectFail(c, { holders: individualHolders(unverified) }, "DOCUMENTS_NOT_VERIFIED");
        // A pending (unverified) document does not count either.
        await c.query(
            "INSERT INTO customer_document (customer_id, doc_type, file_path) VALUES ($1, 'NIC', '/synthetic/pending.pdf')",
            [unverified],
        );
        await expectFail(c, { holders: individualHolders(unverified) }, "DOCUMENTS_NOT_VERIFIED");
        await expectFail(c, {
            plan: plans.Joint.plan_id,
            holders: jointHolders([verified, unverified]),
            mandate: { mandate_type: "ANY_ONE" },
        }, "DOCUMENTS_NOT_VERIFIED");
    }));

    test("16. The same customer twice is rejected by the unique key (23505)", scenario(async (c) => {
        const cus = await makeCustomer(c);
        const err = await expectFail(c, {
            plan: plans.Joint.plan_id,
            holders: jointHolders([cus, cus]),
            mandate: { mandate_type: "ANY_ONE" },
        }, null, { code: "23505" });
        assert.equal(err.constraint, "uq_account_holder_account_customer");
    }));

    // ---------------------------------------------------------------- mandate

    test("17. Mandate rules: required on joint, forbidden on individual, validated by the database", scenario(async (c) => {
        const ids = [await makeCustomer(c), await makeCustomer(c), await makeCustomer(c)];
        const joint = { plan: plans.Joint.plan_id, holders: jointHolders(ids) };
        await expectFail(c, joint, "MANDATE_REQUIRED");
        await expectFail(c, { holders: individualHolders(await makeCustomer(c)), mandate: { mandate_type: "ANY_ONE" } }, "MANDATE_NOT_ALLOWED");
        await expectFail(c, { ...joint, mandate: { mandate_type: "ALL_HOLDERS", required_signatories: 2 } }, "INVALID_MANDATE_SIGNATORIES");
        await expectFail(c, { ...joint, mandate: { mandate_type: "MAJORITY" } }, "INVALID_MANDATE_TYPE");
        await expectFail(c, { ...joint, mandate: {} }, "INVALID_MANDATE_TYPE");
    }));

    // ---------------------------------------------------------------- deposit

    test("18. Invalid deposits are rejected before anything is written", scenario(async (c) => {
        const cus = await makeCustomer(c);
        const base = { holders: individualHolders(cus), channel: channelId };
        await expectFail(c, { ...base, deposit: "999.99" }, "BELOW_MINIMUM_BALANCE");
        await expectFail(c, { ...base, deposit: "-5.00" }, "INVALID_DEPOSIT_AMOUNT");
        await expectFail(c, { ...base, deposit: "1000.001" }, "INVALID_DEPOSIT_AMOUNT");
        await expectFail(c, { holders: individualHolders(cus), deposit: "1000.00" }, "CHANNEL_REQUIRED");
        await expectFail(c, { ...base, deposit: "1000.00", channel: "00000000-0000-0000-0000-00000000dead" }, "CHANNEL_NOT_FOUND");
        assert.equal(await count(c, "SELECT count(*)::int AS n FROM account_holder WHERE customer_id = $1", [cus]), 0);
        assert.equal(await count(c, "SELECT count(*)::int AS n FROM transaction WHERE initiated_by_user_id = $1 AND transaction_date > now() - interval '1 minute' AND narration = 'Initial deposit on account opening'", [agentId]), 0);
    }));

    // ---------------------------------------------------------------- atomicity

    test("19. A failure after partial writes leaves nothing behind in any table", async () => withOpenCalendar(async () => {
        // Committed fixtures + autocommit CALL: the procedure's own implicit transaction is the unit.
        const ids = [await makeCustomer(client), await makeCustomer(client)];
        const before = {
            accounts: await count(client, "SELECT count(*)::int AS n FROM account"),
            holders: await count(client, "SELECT count(*)::int AS n FROM account_holder"),
            mandates: await count(client, "SELECT count(*)::int AS n FROM joint_mandate"),
            ledger: await count(client, "SELECT count(*)::int AS n FROM transaction"),
        };
        try {
            // The mandate fails the database fit check AFTER the account and holders were inserted.
            await assert.rejects(
                client.query(CALL_SQL, callArgs({
                    plan: plans.Joint.plan_id,
                    holders: jointHolders(ids),
                    mandate: { mandate_type: "ALL_HOLDERS", required_signatories: 3 },
                    deposit: "5000.00",
                    channel: channelId,
                })),
                (err) => err.code === "P0001" && err.message.startsWith("INVALID_MANDATE_SIGNATORIES"),
            );
            assert.deepEqual(
                {
                    accounts: await count(client, "SELECT count(*)::int AS n FROM account"),
                    holders: await count(client, "SELECT count(*)::int AS n FROM account_holder"),
                    mandates: await count(client, "SELECT count(*)::int AS n FROM joint_mandate"),
                    ledger: await count(client, "SELECT count(*)::int AS n FROM transaction"),
                },
                before,
            );
        } finally {
            await cleanupCommitted();
        }
    }));

    // ---------------------------------------------------------------- account numbers

    test("20. Concurrent opens receive distinct, well-formed account numbers", async () => {
        const cus = [];
        await client.query("BEGIN");
        for (let i = 0; i < 6; i++) cus.push(await makeCustomer(client));
        await client.query("COMMIT");
        const workers = cus.map(() => new pg.Client({ connectionString: ownerUrl }));
        try {
            await Promise.all(workers.map((w) => w.connect()));
            const numbers = await Promise.all(
                workers.map(async (w, i) => {
                    await w.query("BEGIN");
                    try {
                        return (await open(w, { holders: individualHolders(cus[i]) })).p_account_number;
                    } finally {
                        await w.query("ROLLBACK");
                    }
                }),
            );
            assert.equal(new Set(numbers).size, numbers.length, `duplicate numbers: ${numbers}`);
            for (const n of numbers) assert.match(n, /^[A-Z0-9-]+-\d{8}$/);
        } finally {
            await Promise.all(workers.map((w) => w.end()));
            await cleanupCommitted();
        }
    });

    test("21. fn_next_account_number trims, upper-cases and rejects a blank branch code", scenario(async (c) => {
        const n = (await c.query("SELECT fn_next_account_number('  col ') AS n")).rows[0].n;
        assert.match(n, /^COL-\d{8}$/);
        for (const blank of ["", "   ", null]) {
            await c.query("SAVEPOINT s");
            await assert.rejects(c.query("SELECT fn_next_account_number($1)", [blank]), { code: "P0001" });
            await c.query("ROLLBACK TO SAVEPOINT s");
        }
    }));

    // ---------------------------------------------------------------- application role

    test("22. As mims_app (AGENT, branch-scoped) an account opens in its own branch only", async () => {
        const cus = [];
        await client.query("BEGIN");
        for (let i = 0; i < 2; i++) cus.push(await makeCustomer(client));
        await client.query("COMMIT");

        const originalDay = (
            await client.query(
                "SELECT * FROM business_calendar WHERE calendar_date = (now() AT TIME ZONE 'Asia/Colombo')::date",
            )
        ).rows[0];
        await setToday(client, true);

        const app = new pg.Client({ connectionString: appUrl });
        await app.connect();
        const context = async (branch, user) => {
            await app.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', 'AGENT', true)`,
                [user, branch],
            );
        };
        try {
            await app.query("BEGIN");
            await context(branchId, agentId);
            const out = await open(app, { holders: individualHolders(cus[0]), deposit: "1000.00", channel: channelId });
            assert.equal(out.p_current_balance, "1000.00");
            await app.query("ROLLBACK");

            // Another branch's agent and branch: row-level security refuses the account insert.
            await app.query("BEGIN");
            await context(branchId, otherAgentId);
            await assert.rejects(
                open(app, { agent: otherAgentId, branch: otherBranchId, actor: otherAgentId, holders: individualHolders(cus[1]) }),
                (err) => err.code === "42501",
            );
            await app.query("ROLLBACK");
        } finally {
            await app.query("ROLLBACK").catch(() => {});
            await app.end();
            await client.query(
                "DELETE FROM business_calendar WHERE calendar_date = (now() AT TIME ZONE 'Asia/Colombo')::date",
            );
            if (originalDay) {
                await client.query(
                    `INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [originalDay.calendar_date, originalDay.is_business_day, originalDay.open_time, originalDay.close_time, originalDay.description],
                );
            }
            await cleanupCommitted();
        }
    });

    // ---------------------------------------------------------------- review fixes

    test("23. An initial deposit outside business hours is rejected; opening without one is not", scenario(async (c) => {
        await setToday(c, false);
        const cus = await makeCustomer(c);
        await expectFail(c, { holders: individualHolders(cus), deposit: "1000.00", channel: channelId }, "OUTSIDE_BUSINESS_HOURS");
        const out = await open(c, { holders: individualHolders(cus) });
        assert.equal(out.p_current_balance, "0.00");
    }));

    test("24. Malformed input gets a named error, never a raw database error", scenario(async (c) => {
        const cus = await makeCustomer(c);
        const ok = { customer_id: cus, holder_type: "PRIMARY" };
        await expectFail(c, { holders: [{ customer_id: cus }] }, "INVALID_HOLDERS_PAYLOAD");
        await expectFail(c, { holders: [{ customer_id: cus, holder_type: "OWNER" }] }, "INVALID_HOLDERS_PAYLOAD");
        await expectFail(c, { holders: [{ customer_id: "not-a-uuid", holder_type: "PRIMARY" }] }, "INVALID_HOLDERS_PAYLOAD");
        await expectFail(c, { holders: [{ customer_id: 7, holder_type: "PRIMARY" }] }, "INVALID_HOLDERS_PAYLOAD");
        await expectFail(c, { holders: ["text"] }, "INVALID_HOLDERS_PAYLOAD");
        await expectFail(c, { holders: { customer_id: cus } }, "INVALID_HOLDER_COUNT");

        const ids = [await makeCustomer(c), await makeCustomer(c)];
        const joint = { plan: plans.Joint.plan_id, holders: jointHolders(ids) };
        for (const bad of ["abc", 2.5, "2", -1, 100, true]) {
            await expectFail(c, { ...joint, mandate: { mandate_type: "ALL_HOLDERS", required_signatories: bad } }, "INVALID_MANDATE_SIGNATORIES");
        }
        await expectFail(c, { holders: [ok], deposit: "10000000000000.00", channel: channelId }, "INVALID_DEPOSIT_AMOUNT");
    }));

    test("25. Teen, Senior and Joint minimums and age boundaries come from the plan rows", scenario(async (c) => {
        const teen = { plan: plans.Teen.plan_id };
        const senior = { plan: plans.Senior.plan_id };
        // Exactly 13 / 60 today is accepted; one day short is not.
        await open(c, { ...teen, holders: individualHolders(await makeCustomer(c, { dob: YEARS_AGO(13) })), deposit: "500.00", channel: channelId });
        await expectFail(c, { ...teen, holders: individualHolders(await makeCustomer(c, { dob: `(CURRENT_DATE - INTERVAL '13 years' + INTERVAL '1 day')::date` })) }, "PLAN_ELIGIBILITY_FAILED");
        await open(c, { ...senior, holders: individualHolders(await makeCustomer(c, { dob: YEARS_AGO(60) })) });
        await expectFail(c, { ...senior, holders: individualHolders(await makeCustomer(c, { dob: YEARS_AGO(59) })) }, "PLAN_ELIGIBILITY_FAILED");
        // Plan minimums: Teen 500, Joint 5000.
        await expectFail(c, { ...teen, holders: individualHolders(await makeCustomer(c, { dob: YEARS_AGO(15) })), deposit: "499.99", channel: channelId }, "BELOW_MINIMUM_BALANCE");
        const ids = [await makeCustomer(c), await makeCustomer(c)];
        await expectFail(c, {
            plan: plans.Joint.plan_id, holders: jointHolders(ids), mandate: { mandate_type: "ANY_ONE" },
            deposit: "4999.99", channel: channelId,
        }, "BELOW_MINIMUM_BALANCE");
    }));

    test("26. Account numbers increase with the sequence", scenario(async (c) => {
        const a = (await open(c, { holders: individualHolders(await makeCustomer(c)) })).p_account_number;
        const b = (await open(c, { holders: individualHolders(await makeCustomer(c)) })).p_account_number;
        const n = (x) => Number(x.slice(-8));
        assert.ok(n(b) > n(a), `${b} should come after ${a}`);
    }));

    test("27. A holder deactivated by a concurrent transaction cannot be used (customer lock)", async () => {
        const cus = await makeCustomer(client);
        const a = new pg.Client({ connectionString: ownerUrl });
        const b = new pg.Client({ connectionString: ownerUrl });
        await a.connect();
        await b.connect();
        try {
            await a.query("BEGIN");
            await a.query("UPDATE customer SET status = 'INACTIVE' WHERE customer_id = $1", [cus]);

            await b.query("BEGIN");
            await setToday(b, true);
            let settled = false;
            const attempt = b
                .query(CALL_SQL, callArgs({ holders: individualHolders(cus) }))
                .then(() => ({ ok: true }), (error) => ({ ok: false, error }))
                .finally(() => { settled = true; });

            await new Promise((resolve) => setTimeout(resolve, 400));
            assert.equal(settled, false, "the open must wait for the deactivating transaction");
            await a.query("COMMIT");

            const outcome = await attempt;
            assert.equal(outcome.ok, false);
            assert.ok(outcome.error.message.startsWith("HOLDER_NOT_FOUND"), outcome.error.message);
        } finally {
            await b.query("ROLLBACK").catch(() => {});
            await a.end();
            await b.end();
            await cleanupCommitted();
        }
    });

    test("28. A plan edit in flight blocks the open until it finishes (plan lock)", async () => {
        const cus = await makeCustomer(client);
        const a = new pg.Client({ connectionString: ownerUrl });
        const b = new pg.Client({ connectionString: ownerUrl });
        await a.connect();
        await b.connect();
        try {
            await a.query("BEGIN");
            await a.query("UPDATE savings_plan SET status = 'INACTIVE' WHERE plan_id = $1", [plans.Adult.plan_id]);

            await b.query("BEGIN");
            let settled = false;
            const attempt = b
                .query(CALL_SQL, callArgs({ holders: individualHolders(cus) }))
                .then(() => ({ ok: true }), (error) => ({ ok: false, error }))
                .finally(() => { settled = true; });

            await new Promise((resolve) => setTimeout(resolve, 400));
            assert.equal(settled, false, "the open must wait for the plan edit");
            await a.query("ROLLBACK");

            const outcome = await attempt;
            assert.equal(outcome.ok, true, outcome.error?.message);
        } finally {
            await a.query("ROLLBACK").catch(() => {});
            await b.query("ROLLBACK").catch(() => {});
            await a.end();
            await b.end();
            await cleanupCommitted();
        }
    });

    test("29. A failed open as mims_app leaves no rows behind", async () => {
        const ids = [await makeCustomer(client), await makeCustomer(client)];
        const totals = async () => ({
            accounts: await count(client, "SELECT count(*)::int AS n FROM account"),
            holders: await count(client, "SELECT count(*)::int AS n FROM account_holder"),
            mandates: await count(client, "SELECT count(*)::int AS n FROM joint_mandate"),
            ledger: await count(client, "SELECT count(*)::int AS n FROM transaction"),
        });
        const before = await totals();
        const originalDay = (
            await client.query("SELECT * FROM business_calendar WHERE calendar_date = (now() AT TIME ZONE 'Asia/Colombo')::date")
        ).rows[0];
        await setToday(client, true);
        const app = new pg.Client({ connectionString: appUrl });
        await app.connect();
        try {
            await app.query("BEGIN");
            await app.query(
                `SELECT set_config('app.current_user_id', $1, true),
                        set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', 'AGENT', true)`,
                [agentId, branchId],
            );
            await assert.rejects(
                app.query(CALL_SQL, callArgs({
                    plan: plans.Joint.plan_id,
                    holders: jointHolders(ids),
                    mandate: { mandate_type: "ALL_HOLDERS", required_signatories: 3 },
                    deposit: "5000.00",
                    channel: channelId,
                })),
                (err) => err.code === "P0001" && err.message.startsWith("INVALID_MANDATE_SIGNATORIES"),
            );
            await app.query("ROLLBACK");
            assert.deepEqual(await totals(), before);
        } finally {
            await app.query("ROLLBACK").catch(() => {});
            await app.end();
            await client.query("DELETE FROM business_calendar WHERE calendar_date = (now() AT TIME ZONE 'Asia/Colombo')::date");
            if (originalDay) {
                await client.query(
                    `INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [originalDay.calendar_date, originalDay.is_business_day, originalDay.open_time, originalDay.close_time, originalDay.description],
                );
            }
            await cleanupCommitted();
        }
    });
});
