import { describe, expect, it } from "vitest";

import { canonicalId, InvalidLocalIdError, localId } from "./id.js";
import type { TraceNode } from "./model.js";

const requirement: TraceNode = { kind: "requirement", localId: "REQ-001" };
const scenario: TraceNode = { kind: "scenario", localId: "SCN-001" };
const testCase: TraceNode = { kind: "case", localId: "CASE-001" };

describe("canonicalId", () => {
  it("builds IDs from each valid hierarchy level", () => {
    expect(canonicalId([requirement])).toBe("REQ-001");
    expect(canonicalId([requirement, scenario])).toBe("REQ-001/SCN-001");
    expect(canonicalId([requirement, scenario, testCase])).toBe(
      "REQ-001/SCN-001/CASE-001",
    );
  });

  it("rejects a slash in any local ID", () => {
    expect(() => localId("SCN/001")).toThrow(InvalidLocalIdError);
    expect(() =>
      canonicalId([requirement, { kind: "scenario", localId: "SCN/001" }]),
    ).toThrow(InvalidLocalIdError);
  });

  it("rejects whitespace in any local ID", () => {
    for (const value of [
      "LOGIN FLOW",
      "REQ 001",
      "SCN- 001",
      "CASE-\t001",
      "REQ-\u0085001",
    ]) {
      expect(() => localId(value)).toThrow(InvalidLocalIdError);
    }

    expect(() =>
      canonicalId([requirement, { kind: "scenario", localId: "SCN\t001" }]),
    ).toThrow(InvalidLocalIdError);
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
      expect(localId(value)).toBe(value);
    }
  });

  it("rejects an invalid hierarchy", () => {
    expect(() => canonicalId([scenario])).toThrow(/Invalid node hierarchy/);
  });
});
