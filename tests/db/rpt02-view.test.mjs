import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
    try {
        process.loadEnvFile();
    } catch {
        // ignore if loaded by runner
    }
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

const PREFIX = "TEST-RPT02-";

// Everything runs in ONE transaction that is rolled back in after(): nothing is committed, so the immutable
// ledger and audit tables stay free of test debris. Ledger rows are written directly (owner) with explicit
// timestamps and balance_after so the expected balances are known exactly; one test goes through the real
// routines to prove the 0541 fix.
describe("P05-M03-T01: vw_rpt02_account_summary and the opening-deposit balance_after fix", () => {
    let client;
    let agent;
    let otherBranchId;
    let adultPlanId;
    let channelId;
    let seq = 0;

    const at = (day) => `2025-03-${String(day).padStart(2, "0")}T10:00:00+05:30`;

    async function openAccount(balance = "0.00") {
        seq += 1;
        const res = await client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [adultPlanId, agent.branch_id, agent.agent_id, `${PREFIX}${seq}`],
        );
        await client.query("UPDATE account SET current_balance = $2 WHERE account_id = $1", [res.rows[0].account_id, balance]);
        return res.rows[0].account_id;
    }

    async function post(accountId, type, amount, balanceAfter, day) {
        seq += 1;
        const res = await client.query(
            `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type,
                                      amount, transaction_date, balance_after)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING transaction_id`,
            [accountId, agent.agent_id, channelId, `${PREFIX}REF-${seq}`, type, amount, at(day), balanceAfter],
        );
        return res.rows[0].transaction_id;
    }

    async function reverse(originalId, reversalId) {
        await client.query(
            `INSERT INTO transaction_reversal (original_transaction_id, reversal_transaction_id, reason, reversed_by_user_id)
             VALUES ($1, $2, 'test reversal', $3)`,
            [originalId, reversalId, agent.agent_id],
        );
    }

    // The same shapes the report query (T02) will use: calendar days in Asia/Colombo, [from, to + 1 day).
    async function range(accountId, from, to) {
        const bounds = "($2::date::timestamp AT TIME ZONE 'Asia/Colombo') AS lo, (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo') AS hi";
        const res = await client.query(
            `WITH b AS (SELECT ${bounds}),
                  opening AS (
                    SELECT COALESCE(
                      (SELECT v.balance_before FROM vw_rpt02_account_summary v, b
                        WHERE v.account_id = $1 AND v.transaction_id IS NOT NULL AND v.transaction_date >= b.lo
                        ORDER BY v.ledger_seq LIMIT 1),
                      (SELECT current_balance FROM account WHERE account_id = $1)) AS value)
             SELECT (SELECT value FROM opening)::text AS opening,
                    COALESCE(
                      (SELECT v.balance_after_effective FROM vw_rpt02_account_summary v, b
                        WHERE v.account_id = $1 AND v.transaction_id IS NOT NULL AND v.transaction_date < b.hi
                        ORDER BY v.ledger_seq DESC LIMIT 1),
                      (SELECT value FROM opening))::text AS closing,
                    COALESCE(SUM(v.effective_amount) FILTER (WHERE v.activity_type = 'DEPOSIT'), 0)::numeric(15,2)::text AS deposits,
                    COALESCE(SUM(v.effective_amount) FILTER (WHERE v.activity_type = 'WITHDRAWAL'), 0)::numeric(15,2)::text AS withdrawals,
                    COALESCE(SUM(v.effective_amount) FILTER (WHERE v.activity_type = 'INTEREST_CREDIT'), 0)::numeric(15,2)::text AS interest,
                    COALESCE(SUM(v.balance_effect), 0)::numeric(15,2)::text AS net_effect
               FROM b LEFT JOIN vw_rpt02_account_summary v
                 ON v.account_id = $1 AND v.transaction_id IS NOT NULL AND v.transaction_date >= b.lo AND v.transaction_date < b.hi`,
            [accountId, from, to],
        );
        return res.rows[0];
    }

    const asNumber = (text) => Math.round(Number(text) * 100);
    function assertIdentity(r) {
        // closing - opening = deposits - withdrawals + interest (reversals already netted into their category)
        assert.equal(asNumber(r.closing) - asNumber(r.opening), asNumber(r.deposits) - asNumber(r.withdrawals) + asNumber(r.interest));
        assert.equal(asNumber(r.closing) - asNumber(r.opening), asNumber(r.net_effect));
    }

    let a; // account with deposits, withdrawals, interest and a reversal
    let reversalDay;

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        await client.query("BEGIN");

        adultPlanId = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0]?.plan_id;
        channelId = (await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'")).rows[0]?.channel_id;
        agent = (await client.query("SELECT agent_id, branch_id FROM agent WHERE status = 'ACTIVE' ORDER BY employee_no LIMIT 1")).rows[0];
        assert.ok(adultPlanId && channelId && agent, "seeded plan, channel and agent are required");
        otherBranchId = (await client.query("SELECT branch_id FROM branch WHERE branch_id <> $1 LIMIT 1", [agent.branch_id])).rows[0].branch_id;

        // Account A: 03-01 deposit 1000 | 03-02 withdraw 200 | 03-03 deposit 500 | 03-04 interest 30
        //           | 03-05 withdraw 100 | 03-06 reversal of the 03-05 withdrawal. Balance now 1330.
        a = await openAccount("1330.00");
        await post(a, "DEPOSIT", "1000.00", "1000.00", 1);
        await post(a, "WITHDRAWAL", "200.00", "800.00", 2);
        await post(a, "DEPOSIT", "500.00", "1300.00", 3);
        await post(a, "INTEREST_CREDIT", "30.00", "1330.00", 4);
        const withdrawal = await post(a, "WITHDRAWAL", "100.00", "1230.00", 5);
        reversalDay = await post(a, "REVERSAL", "100.00", "1330.00", 6);
        await reverse(withdrawal, reversalDay);
    });

    after(async () => {
        await client.query("ROLLBACK");
        await client.end();
    });

    test("1. The view exposes the documented columns, caller RLS applies, and mims_app can read it", async () => {
        const cols = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'vw_rpt02_account_summary' ORDER BY ordinal_position",
        );
        assert.deepEqual(cols.rows.map((r) => r.column_name), [
            "account_id", "account_number", "branch_id", "plan_id", "plan_name", "account_status", "current_balance", "opened_date",
            "transaction_id", "ledger_seq", "transaction_type", "activity_type", "amount", "effective_amount", "balance_effect",
            "transaction_date", "balance_after", "balance_after_effective", "balance_before",
        ]);
        const meta = await client.query("SELECT reloptions FROM pg_class WHERE relname = 'vw_rpt02_account_summary'");
        assert.ok(meta.rows[0].reloptions.includes("security_invoker=true"));
        assert.ok(meta.rows[0].reloptions.includes("security_barrier=true"));
        const grant = await client.query("SELECT has_table_privilege('mims_app', 'vw_rpt02_account_summary', 'SELECT') AS ok");
        assert.equal(grant.rows[0].ok, true);
    });

    test("2. One row per ledger event, in ledger terms: type, signed effect and net-of-reversal category", async () => {
        const rows = (await client.query(
            `SELECT transaction_type, activity_type, amount::text, effective_amount::text, balance_effect::text,
                    balance_before::text, balance_after_effective::text
               FROM vw_rpt02_account_summary WHERE account_id = $1 ORDER BY ledger_seq`, [a],
        )).rows;
        assert.deepEqual(rows.map((r) => [r.transaction_type, r.activity_type, r.effective_amount, r.balance_effect, r.balance_before, r.balance_after_effective]), [
            ["DEPOSIT", "DEPOSIT", "1000.00", "1000.00", "0.00", "1000.00"],
            ["WITHDRAWAL", "WITHDRAWAL", "200.00", "-200.00", "1000.00", "800.00"],
            ["DEPOSIT", "DEPOSIT", "500.00", "500.00", "800.00", "1300.00"],
            ["INTEREST_CREDIT", "INTEREST_CREDIT", "30.00", "30.00", "1300.00", "1330.00"],
            ["WITHDRAWAL", "WITHDRAWAL", "100.00", "-100.00", "1330.00", "1230.00"],
            // the reversal belongs to its original's category, with a negated amount, and gives the money back
            ["REVERSAL", "WITHDRAWAL", "-100.00", "100.00", "1230.00", "1330.00"],
        ]);
    });

    test("3. Whole range: opening, closing and category totals agree (reversal netted into withdrawals)", async () => {
        const r = await range(a, "2025-03-01", "2025-03-06");
        assert.deepEqual(r, { opening: "0.00", closing: "1330.00", deposits: "1500.00", withdrawals: "200.00", interest: "30.00", net_effect: "1330.00" });
        assertIdentity(r);
    });

    test("4. A middle range uses the balance just before its first row and the last row inside it", async () => {
        const r = await range(a, "2025-03-03", "2025-03-04");
        assert.deepEqual(r, { opening: "800.00", closing: "1330.00", deposits: "500.00", withdrawals: "0.00", interest: "30.00", net_effect: "530.00" });
        assertIdentity(r);
    });

    test("5. A single day with a withdrawal, and the day of its reversal, each reconcile", async () => {
        const day5 = await range(a, "2025-03-05", "2025-03-05");
        assert.deepEqual(day5, { opening: "1330.00", closing: "1230.00", deposits: "0.00", withdrawals: "100.00", interest: "0.00", net_effect: "-100.00" });
        assertIdentity(day5);
        const day6 = await range(a, "2025-03-06", "2025-03-06");
        assert.deepEqual(day6, { opening: "1230.00", closing: "1330.00", deposits: "0.00", withdrawals: "-100.00", interest: "0.00", net_effect: "100.00" });
        assertIdentity(day6);
    });

    test("6. No transactions in the range: opening equals closing, before the first row and after the last", async () => {
        const before = await range(a, "2025-02-01", "2025-02-10");
        assert.equal(before.opening, "0.00"); assert.equal(before.closing, "0.00"); assertIdentity(before);
        const after = await range(a, "2025-04-01", "2025-04-30");
        assert.equal(after.opening, "1330.00"); assert.equal(after.closing, "1330.00"); assertIdentity(after);
        assert.deepEqual([after.deposits, after.withdrawals, after.interest], ["0.00", "0.00", "0.00"]);
    });

    test("7. An account with no ledger rows still appears once, and its balance is unchanged", async () => {
        const d = await openAccount("250.00");
        const rows = (await client.query("SELECT transaction_id, balance_after_effective FROM vw_rpt02_account_summary WHERE account_id = $1", [d])).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].transaction_id, null); assert.equal(rows[0].balance_after_effective, null);
        const r = await range(d, "2025-03-01", "2025-03-31");
        assert.deepEqual(r, { opening: "250.00", closing: "250.00", deposits: "0.00", withdrawals: "0.00", interest: "0.00", net_effect: "0.00" });
    });

    test("8. Legacy NULL balance_after (an opening deposit written before 0541) is derived, and the rest is untouched", async () => {
        const b = await openAccount("600.00");
        await post(b, "DEPOSIT", "700.00", null, 1);
        await post(b, "DEPOSIT", "300.00", "1000.00", 2);
        await post(b, "WITHDRAWAL", "400.00", "600.00", 3);
        const rows = (await client.query(
            `SELECT balance_after::text AS stored, balance_after_effective::text AS effective, balance_before::text AS before
               FROM vw_rpt02_account_summary WHERE account_id = $1 ORDER BY ledger_seq`, [b])).rows;
        assert.deepEqual(rows, [
            { stored: null, effective: "700.00", before: "0.00" },
            { stored: "1000.00", effective: "1000.00", before: "700.00" },
            { stored: "600.00", effective: "600.00", before: "1000.00" },
        ]);
        const r = await range(b, "2025-03-01", "2025-03-03");
        assert.deepEqual(r, { opening: "0.00", closing: "600.00", deposits: "1000.00", withdrawals: "400.00", interest: "0.00", net_effect: "600.00" });
        assertIdentity(r);
    });

    test("9. The stored balance_after wins: a balance that began outside the ledger is not rebuilt from the ledger sum", async () => {
        const c = await openAccount("600.00");           // 500.00 existed before any ledger row
        await post(c, "DEPOSIT", "100.00", "600.00", 1);
        const row = (await client.query(
            "SELECT balance_after_effective::text AS effective, balance_before::text AS before FROM vw_rpt02_account_summary WHERE account_id = $1", [c])).rows[0];
        assert.deepEqual(row, { effective: "600.00", before: "500.00" });
        const r = await range(c, "2025-03-01", "2025-03-01");
        assert.deepEqual([r.opening, r.closing], ["500.00", "600.00"]);
        assertIdentity(r);
    });

    test("10. Account columns come from the account and its plan", async () => {
        const row = (await client.query(
            `SELECT account_number, branch_id, plan_id, plan_name, account_status, current_balance::text AS balance
               FROM vw_rpt02_account_summary WHERE account_id = $1 LIMIT 1`, [a])).rows[0];
        assert.equal(row.account_number, `${PREFIX}1`);
        assert.equal(row.branch_id, agent.branch_id);
        assert.equal(row.plan_id, adultPlanId);
        assert.equal(row.plan_name, "Adult");
        assert.equal(row.account_status, "ACTIVE");
        assert.equal(row.balance, "1330.00");
    });

    test("11. As mims_app under RLS: an in-scope manager sees the account, another branch or no context sees nothing", async () => {
        const scope = (branchId, role = "BRANCH_MANAGER") =>
            client.query(
                `SELECT set_config('app.current_user_id', $1, true), set_config('app.current_branch_id', $2, true),
                        set_config('app.current_user_role', $3, true)`,
                [agent.agent_id, branchId, role],
            );
        const visible = async () => (await client.query("SELECT count(*)::int AS n FROM vw_rpt02_account_summary WHERE account_id = $1", [a])).rows[0].n;
        await client.query("SAVEPOINT as_app");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            await scope(agent.branch_id);
            assert.equal(await visible(), 6, "all six ledger rows are visible in the manager's own branch");
            await scope(otherBranchId);
            assert.equal(await visible(), 0);
            await scope("", "");
            assert.equal(await visible(), 0);
        } finally {
            await client.query("RESET ROLE");
            await client.query("ROLLBACK TO SAVEPOINT as_app");
        }
    });

    test("12. 0541: sp_open_savings_account now records balance_after on the opening deposit (and the view reads it, not a derivation)", async () => {
        await client.query(
            `INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
             VALUES ((now() AT TIME ZONE 'Asia/Colombo')::date, true, '00:00', '23:59:59', 'TEST-RPT02 calendar')
             ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = true, open_time = '00:00', close_time = '23:59:59'`,
        );
        seq += 1;
        const customer = (await client.query(
            `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
             VALUES ($1, $2, $3, 'Test RPT02 Holder', DATE '1990-01-01', $4) RETURNING customer_id`,
            [agent.branch_id, `${PREFIX}C${seq}`, `${PREFIX}NIC-${seq}`, `${PREFIX.toLowerCase()}c${seq}@example.test`],
        )).rows[0].customer_id;
        await client.query(
            `INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date)
             VALUES ($1, 'NIC', '/synthetic/test.pdf', $2, now())`,
            [customer, agent.agent_id],
        );
        await client.query("SELECT set_config('app.current_user_id', $1, true)", [agent.agent_id]);
        const opened = (await client.query(
            `CALL sp_open_savings_account($1::uuid, $2::uuid, $3::uuid, $4::jsonb, NULL, 1500.00::numeric, $5::uuid, $6::uuid, NULL, NULL, NULL)`,
            [adultPlanId, agent.branch_id, agent.agent_id, JSON.stringify([{ customer_id: customer, holder_type: "PRIMARY" }]), channelId, agent.agent_id],
        )).rows[0];
        const ledger = (await client.query(
            "SELECT transaction_type, amount::text, balance_after::text FROM transaction WHERE account_id = $1", [opened.p_account_id])).rows;
        assert.deepEqual(ledger, [{ transaction_type: "DEPOSIT", amount: "1500.00", balance_after: "1500.00" }]);

        const viewRow = (await client.query(
            "SELECT balance_after::text AS stored, balance_after_effective::text AS effective, balance_before::text AS before FROM vw_rpt02_account_summary WHERE account_id = $1",
            [opened.p_account_id])).rows[0];
        assert.deepEqual(viewRow, { stored: "1500.00", effective: "1500.00", before: "0.00" });

        // The next posting continues from the stored balance, so the chain is unbroken.
        await client.query(
            "CALL sp_post_deposit($1::uuid, 250.00::numeric, $2::uuid, $3::uuid, NULL, 'test', NULL, NULL, NULL, NULL)",
            [opened.p_account_id, channelId, agent.agent_id],
        );
        // Both postings run inside this one test transaction, so they share now(); ledger_seq (0542) still
        // orders them as they were posted.
        const chain = (await client.query(
            "SELECT balance_before::text AS before, balance_after_effective::text AS after FROM vw_rpt02_account_summary WHERE account_id = $1 ORDER BY ledger_seq",
            [opened.p_account_id])).rows;
        assert.deepEqual(chain, [{ before: "0.00", after: "1500.00" }, { before: "1500.00", after: "1750.00" }]);
    });

    test("13. 0541 changed only the opening deposit: the procedure keeps its signature, invoker rights and the zero-deposit path", async () => {
        const meta = (await client.query(
            `SELECT pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef FROM pg_proc p WHERE p.proname = 'sp_open_savings_account'`)).rows;
        assert.equal(meta.length, 1);
        assert.equal(meta[0].prosecdef, false);
        assert.match(meta[0].args, /IN p_plan_id uuid, IN p_branch_id uuid, IN p_opened_by_agent_id uuid, IN p_holders jsonb, IN p_mandate jsonb, IN p_initial_deposit numeric, IN p_channel_id uuid, IN p_actor_user_id uuid, OUT p_account_id uuid, OUT p_account_number character varying, OUT p_current_balance numeric/);
        seq += 1;
        const customer = (await client.query(
            `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, email)
             VALUES ($1, $2, $3, 'Test RPT02 Empty', DATE '1990-01-01', $4) RETURNING customer_id`,
            [agent.branch_id, `${PREFIX}C${seq}`, `${PREFIX}NIC-${seq}`, `${PREFIX.toLowerCase()}c${seq}@example.test`],
        )).rows[0].customer_id;
        await client.query(
            "INSERT INTO customer_document (customer_id, doc_type, file_path, verified_by, verified_date) VALUES ($1, 'NIC', '/synthetic/test.pdf', $2, now())",
            [customer, agent.agent_id],
        );
        const empty = (await client.query(
            `CALL sp_open_savings_account($1::uuid, $2::uuid, $3::uuid, $4::jsonb, NULL, NULL, NULL, $5::uuid, NULL, NULL, NULL)`,
            [adultPlanId, agent.branch_id, agent.agent_id, JSON.stringify([{ customer_id: customer, holder_type: "PRIMARY" }]), agent.agent_id],
        )).rows[0];
        const rows = (await client.query("SELECT count(*)::int AS n FROM transaction WHERE account_id = $1", [empty.p_account_id])).rows[0].n;
        assert.equal(rows, 0, "no deposit, no ledger row");
    });

    test("14. Ties: rows posted with the SAME timestamp keep their posting order (ledger_seq), so the balance chain holds", async () => {
        const t = await openAccount("120.00");
        await post(t, "DEPOSIT", "100.00", "100.00", 1);
        await post(t, "DEPOSIT", "50.00", "150.00", 1);
        await post(t, "WITHDRAWAL", "30.00", "120.00", 1);
        const rows = (await client.query(
            `SELECT balance_before::text AS before, balance_after_effective::text AS after, count(*) OVER (PARTITION BY transaction_date) AS tied
               FROM vw_rpt02_account_summary WHERE account_id = $1 ORDER BY ledger_seq`, [t])).rows;
        assert.deepEqual(rows.map((r) => [r.before, r.after]), [["0.00", "100.00"], ["100.00", "150.00"], ["150.00", "120.00"]]);
        assert.ok(rows.every((r) => Number(r.tied) === 3), "all three rows really do share one timestamp");
        const r = await range(t, "2025-03-01", "2025-03-01");
        assert.deepEqual(r, { opening: "0.00", closing: "120.00", deposits: "150.00", withdrawals: "30.00", interest: "0.00", net_effect: "120.00" });
        assertIdentity(r);
    });

    test("15. Inversion: a row posted LATER but stamped EARLIER (deposit that waited for the account lock) is still last", async () => {
        const t = await openAccount("250.00");
        await post(t, "DEPOSIT", "100.00", "100.00", 5);   // posted first, stamped day 5
        await post(t, "DEPOSIT", "150.00", "250.00", 4);   // posted second, stamped day 4 (transaction start time)
        const r = await range(t, "2025-03-01", "2025-03-10");
        assert.equal(r.closing, "250.00", "ordered by timestamp the last row would be the 100.00 one");
        assert.equal(r.opening, "0.00");
        assertIdentity(r);
        const chain = (await client.query(
            "SELECT balance_before::text AS before, balance_after_effective::text AS after FROM vw_rpt02_account_summary WHERE account_id = $1 ORDER BY ledger_seq", [t])).rows;
        assert.deepEqual(chain, [{ before: "0.00", after: "100.00" }, { before: "100.00", after: "250.00" }]);
    });

    test("16. One out-of-range ledger value cannot make the view fail (no numeric(15,2) overflow cast)", async () => {
        const t = await openAccount("0.00");
        await post(t, "DEPOSIT", "9999999999999.99", null, 1);   // legacy rows: balance_after NULL, running total derived
        await post(t, "DEPOSIT", "9999999999999.99", null, 2);
        const rows = (await client.query(
            "SELECT balance_after_effective::text AS after, balance_before::text AS before FROM vw_rpt02_account_summary WHERE account_id = $1 ORDER BY ledger_seq", [t])).rows;
        assert.deepEqual(rows, [{ after: "9999999999999.99", before: "0.00" }, { after: "19999999999999.98", before: "9999999999999.99" }]);
        // and the rest of the view is still readable
        const total = await client.query("SELECT count(*)::int AS n FROM vw_rpt02_account_summary");
        assert.ok(total.rows[0].n > 0);
    });

    test("17. The view has no window function and orders by ledger_seq (so a filter on one account never walks the whole ledger)", async () => {
        const def = (await client.query("SELECT pg_get_viewdef('vw_rpt02_account_summary'::regclass, true) AS def")).rows[0].def;
        assert.doesNotMatch(def, /\bOVER\b/i, "no window function over the ledger");
        assert.doesNotMatch(def, /numeric\(15, ?2\)/i, "no overflow-prone cast");
        assert.match(def, /ledger_seq/);
    });

    test("18. Legacy running totals use ledger_seq: a NULL row in the middle is derived from the rows before it, in posting order", async () => {
        const t = await openAccount("900.00");
        await post(t, "DEPOSIT", "600.00", null, 3);        // legacy opening deposit, posted first but stamped LATER
        await post(t, "DEPOSIT", "300.00", "900.00", 2);    // posted second, stamped earlier
        const rows = (await client.query(
            "SELECT balance_after_effective::text AS after, balance_before::text AS before FROM vw_rpt02_account_summary WHERE account_id = $1 ORDER BY ledger_seq", [t])).rows;
        assert.deepEqual(rows, [{ after: "600.00", before: "0.00" }, { after: "900.00", before: "600.00" }]);
    });
});

