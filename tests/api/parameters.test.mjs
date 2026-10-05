import { before, after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../app/api/admin/parameters/route.ts";
import { PUT } from "../../app/api/admin/parameters/[key]/route.ts";
import { sessionFixture } from "../helpers/session-fixture.mjs";

describe("P01-M01-T05: parameter authorization and audit", () => {
  let admin, auditor;
  before(async () => { admin = await sessionFixture(); auditor = await sessionFixture("AUDITOR"); });
  after(async () => { await admin?.cleanup(); await auditor?.cleanup(); });
  const change = (fixture, key, value, options = {}) => PUT(
    fixture.request(`/api/admin/parameters/${key}`, { method: "PUT", body: { value }, ...options }),
    { params: Promise.resolve({ key }) },
  );
  test("only ADMIN reads and edits parameters", async () => {
    assert.equal((await GET(admin.request("/api/admin/parameters", { authenticated: false }))).status, 401);
    assert.equal((await GET(auditor.request("/api/admin/parameters"))).status, 403);
    assert.equal((await GET(admin.request("/api/admin/parameters"))).status, 200);
    assert.equal((await change(auditor, "WITHDRAWAL_SINGLE_LIMIT", "100001.00")).status, 403);
  });
  test("missing or malformed CSRF is rejected", async () => {
    for (const csrfToken of ["", "not-hex", "aa"]) {
      assert.equal((await change(admin, "WITHDRAWAL_SINGLE_LIMIT", "100001.00", { csrfToken })).status, 403);
    }
  });
  test("invalid values and unknown keys return safe errors", async () => {
    for (const [key, value] of [["WITHDRAWAL_SINGLE_LIMIT", "-1"], ["WITHDRAWAL_SINGLE_LIMIT", "NaN"],
      ["BUSINESS_HOUR_START", "25:00"], ["INTEREST_CYCLE_DAYS", "0"]]) {
      assert.equal((await change(admin, key, value)).status, 400);
    }
    assert.equal((await change(admin, "NONEXISTENT", "1")).status, 404);
  });
  test("valid update writes before/after audit in the same transaction", async () => {
    const original = (await admin.client.query("SELECT param_value FROM system_parameter WHERE param_key = $1", ["WITHDRAWAL_SINGLE_LIMIT"])).rows[0].param_value;
    try {
      const response = await change(admin, "WITHDRAWAL_SINGLE_LIMIT", "100001.00");
      assert.equal(response.status, 200);
      const { data } = await response.json();
      assert.equal(data.param_value, "100001.00");
      const { rows } = await admin.client.query(
        "SELECT old_values, new_values FROM audit_log WHERE entity_type = 'system_parameter' AND entity_id = $1 AND action = 'UPDATE' ORDER BY logged_at DESC LIMIT 1", [data.param_id]);
      assert.equal(rows[0].old_values.param_value, original);
      assert.equal(rows[0].new_values.param_value, "100001.00");
    } finally { await change(admin, "WITHDRAWAL_SINGLE_LIMIT", original); }
  });
});
