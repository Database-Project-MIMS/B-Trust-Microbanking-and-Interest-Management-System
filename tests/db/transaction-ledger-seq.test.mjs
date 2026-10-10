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
const PREFIX = "TEST-SEQ-";

// One rolled-back transaction: nothing is committed, so the immutable ledger stays free of test debris.
describe("P05-M03-T01 / G-24: transaction.ledger_seq (posting order)", () => {
    let client;
    let agent;
    let planId;
    let channelId;
    let seq = 0;

    async function openAccount() {
        seq += 1;
        const res = await client.query(
            `INSERT INTO account (plan_id, branch_id, opened_by_agent_id, account_number)
             VALUES ($1, $2, $3, $4) RETURNING account_id`,
            [planId, agent.branch_id, agent.agent_id, `${PREFIX}${seq}`],
        );
        return res.rows[0].account_id;
    }

    async function insertDeposit(accountId, amount, transactionDate) {
        seq += 1;
        const res = await client.query(
            `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, transaction_date)
             VALUES ($1, $2, $3, $4, 'DEPOSIT', $5, COALESCE($6::timestamptz, now())) RETURNING transaction_id, ledger_seq::text AS ledger_seq`,
            [accountId, agent.agent_id, channelId, `${PREFIX}REF-${seq}`, amount, transactionDate],
        );
        return res.rows[0];
    }

    before(async () => {
        client = new pg.Client({ connectionString });
        await client.connect();
        await client.query("BEGIN");
        planId = (await client.query("SELECT plan_id FROM savings_plan WHERE plan_name = 'Adult'")).rows[0]?.plan_id;
        channelId = (await client.query("SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER'")).rows[0]?.channel_id;
        agent = (await client.query("SELECT a.agent_id,a.branch_id FROM agent a JOIN app_user u ON u.user_id=a.agent_id JOIN role r USING(role_id) JOIN branch b ON b.branch_id=a.branch_id WHERE a.status='ACTIVE' AND u.status='ACTIVE' AND r.status='ACTIVE' AND b.status='ACTIVE' AND r.role_name='AGENT' ORDER BY a.employee_no LIMIT 1")).rows[0];
        assert.ok(planId && channelId && agent, "seeded plan, channel and agent are required");
    });

    after(async () => {
        await client.query("ROLLBACK");
        await client.end();
    });

    test("1. The column is bigint NOT NULL with a sequence default, and (account_id, ledger_seq) is unique", async () => {
        const col = (await client.query(
            `SELECT data_type, is_nullable, column_default FROM information_schema.columns
              WHERE table_name = 'transaction' AND column_name = 'ledger_seq'`)).rows[0];
        assert.equal(col.data_type, "bigint");
        assert.equal(col.is_nullable, "NO");
        assert.match(col.column_default, /nextval\('transaction_ledger_seq'/);
        const idx = (await client.query(
            `SELECT indexdef FROM pg_indexes WHERE indexname = 'ux_transaction_account_ledger_seq'`)).rows[0];
        assert.match(idx.indexdef, /UNIQUE INDEX .* \(account_id, ledger_seq\)/);
    });

    test("2. Rows inserted without naming ledger_seq get strictly increasing values, even with an identical timestamp", async () => {
        const a = await openAccount();
        const stamp = "2025-03-01T10:00:00+05:30";
        const first = await insertDeposit(a, "10.00", stamp);
        const second = await insertDeposit(a, "20.00", stamp);
        const third = await insertDeposit(a, "30.00", stamp);
        assert.ok(BigInt(first.ledger_seq) < BigInt(second.ledger_seq) && BigInt(second.ledger_seq) < BigInt(third.ledger_seq));
    });

    test("3. A later posting stamped EARLIER still gets the larger ledger_seq", async () => {
        const a = await openAccount();
        const posted1 = await insertDeposit(a, "10.00", "2025-03-05T10:00:00+05:30");
        const posted2 = await insertDeposit(a, "20.00", "2025-03-04T10:00:00+05:30");
        assert.ok(BigInt(posted2.ledger_seq) > BigInt(posted1.ledger_seq));
    });

    test("4. The real posting routines fill it with no change: sp_post_deposit, run as mims_app, increases it per posting", async () => {
        await client.query(
            `INSERT INTO business_calendar (calendar_date, is_business_day, open_time, close_time, description)
             VALUES ((now() AT TIME ZONE 'Asia/Colombo')::date, true, '00:00', '23:59:59', 'TEST-SEQ calendar')
             ON CONFLICT (calendar_date) DO UPDATE SET is_business_day = true, open_time = '00:00', close_time = '23:59:59'`);
        const a = await openAccount();
        await client.query("SELECT set_config('app.current_user_id', $1, true), set_config('app.current_branch_id', $2, true), set_config('app.current_user_role', 'AGENT', true)",
            [agent.agent_id, agent.branch_id]);
        await client.query("SAVEPOINT as_app");
        try {
            await client.query("SET LOCAL ROLE mims_app");
            await client.query("CALL sp_post_deposit($1::uuid, 100.00::numeric, $2::uuid, $3::uuid, NULL, 'one', NULL, NULL, NULL, NULL)", [a, channelId, agent.agent_id]);
            await client.query("CALL sp_post_deposit($1::uuid, 200.00::numeric, $2::uuid, $3::uuid, NULL, 'two', NULL, NULL, NULL, NULL)", [a, channelId, agent.agent_id]);
            const rows = (await client.query("SELECT amount::text AS amount, ledger_seq::text AS ledger_seq FROM transaction WHERE account_id = $1 ORDER BY ledger_seq", [a])).rows;
            assert.deepEqual(rows.map((r) => r.amount), ["100.00", "200.00"]);
            assert.ok(BigInt(rows[0].ledger_seq) < BigInt(rows[1].ledger_seq));
        } finally {
            await client.query("ROLLBACK TO SAVEPOINT as_app");
            await client.query("RESET ROLE");
        }
    });

    test("5. mims_app has USAGE on the sequence (the default runs with the inserting role) and the ledger stays immutable", async () => {
        const grant = await client.query("SELECT has_sequence_privilege('mims_app', 'transaction_ledger_seq', 'USAGE') AS ok");
        assert.equal(grant.rows[0].ok, true);
        const a = await openAccount();
        const row = await insertDeposit(a, "5.00", null);
        await client.query("SAVEPOINT immut");
        await assert.rejects(
            client.query("UPDATE transaction SET ledger_seq = ledger_seq + 1 WHERE transaction_id = $1", [row.transaction_id]),
            (error) => /TRANSACTION_IMMUTABLE/.test(error.message),
        );
        await client.query("ROLLBACK TO SAVEPOINT immut");
    });

    test("6. A duplicate (account_id, ledger_seq) is rejected by the database", async () => {
        const a = await openAccount();
        const row = await insertDeposit(a, "5.00", null);
        await client.query("SAVEPOINT dup");
        await assert.rejects(
            client.query(
                `INSERT INTO transaction (account_id, initiated_by_user_id, channel_id, reference_number, transaction_type, amount, ledger_seq)
                 VALUES ($1, $2, $3, $4, 'DEPOSIT', 1.00, $5)`,
                [a, agent.agent_id, channelId, `${PREFIX}DUP-${++seq}`, row.ledger_seq],
            ),
            (error) => error.code === "23505" && error.constraint === "ux_transaction_account_ledger_seq",
        );
        await client.query("ROLLBACK TO SAVEPOINT dup");
    });

    test("7. The 0542 backfill technique numbers existing rows in insertion order (ADD COLUMN with a volatile default rewrites in physical order)", async () => {
        await client.query("CREATE TEMP SEQUENCE probe_seq");
        await client.query("CREATE TEMP TABLE probe_ledger (id serial PRIMARY KEY, note text, at timestamptz)");
        // inserted in this order, with timestamps that disagree with it
        await client.query("INSERT INTO probe_ledger (note, at) VALUES ('first', '2025-03-09'), ('second', '2025-03-01'), ('third', '2025-03-05')");
        await client.query("ALTER TABLE probe_ledger ADD COLUMN seq bigint NOT NULL DEFAULT nextval('probe_seq')");
        const rows = (await client.query("SELECT note FROM probe_ledger ORDER BY seq")).rows.map((r) => r.note);
        assert.deepEqual(rows, ["first", "second", "third"]);
    });
});
