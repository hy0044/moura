import { canonicalId } from "./id.js";
import type { MouraManifest } from "./manifest.js";
import type {
  VerificationCheckResult,
  VerificationCheckStatus,
  VerificationProjectCheckResult,
} from "./check.js";

export interface CoverageCount {
  readonly covered: number;
  readonly total: number;
}

export interface CoverageSummary {
  readonly requirements: CoverageCount;
  readonly scenarios: CoverageCount;
  readonly cases: CoverageCount;
  readonly pairs: CoverageCount;
  readonly layers: readonly (CoverageCount & { readonly layer: string })[];
}

/** Roll up authoritative pair statuses; only PASS is coverage. */
export function summarizeCoverage(
  manifest: MouraManifest,
  check: VerificationProjectCheckResult,
): CoverageSummary {
  const byCase = new Map<string, readonly VerificationCheckResult[]>();
  for (const entry of check.entries)
    byCase.set(entry.caseId, [...(byCase.get(entry.caseId) ?? []), entry]);

  let coveredRequirements = 0;
  let scenarios = 0;
  let coveredScenarios = 0;
  let cases = 0;
  let coveredCases = 0;
  for (const requirement of manifest.requirements) {
    let requirementCovered = true;
    for (const scenario of requirement.scenarios) {
      scenarios += 1;
      let scenarioCovered = true;
      for (const testCase of scenario.cases) {
        cases += 1;
        const id = canonicalId([requirement, scenario, testCase]);
        const covered =
          byCase.get(id)?.every((entry) => entry.status === "PASS") ?? false;
        if (covered) coveredCases += 1;
        else scenarioCovered = false;
      }
      if (scenarioCovered) coveredScenarios += 1;
      else requirementCovered = false;
    }
    if (requirementCovered) coveredRequirements += 1;
  }

  return {
    requirements: {
      covered: coveredRequirements,
      total: manifest.requirements.length,
    },
    scenarios: { covered: coveredScenarios, total: scenarios },
    cases: { covered: coveredCases, total: cases },
    pairs: {
      covered: check.entries.filter((entry) => entry.status === "PASS").length,
      total: check.entries.length,
    },
    layers: manifest.verificationLayers.map((layer) => {
      const entries = check.entries.filter((entry) => entry.layer === layer);
      return {
        layer,
        covered: entries.filter((entry) => entry.status === "PASS").length,
        total: entries.length,
      };
    }),
  };
}

export const coverageStatuses: readonly VerificationCheckStatus[] = [
  "PASS",
  "FAIL",
  "BROKEN",
  "SKIPPED",
  "MISSING",
];
