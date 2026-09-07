import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalId, InvalidLocalIdError, localId } from "./id.js";
import type { TraceNode } from "./model.js";

const requirement: TraceNode = { kind: "requirement", localId: "REQ-001" };
const scenario: TraceNode = { kind: "scenario", localId: "SCN-001" };
const testCase: TraceNode = { kind: "case", localId: "CASE-001" };

describe("canonicalId", () => {
  it("builds IDs from each valid hierarchy level", () => {
    assert.equal(canonicalId([requirement]), "REQ-001");
    assert.equal(canonicalId([requirement, scenario]), "REQ-001/SCN-001");
    assert.equal(
      canonicalId([requirement, scenario, testCase]),
      "REQ-001/SCN-001/CASE-001",
    );
  });

  it("rejects a slash in any local ID", () => {
    assert.throws(() => localId("SCN/001"), InvalidLocalIdError);
    assert.throws(
      () =>
        canonicalId([requirement, { kind: "scenario", localId: "SCN/001" }]),
      InvalidLocalIdError,
    );
  });

  it("rejects whitespace in any local ID", () => {
    for (const value of [
      "LOGIN FLOW",
      "REQ 001",
      "SCN- 001",
      "CASE-\t001",
      "REQ-\u0085001",
    ]) {
      assert.throws(() => localId(value), InvalidLocalIdError);
    }

    assert.throws(
      () =>
        canonicalId([requirement, { kind: "scenario", localId: "SCN\t001" }]),
      InvalidLocalIdError,
    );
  });

  it("accepts IDs without whitespace or the reserved separator", () => {
    for (const value of [
      "REQ-001",
      "SCN-001",
      "CASE-001",
      "login-flow",
      "login_flow",
      "REQ-\uFEFF001",
    ]) {
      assert.equal(localId(value), value);
    }
  });

  it("rejects an invalid hierarchy", () => {
    assert.throws(() => canonicalId([scenario]), /Invalid node hierarchy/);
  });
});
