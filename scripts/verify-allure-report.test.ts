import { describe, expect, it } from "vitest";

import { verifyBehaviorTree } from "./verify-allure-report.js";

const tree = {
  root: { groups: ["requirement"] },
  groupsById: {
    requirement: { name: "REQ-002", groups: ["scenario"] },
    scenario: { name: "SCN-001", groups: ["case"] },
    case: { name: "CASE-002", leaves: ["test"] },
  },
  leavesById: {
    test: { name: "aggregates an empty set of evidence as MISSING" },
  },
};

describe("Allure Behavior report verification", () => {
  it("accepts a Requirement → Scenario → Case → Test tree", () => {
    expect(() =>
      verifyBehaviorTree(
        tree,
        ["REQ-002", "SCN-001", "CASE-002"],
        "aggregates an empty set of evidence as MISSING",
      ),
    ).not.toThrow();
  });

  it("rejects a tree that skips the configured Behavior hierarchy", () => {
    expect(() =>
      verifyBehaviorTree(
        tree,
        ["REQ-002", "CASE-002", "SCN-001"],
        "aggregates an empty set of evidence as MISSING",
      ),
    ).toThrow("missing hierarchy node CASE-002");
  });

  it("rejects a hierarchy without the representative test leaf", () => {
    expect(() =>
      verifyBehaviorTree(
        tree,
        ["REQ-002", "SCN-001", "CASE-002"],
        "another test",
      ),
    ).toThrow('missing test "another test"');
  });
});
