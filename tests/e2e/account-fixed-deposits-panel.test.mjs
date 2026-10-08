import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// The markup is produced by tests/helpers/render-account-fd-panel.mjs in a separate process (see its header).
const TSX = "node_modules/tsx/dist/cli.mjs";
const HELPER = "tests/helpers/render-account-fd-panel.mjs";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const FD_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "33333333-3333-4333-8333-333333333333";
const fd = (overrides = {}) => ({
  fdId: FD_ID, fdPlanId: PLAN_ID, planName: "1 Year", principalAmount: "2500.50", interestRateAtOpening: "0.1400",
  startDate: "2026-10-08", maturityDate: "2027-10-08", nextInterestDate: "2026-11-07", status: "ACTIVE", ...overrides,
});

const BASE = { accountId: ACCOUNT_ID, accountStatus: "ACTIVE", fixedDeposits: [], canOpenFd: true };
const CASES = {
  row: { ...BASE, fixedDeposits: [fd()], canOpenFd: false },
  active: { ...BASE, fixedDeposits: [fd()] },
  empty: { ...BASE },
  history: { ...BASE, fixedDeposits: [fd({ status: "MATURED" }), fd({ fdId: "44444444-4444-4444-8444-444444444444", status: "CLOSED" })] },
  noRight: { ...BASE, fixedDeposits: [], canOpenFd: false },
  frozen: { ...BASE, accountStatus: "FROZEN" },
  unavailable: { ...BASE, fixedDeposits: null },
};

describe("P04-M03-T03: account fixed-deposit panel markup", () => {
  let html;
  before(() => {
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    const run = spawnSync(process.execPath, [TSX, HELPER], { input: JSON.stringify(CASES), encoding: "utf8", env });
    assert.equal(run.status, 0, `render helper failed: ${run.stderr}`);
    html = JSON.parse(run.stdout);
  });

  test("a table row shows the exact product, principal, snapshot rate, dates and status", () => {
    const out = html.row;
    assert.match(out, /<th scope="row" class="font-normal">1 Year<\/th>/);
    assert.match(out, /LKR 2,500\.50/);
    assert.match(out, />14\.00%</);
    assert.match(out, /08 Oct 2026/);
    assert.match(out, /08 Oct 2027/);
    assert.match(out, /07 Nov 2026/);
    assert.match(out, /<span class="status-pill">ACTIVE<\/span>/);
    assert.match(out, /<caption class="sr-only">/);
    assert.equal((out.match(/<th scope="col">/g) ?? []).length, 7);
  });

  test("an ACTIVE deposit shows the closure note and no way to open another", () => {
    const out = html.active;
    assert.match(out, /cannot be closed until the deposit matures or is closed/);
    assert.doesNotMatch(out, /Open a fixed deposit/);
    assert.match(out, /already has an active fixed deposit/);
  });

  test("an empty ACTIVE account offers the link, and the account id appears only inside it", () => {
    const out = html.empty;
    assert.match(out, /No fixed deposits on this account\./);
    assert.match(out, new RegExp(`<a class="btn btn-primary mt-4" href="/fixed-deposits/new\\?accountId=${ACCOUNT_ID}">Open a fixed deposit</a>`));
    assert.equal(out.split(ACCOUNT_ID).length - 1, 1, "the account id is only in the link");
    assert.doesNotMatch(out, /<table/);
    assert.doesNotMatch(out, /cannot be closed/);
  });

  test("history only (MATURED, CLOSED) neither blocks closing nor opening", () => {
    const out = html.history;
    assert.doesNotMatch(out, /cannot be closed/);
    assert.match(out, /Open a fixed deposit/);
    assert.match(out, /status-pill">MATURED</);
    assert.match(out, /status-pill">CLOSED</);
  });

  test("a role without the right gets no link and no opening note", () => {
    const out = html.noRight;
    assert.doesNotMatch(out, /<a /);
    assert.doesNotMatch(out, /can only be opened|already has an active/);
  });

  test("a frozen account explains why a deposit cannot be opened", () => {
    const out = html.frozen;
    assert.doesNotMatch(out, /Open a fixed deposit/);
    assert.match(out, /only be opened from an active account/);
  });

  test("an unreadable list is reported honestly: no table, no 'no fixed deposits' claim, no link", () => {
    const out = html.unavailable;
    assert.match(out, /Fixed deposits could not be loaded\. The rest of this account is shown\./);
    assert.doesNotMatch(out, /No fixed deposits on this account/);
    assert.doesNotMatch(out, /<table/);
    assert.doesNotMatch(out, /<a /);
    assert.match(out, /unavailable right now/);
  });

  test("fixed-deposit and plan ids never reach the markup", () => {
    for (const out of Object.values(html)) assert.ok(!out.includes(FD_ID) && !out.includes(PLAN_ID));
  });
});
