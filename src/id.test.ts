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

  it("rejects an invalid hierarchy", () => {
    assert.throws(() => canonicalId([scenario]), /Invalid node hierarchy/);
  });
});
