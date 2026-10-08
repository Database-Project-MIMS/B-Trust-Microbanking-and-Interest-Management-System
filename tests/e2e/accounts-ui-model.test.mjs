import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_OPENING, addHolder, allowsMandate, buildOpenBody, describeError, fingerprint, holderRole, isValidDeposit,
  keyFor, makePrimary, removeHolder, reviewProblems, selectPlan,
} from "../../app/accounts/new/account-opening-model.ts";
import {
  authoritySummary, displayDate, displayMoney, displayRate, eligibilitySummary, holderAuthority, mandateSummary,
  transactionTypeLabel,
} from "../../app/accounts/account-format.ts";

const adult = { planId: "p-adult", planName: "Adult", interestRate: "0.1000", minBalance: "1000.00", description: null,
  minAgeYears: 18, maxAgeYears: 59, minHolders: 1, maxHolders: 1, requiresAllAdult: true };
const joint = { planId: "p-joint", planName: "Joint", interestRate: "0.0700", minBalance: "5000.00", description: null,
  minAgeYears: null, maxAgeYears: null, minHolders: 2, maxHolders: 4, requiresAllAdult: true };
const person = (n) => ({ customerId: `c-${n}`, customerNumber: `CUS-${n}`, fullName: `Person ${n}`, dateOfBirth: "1990-01-01" });

describe("P02-M03-T06: account display helpers", () => {
  test("money is formatted from the string, with separators and two decimals", () => {
    assert.equal(displayMoney("0.00"), "LKR 0.00");
    assert.equal(displayMoney("1500.5"), "LKR 1,500.50");
    assert.equal(displayMoney("1234567.89"), "LKR 1,234,567.89");
    assert.equal(displayMoney("5000"), "LKR 5,000.00");
    assert.equal(displayMoney("9999999999999.99"), "LKR 9,999,999,999,999.99");
  });
  test("money never turns a bad value into a number", () => {
    for (const bad of [null, undefined, "", "abc", "-5.00", "1e9", "1,000.00", "12.3.4"]) assert.equal(displayMoney(bad), "—");
  });
  test("rates shift the decimal point in text", () => {
    assert.equal(displayRate("0.1300"), "13.00%");
    assert.equal(displayRate("0.0700"), "7.00%");
    assert.equal(displayRate("0.1250"), "12.50%");
    assert.equal(displayRate("1.0000"), "100.00%");
    assert.equal(displayRate("0.0005"), "0.05%");
    assert.equal(displayRate("x"), "—");
  });
  test("dates use DD MMM YYYY in Asia/Colombo", () => {
    assert.equal(displayDate("2026-10-07"), "07 Oct 2026");
    assert.equal(displayDate("2026-12-31T20:00:00Z"), "01 Jan 2027");
    assert.equal(displayDate(null), "—");
    assert.equal(displayDate("nope"), "—");
  });
  test("mandate and eligibility text", () => {
    assert.match(mandateSummary(null), /Individual account/);
    assert.equal(mandateSummary({ mandateType: "ANY_ONE", requiredSignatories: 1 }), "Any one holder may authorise a withdrawal.");
    assert.equal(mandateSummary({ mandateType: "ALL_HOLDERS", requiredSignatories: 3 }), "All 3 holders must authorise a withdrawal.");
    assert.equal(eligibilitySummary(adult), "Age 18–59, all adult");
    assert.equal(eligibilitySummary(joint), "No age limit, 2–4 holders, all adult");
    assert.equal(eligibilitySummary({ ...adult, minAgeYears: null, maxAgeYears: 12, requiresAllAdult: false }), "Up to age 12");
  });
});

describe("P03-M03-T03: balance panel and holder authority text", () => {
  const mandate = (mandateType, requiredSignatories, state = "EFFECTIVE") => ({ mandateType, requiredSignatories, state });
  test("a sole holder may withdraw alone; several holders without a mandate are blocked", () => {
    assert.deepEqual(authoritySummary({ holderCount: 1, mandate: null }),
      { text: "Sole holder. The holder may withdraw alone.", blocked: false, stateLabel: null });
    const orphan = authoritySummary({ holderCount: 2, mandate: null });
    assert.equal(orphan.blocked, true); assert.match(orphan.text, /valid operating mandate/);
  });
  test("an effective mandate states who must sign", () => {
    const any = authoritySummary({ holderCount: 3, mandate: mandate("ANY_ONE", 1) });
    assert.deepEqual({ blocked: any.blocked, label: any.stateLabel, text: any.text },
      { blocked: false, label: "Effective", text: "Any one holder may authorise a withdrawal." });
    const all = authoritySummary({ holderCount: 3, mandate: mandate("ALL_HOLDERS", 3) });
    assert.equal(all.text, "All 3 holders must authorise a withdrawal."); assert.equal(all.blocked, false);
  });
  test("a future or expired mandate blocks withdrawals and says why", () => {
    const future = authoritySummary({ holderCount: 2, mandate: mandate("ANY_ONE", 1, "NOT_YET_EFFECTIVE") });
    assert.equal(future.blocked, true); assert.equal(future.stateLabel, "Not yet effective"); assert.match(future.text, /not yet in effect/);
    const expired = authoritySummary({ holderCount: 2, mandate: mandate("ALL_HOLDERS", 2, "EXPIRED") });
    assert.equal(expired.blocked, true); assert.equal(expired.stateLabel, "Expired"); assert.match(expired.text, /expired/);
  });
  test("holder authority follows the mandate type", () => {
    assert.equal(holderAuthority(null, 1), "Can authorise alone");
    assert.equal(holderAuthority(null, 2), "No mandate");
    assert.equal(holderAuthority({ mandateType: "ANY_ONE" }, 2), "Can authorise alone");
    assert.equal(holderAuthority({ mandateType: "ALL_HOLDERS" }, 2), "Must co-sign");
  });
  test("ledger types have plain labels and unknown ones fall back safely", () => {
    assert.equal(transactionTypeLabel("DEPOSIT"), "Deposit");
    assert.equal(transactionTypeLabel("INTEREST_CREDIT"), "Interest credit");
    assert.equal(transactionTypeLabel("SOMETHING_NEW"), "Transaction");
  });
  test("the available amount is shown as text without float rounding", () => {
    assert.equal(displayMoney("4000.00"), "LKR 4,000.00");
    assert.equal(displayMoney("0.00"), "LKR 0.00");
    assert.equal(displayMoney("9007199254740993.10"), "LKR 9,007,199,254,740,993.10");
  });
});

describe("P02-M03-T06: account opening model", () => {
  test("choosing a single-holder plan trims holders and clears the mandate", () => {
    let state = selectPlan(EMPTY_OPENING, joint);
    state = addHolder(state, joint, person(1)).state;
    state = addHolder(state, joint, person(2)).state;
    state = { ...state, mandateType: "ALL_HOLDERS" };
    state = selectPlan(state, adult);
    assert.equal(state.holders.length, 1); assert.equal(state.mandateType, ""); assert.equal(state.planId, "p-adult");
    assert.equal(selectPlan(state, undefined).planId, "");
  });
  test("holders: no duplicates, no more than the plan allows, first is primary", () => {
    let state = selectPlan(EMPTY_OPENING, adult);
    assert.equal(addHolder(state, undefined, person(1)).error, "Choose a savings plan first.");
    state = addHolder(state, adult, person(1)).state;
    assert.match(addHolder(state, adult, person(1)).error, /already a holder/);
    assert.match(addHolder(state, adult, person(2)).error, /at most 1 holder\./);
    let team = selectPlan(EMPTY_OPENING, joint);
    for (const n of [1, 2, 3, 4]) team = addHolder(team, joint, person(n)).state;
    assert.match(addHolder(team, joint, person(5)).error, /at most 4 holders/);
    assert.deepEqual([0, 1, 2].map(holderRole), ["PRIMARY", "JOINT", "JOINT"]);
    const moved = makePrimary(team, "c-3");
    assert.deepEqual(moved.holders.map(h => h.customerId), ["c-3", "c-1", "c-2", "c-4"]);
    assert.equal(makePrimary(team, "missing"), team);
    assert.equal(removeHolder(team, "c-2").holders.length, 3);
  });
  test("review is blocked until the form is usable (the server still decides)", () => {
    assert.deepEqual(reviewProblems(EMPTY_OPENING, undefined), ["Choose a savings plan."]);
    let state = selectPlan(EMPTY_OPENING, joint);
    assert.equal(reviewProblems(state, joint).length, 2);              // holders + mandate
    state = addHolder(state, joint, person(1)).state;
    assert.match(reviewProblems(state, joint).join(" "), /at least 2 holders/);
    state = addHolder(state, joint, person(2)).state;
    assert.deepEqual(reviewProblems(state, joint), ["Choose how withdrawals are authorised."]);
    state = { ...state, mandateType: "ANY_ONE" };
    assert.deepEqual(reviewProblems(state, joint), []);
    assert.equal(reviewProblems({ ...state, deposit: "12.345" }, joint).length, 1);
    assert.equal(allowsMandate(adult), false); assert.equal(allowsMandate(undefined), false);
  });
  test("deposit text must be a plain amount; it is never converted to a number", () => {
    for (const ok of ["", "  ", "0", "1000", "1000.5", "1000.50", "9999999999999.99"]) assert.equal(isValidDeposit(ok), true, ok);
    for (const bad of ["1000.001", "-5", "1e3", "1,000", "abc", "10000000000000", ".5"]) assert.equal(isValidDeposit(bad), false, bad);
  });
  test("the request body matches the API contract", () => {
    let state = selectPlan(EMPTY_OPENING, joint);
    for (const n of [1, 2]) state = addHolder(state, joint, person(n)).state;
    state = { ...state, mandateType: "ALL_HOLDERS", deposit: " 5000.00 " };
    assert.deepEqual(buildOpenBody(state, joint, "b-1"), {
      planId: "p-joint", branchId: "b-1",
      holders: [{ customerId: "c-1", holderType: "PRIMARY" }, { customerId: "c-2", holderType: "JOINT" }],
      mandate: { type: "ALL_HOLDERS" }, initialDeposit: "5000.00",
    });
    const single = addHolder(selectPlan(EMPTY_OPENING, adult), adult, person(1)).state;
    const body = buildOpenBody({ ...single, mandateType: "ANY_ONE" }, adult, "b-1");
    assert.equal("mandate" in body, false); assert.equal("initialDeposit" in body, false);
    assert.equal(typeof buildOpenBody({ ...single, deposit: "1500.50" }, adult, "b-1").initialDeposit, "string");
  });
  test("the idempotency key is kept for an identical retry and replaced when the request changes", () => {
    const single = addHolder(selectPlan(EMPTY_OPENING, adult), adult, person(1)).state;
    let n = 0; const generate = () => `key-${++n}`;
    const first = keyFor(null, buildOpenBody(single, adult, "b"), generate);
    const retry = keyFor(first, buildOpenBody(single, adult, "b"), generate);
    assert.equal(retry.key, first.key); assert.equal(n, 1);
    const changed = keyFor(retry, buildOpenBody({ ...single, deposit: "2000.00" }, adult, "b"), generate);
    assert.notEqual(changed.key, first.key);
    assert.notEqual(fingerprint(buildOpenBody(single, adult, "b")), fingerprint(buildOpenBody({ ...single, deposit: "1" }, adult, "b")));
    assert.match(keyFor(null, buildOpenBody(single, adult, "b")).key, /^acct-[0-9a-f-]{36}$/);
  });
  test("API errors are routed to a field, and a reused key asks for a fresh one", () => {
    assert.equal(describeError({ code: "BELOW_MINIMUM_BALANCE", message: "m" }).field, "deposit");
    assert.equal(describeError({ code: "DOCUMENTS_NOT_VERIFIED", message: "m" }).field, "holders");
    assert.equal(describeError({ code: "MANDATE_REQUIRED", message: "m" }).field, "mandate");
    assert.equal(describeError({ code: "PLAN_NOT_FOUND", message: "m" }).field, "plan");
    assert.deepEqual(describeError({ code: "SOMETHING_NEW", message: "Shown as is." }), { field: "general", message: "Shown as is.", newKey: false });
    const reused = describeError({ code: "IDEMPOTENCY_KEY_REUSED", message: "technical" });
    assert.equal(reused.newKey, true); assert.doesNotMatch(reused.message, /technical/);
  });
});
