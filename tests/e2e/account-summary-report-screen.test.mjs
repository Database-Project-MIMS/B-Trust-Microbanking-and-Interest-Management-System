import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const TSX = "node_modules/tsx/dist/cli.mjs";
const HELPER = "tests/helpers/render-report-screens.mjs";

const BRANCH_A = "11111111-1111-4111-8111-111111111111";
const BRANCH_B = "22222222-2222-4222-8222-222222222222";
const PLAN = "33333333-3333-4333-8333-333333333333";
const ACCOUNT = "44444444-4444-4444-8444-444444444444";

const row = {
  accountId: ACCOUNT, accountNumber: "COL-00000001", branchId: BRANCH_A, branchName: "COL — Colombo", planName: "Adult",
  accountStatus: "ACTIVE", openingBalance: "1000.00", closingBalance: "1330.00", depositCount: "1", depositTotal: "500.00",
  withdrawalCount: "1", withdrawalTotal: "200.00", interestCount: "1", interestTotal: "30.00", reversalCount: "0", netMovement: "330.00",
};
const totals = {
  openingBalance: "1000.00", closingBalance: "1330.00", depositCount: "1", depositTotal: "500.00", withdrawalCount: "1",
  withdrawalTotal: "200.00", interestCount: "1", interestTotal: "30.00", reversalCount: "0", netMovement: "330.00",
};
const result = (overrides = {}) => ({
  reportName: "account-summary", rows: [row], subtotals: totals, grandTotal: { ...totals, openingBalance: "9999.00" },
  filters: { from: "2026-10-01", to: "2026-10-02", format: "json", page: 1, pageSize: 25, sort: "closingBalance", direction: "desc" },
  generatedAt: "2026-10-08T10:00:00.000Z", requestedBy: "auditor_one", totalRows: 1, page: 1, pageSize: 25, ...overrides,
});
const baseShell = { title: "Account summary", filters: { format: "json" }, onFilterChange: () => undefined };
const choices = { branches: [{ id: BRANCH_A, name: "COL — Colombo" }, { id: BRANCH_B, name: "KAN — Kandy" }],
  plans: [{ id: PLAN, name: "Adult" }], branchId: null };

const CASES = {
  full: { component: "shell", props: { ...baseShell, result: result(), columns: [
    { key: "accountNumber", label: "Account", kind: "text" }, { key: "openingBalance", label: "Opening balance", kind: "money" },
    { key: "depositCount", label: "Deposits (count)", kind: "count" }, { key: "closingBalance", label: "Closing balance", kind: "money" }],
    caption: "Account summary: page details, page subtotal and full-filter grand total",
    emptyText: "No accounts match these filters.", sortLabels: { closingBalance: "Closing balance" } } },
  empty: { component: "shell", props: { ...baseShell, result: result({ rows: [], totalRows: 0 }), columns: [
    { key: "accountNumber", label: "Account", kind: "text" }, { key: "closingBalance", label: "Closing balance", kind: "money" }],
    emptyText: "No accounts match these filters. Grand totals still cover all applied filters." } },
  rpt01Defaults: { component: "shell", props: { ...baseShell, result: result({ rows: [], totalRows: 0 }), columns: [
    { key: "accountNumber", label: "Account", kind: "text" }] } },
  rpt01Sort: { component: "shell", props: { ...baseShell, result: result({ filters: { from: "2026-10-01", to: "2026-10-02", format: "json", sort: "netTotal", direction: "asc" } }),
    columns: [{ key: "accountNumber", label: "Account", kind: "text" }] } },
  bankwide: { component: "account-summary", props: { choices, today: "2026-10-08" } },
  manager: { component: "account-summary", props: { choices: { ...choices, branches: [choices.branches[0]], branchId: BRANCH_A }, today: "2026-10-08" } },
};

describe("P05-M03-T02: RPT-02 screen and the shared report components", () => {
  let html;
  before(() => {
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    const run = spawnSync(process.execPath, [TSX, HELPER], { input: JSON.stringify(CASES), encoding: "utf8", env });
    assert.equal(run.status, 0, `render helper failed: ${run.stderr}`);
    html = JSON.parse(run.stdout);
  });

  test("the table shows exact money, a row header, then a page subtotal and the grand total of ALL filtered accounts", () => {
    const out = html.full;
    assert.match(out, /<th scope="row">COL-00000001<\/th>/);
    assert.match(out, /LKR 1,000\.00/);
    assert.match(out, /LKR 1,330\.00/);
    assert.match(out, /Page subtotal/);
    assert.match(out, /Grand total · all applied filters/);
    assert.match(out, /LKR 9,999\.00/, "the grand total row is separate from the page subtotal");
    assert.match(out, /<caption class="sr-only">Account summary: page details/);
  });

  test("the metadata shows the period, who asked, and this report's own sort label", () => {
    const out = html.full;
    assert.match(out, /2026-10-01 to 2026-10-02/);
    assert.match(out, /auditor_one/);
    assert.match(out, /Closing balance · Descending/);
    assert.match(out, /Export CSV/);
  });

  test("the empty state uses this report's text and still shows the totals", () => {
    assert.match(html.empty, /No accounts match these filters\. Grand totals still cover all applied filters\./);
    assert.match(html.empty, /Grand total · all applied filters/);
    assert.doesNotMatch(html.empty, /agent rows/i);
  });

  test("RPT-01's defaults are unchanged: its caption, empty text and sort names still apply when none are passed", () => {
    assert.match(html.rpt01Defaults, /<caption class="sr-only">Agent transactions: page details, page subtotal and full-filter grand total<\/caption>/);
    assert.match(html.rpt01Defaults, /No agent rows on this page\. Grand totals still cover all applied filters\./);
    assert.match(html.rpt01Sort, /Net movement · Ascending/);
  });

  test("a bank-wide user can pick any branch, plan, status and sort; the period defaults to today", () => {
    const out = html.bankwide;
    assert.match(out, /Account summary/);
    assert.match(out, /RPT-02/);
    assert.match(out, /type="date"[^>]*value="2026-10-08"/);
    assert.match(out, /<option value=""[^>]*>All branches<\/option>/);
    assert.match(out, /COL — Colombo/); assert.match(out, /KAN — Kandy/);
    assert.match(out, /<option value=""[^>]*>All plans<\/option>/); assert.match(out, />Adult</);
    for (const status of ["Active", "Frozen", "Closed"]) assert.match(out, new RegExp(`>${status}<`));
    for (const label of ["Account number", "Opening balance", "Closing balance", "Net movement"]) assert.match(out, new RegExp(`>${label}<`));
    assert.doesNotMatch(out, /Posting branch|Agent/, "the agent-report filters are not shown");
    assert.doesNotMatch(out, /Export CSV/, "no export before a report has been generated");
  });

  test("a branch manager's branch is fixed: only their branch is offered and it cannot be changed", () => {
    const out = html.manager;
    assert.doesNotMatch(out, /All branches/);
    assert.doesNotMatch(out, /KAN — Kandy/);
    assert.match(out, /<select[^>]*disabled[^>]*>\s*<option[^>]*value="11111111-1111-4111-8111-111111111111"[^>]*>COL — Colombo/);
  });

  test("no internal key or ledger detail leaks into the screen markup", () => {
    for (const out of Object.values(html)) assert.doesNotMatch(out, /ledger_?seq|vw_rpt02/i);
  });
});
