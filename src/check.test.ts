import { describe, expect, it } from "vitest";

import { checkVerification } from "./check.js";
import { parseManifest, type MouraManifest } from "./manifest.js";
import type { Evidence } from "./model.js";

const caseId = "requirement/scenario/case";

function manifest(verify: readonly string[] = ["unit"]): MouraManifest {
  const parsed = parseManifest(`
version: 1
sources:
  requirements: [req.md]
  specifications: [spec.md]
verification:
  layers: [unit, integration]
requirements:
  - id: requirement
    scenarios:
      - id: scenario
        cases:
          - id: case
            verify: [${verify.join(", ")}]
`);
  expect(parsed.errors).toEqual([]);
  expect(parsed.value).toBeDefined();
  return parsed.value!;
}

function evidence(
  statuses: readonly Evidence["status"][],
  layer = "unit",
  covers: readonly string[] = [caseId],
): Evidence[] {
  return statuses.map((status) => ({ covers, layer, status }));
}

describe("REQ-002 verification check contract", () => {
  const aggregationCases = [
    { name: "an empty set of", statuses: [], expected: "MISSING" },
    { name: "passed", statuses: ["passed"], expected: "PASS" },
    { name: "failed", statuses: ["failed"], expected: "FAIL" },
    { name: "skipped", statuses: ["skipped"], expected: "SKIPPED" },
    {
      name: "passed and skipped",
      statuses: ["passed", "skipped"],
      expected: "PASS",
    },
    {
      name: "passed and failed",
      statuses: ["passed", "failed"],
      expected: "FAIL",
    },
    {
      name: "skipped and failed",
      statuses: ["skipped", "failed"],
      expected: "FAIL",
    },
    {
      name: "multiple passed",
      statuses: ["passed", "passed"],
      expected: "PASS",
    },
  ] as const;

  for (const testCase of aggregationCases) {
    it(`aggregates ${testCase.name} evidence as ${testCase.expected}`, () => {
      const result = checkVerification(manifest(), evidence(testCase.statuses));
      expect(result.entries[0]?.status).toBe(testCase.expected);
      expect(result.passed).toBe(testCase.expected === "PASS");
    });
  }

  it("aggregates evidence independently of evidence ordering", () => {
    for (const [left, right] of [
      ["passed", "failed"],
      ["passed", "skipped"],
      ["skipped", "failed"],
    ] as const) {
      const forward = checkVerification(manifest(), evidence([left, right]));
      const reverse = checkVerification(manifest(), evidence([right, left]));
      expect(forward).toEqual(reverse);
    }
  });

  it("checks every required Case × layer pair independently", () => {
    const missing = checkVerification(
      manifest(["unit", "integration"]),
      evidence(["passed"]),
    );
    expect(missing.entries).toEqual([
      { caseId, layer: "unit", status: "PASS" },
      { caseId, layer: "integration", status: "MISSING" },
    ]);
    expect(missing.passed).toBe(false);

    const failed = checkVerification(manifest(["unit", "integration"]), [
      ...evidence(["passed"]),
      ...evidence(["failed"], "integration"),
    ]);
    expect(failed.entries).toEqual([
      { caseId, layer: "unit", status: "PASS" },
      { caseId, layer: "integration", status: "FAIL" },
    ]);
  });

  it("retains manifest Case and verify-layer order", () => {
    const parsed = parseManifest(`
version: 1
sources: { requirements: [req.md], specifications: [spec.md] }
verification: { layers: [integration, unit] }
requirements:
  - id: second
    scenarios:
      - id: behavior
        cases:
          - { id: later, verify: [unit, integration] }
          - { id: last, verify: [integration] }
  - id: first
    scenarios:
      - id: behavior
        cases:
          - { id: earlier, verify: [unit] }
`);
    expect(parsed.value).toBeDefined();
    expect(
      checkVerification(parsed.value!, []).entries.map(({ caseId, layer }) => [
        caseId,
        layer,
      ]),
    ).toEqual([
      ["second/behavior/later", "unit"],
      ["second/behavior/later", "integration"],
      ["second/behavior/last", "integration"],
      ["first/behavior/earlier", "unit"],
    ]);
  });

  it("reports unknown canonical IDs instead of silently ignoring them", () => {
    const result = checkVerification(
      manifest(),
      evidence(["passed"], "unit", ["unknown/scenario/case"]),
    );
    expect(result.evidenceIssues[0]?.code).toBe("unknown-evidence-id");
    expect(result.passed).toBe(false);
  });

  it("reports evidence for undeclared verification layers", () => {
    const result = checkVerification(
      manifest(),
      evidence(["passed"], "system"),
    );
    expect(result.evidenceIssues[0]?.code).toBe("unknown-evidence-layer");
    expect(result.passed).toBe(false);
  });

  it("reports evidence for a layer that the covered Case does not require", () => {
    const result = checkVerification(
      manifest(["unit"]),
      evidence(["passed"], "integration"),
    );
    expect(result.evidenceIssues[0]?.code).toBe("non-required-evidence-pair");
    expect(result.passed).toBe(false);
  });

  it("distinguishes Case × layer pairs containing delimiter characters", () => {
    const collisionManifest: MouraManifest = {
      version: 1,
      sources: {
        requirements: ["req.md"],
        specifications: ["spec.md"],
      },
      verificationLayers: ["y\0z", "z", "other"],
      requirements: [
        {
          kind: "requirement",
          localId: "r",
          scenarios: [
            {
              kind: "scenario",
              localId: "s",
              cases: [
                { kind: "case", localId: "x", verify: ["y\0z"] },
                { kind: "case", localId: "x\0y", verify: ["other"] },
              ],
            },
          ],
        },
      ],
    };

    const result = checkVerification(collisionManifest, [
      { covers: ["r/s/x\0y"], layer: "z", status: "passed" },
    ]);

    expect(
      result.evidenceIssues.some(
        (issue) => issue.code === "non-required-evidence-pair",
      ),
    ).toBeTruthy();
    expect(result.passed).toBe(false);
  });

  it("limits v0.1 evidence targets to canonical Case IDs", () => {
    const result = checkVerification(
      manifest(),
      evidence(["passed"], "unit", ["requirement/scenario"]),
    );
    expect(result.evidenceIssues[0]?.code).toBe("non-case-evidence-target");
    expect(result.passed).toBe(false);
  });

  it("reports evidence with no coverage targets", () => {
    const result = checkVerification(
      manifest(),
      evidence(["passed"], "unit", []),
    );
    expect(result.evidenceIssues[0]?.code).toBe("empty-evidence-coverage");
    expect(result.passed).toBe(false);
  });

  it("reports evidence issues independently of evidence ordering", () => {
    const unknownId = evidence(["passed"], "unit", ["unknown"])[0]!;
    const unknownLayer = evidence(["passed"], "system")[0]!;
    expect(checkVerification(manifest(), [unknownId, unknownLayer])).toEqual(
      checkVerification(manifest(), [unknownLayer, unknownId]),
    );
  });
});
