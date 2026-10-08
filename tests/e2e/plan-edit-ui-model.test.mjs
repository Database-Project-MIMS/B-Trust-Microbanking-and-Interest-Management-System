import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { diffDraft, draftFromPlan, validateDraft } from "../../app/plans/plan-edit-model.ts";
import { nextFocusIndex } from "../../app/plans/dialog-focus.ts";

const plan = {
  planId: "p1", planName: "Teen", interestRate: "0.1100", minBalance: "500.00", description: "Teen plan", status: "ACTIVE",
  minAgeYears: 13, maxAgeYears: 17, minHolders: 1, maxHolders: 1, requiresAllAdult: false, createdAt: new Date(), updatedAt: null,
};
const draft = (over = {}) => ({ ...draftFromPlan(plan), ...over });

describe("P02-M03-T06: savings plan edit rules", () => {
  test("an unchanged draft is valid and produces an empty change set", () => {
    assert.deepEqual(validateDraft(draft()), {});
    assert.deepEqual(diffDraft(plan, draft()), {});
  });

  test("a typo in an age field is an error and can never clear the limit (regression: NaN became null)", () => {
    for (const bad of ["abc", "1x", "-3", "1.5", "121", "9999", " "]) {
      const errors = validateDraft(draft({ minAgeYears: bad }));
      if (bad.trim() === "") assert.deepEqual(errors, {}, "blank means no limit");
      else assert.ok(errors.minAgeYears, `minAgeYears ${JSON.stringify(bad)} must be rejected`);
    }
    const typo = draft({ minAgeYears: "abc", maxAgeYears: "x7" });
    const body = diffDraft(plan, typo);
    assert.equal("minAgeYears" in body, false); assert.equal("maxAgeYears" in body, false);
    assert.doesNotMatch(JSON.stringify(body), /null/);
  });

  test("clearing an age limit on purpose still works, and numbers are real numbers", () => {
    assert.deepEqual(diffDraft(plan, draft({ minAgeYears: "" })), { minAgeYears: null });
    assert.deepEqual(diffDraft(plan, draft({ minAgeYears: "14", maxAgeYears: "16" })), { minAgeYears: 14, maxAgeYears: 16 });
  });

  test("age and holder ranges must be consistent", () => {
    assert.ok(validateDraft(draft({ minAgeYears: "20", maxAgeYears: "10" })).maxAgeYears);
    assert.ok(validateDraft(draft({ minHolders: "3", maxHolders: "2" })).maxHolders);
    assert.deepEqual(validateDraft(draft({ minAgeYears: "", maxAgeYears: "" })), {});
    for (const bad of ["", "0", "21", "two", "1.5"]) assert.ok(validateDraft(draft({ maxHolders: bad })).maxHolders, bad);
  });

  test("rates and balances stay strings and are checked as text", () => {
    for (const ok of ["0.1300", "0.07", "1", "1.0000", "0.0001"]) assert.deepEqual(validateDraft(draft({ interestRate: ok })), {}, ok);
    for (const bad of ["", "0", "0.0000", "1.5", "13", "abc", "0.12345", ".5", "-0.1"]) assert.ok(validateDraft(draft({ interestRate: bad })).interestRate, bad);
    for (const ok of ["0", "0.00", "1000", "1000.5", "9999999999999.99"]) assert.deepEqual(validateDraft(draft({ minBalance: ok })), {}, ok);
    for (const bad of ["", "-1", "1,000", "1.234", "abc", "1e3"]) assert.ok(validateDraft(draft({ minBalance: bad })).minBalance, bad);
    const body = diffDraft(plan, draft({ interestRate: " 0.1200 ", minBalance: "750.50" }));
    assert.deepEqual(body, { interestRate: "0.1200", minBalance: "750.50" });
    assert.equal(typeof body.interestRate, "string"); assert.equal(typeof body.minBalance, "string");
  });

  test("only changed fields are sent", () => {
    assert.deepEqual(diffDraft(plan, draft({ status: "INACTIVE", requiresAllAdult: true, description: "  " })),
      { description: null, status: "INACTIVE", requiresAllAdult: true });
  });
});

describe("P02-M03-T06: dialog focus trap", () => {
  test("Tab on the last control wraps to the first, Shift+Tab on the first wraps to the last", () => {
    assert.equal(nextFocusIndex(5, 4, false), 0);
    assert.equal(nextFocusIndex(5, 0, true), 4);
  });
  test("inside the dialog the browser's normal move is left alone", () => {
    assert.equal(nextFocusIndex(5, 2, false), null);
    assert.equal(nextFocusIndex(5, 2, true), null);
    assert.equal(nextFocusIndex(5, 0, false), null);
    assert.equal(nextFocusIndex(5, 4, true), null);
  });
  test("focus that has escaped the dialog is pulled back in", () => {
    assert.equal(nextFocusIndex(5, -1, false), 0);
    assert.equal(nextFocusIndex(5, -1, true), 4);
  });
  test("a single control keeps focus on itself; no controls does nothing", () => {
    assert.equal(nextFocusIndex(1, 0, false), 0);
    assert.equal(nextFocusIndex(1, 0, true), 0);
    assert.equal(nextFocusIndex(0, -1, false), null);
  });
});
