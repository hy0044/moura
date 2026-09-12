import { canonicalId, type CanonicalId } from "./id.js";
import type { MouraManifest } from "./manifest.js";
import type { Evidence, VerificationLayer } from "./model.js";

export type VerificationCheckStatus = "PASS" | "FAIL" | "MISSING" | "SKIPPED";

export interface VerificationCheckResult {
  readonly caseId: CanonicalId;
  readonly layer: VerificationLayer;
  readonly status: VerificationCheckStatus;
}

export interface EvidenceIssue {
  readonly code:
    | "empty-evidence-coverage"
    | "non-case-evidence-target"
    | "non-required-evidence-pair"
    | "unknown-evidence-id"
    | "unknown-evidence-layer";
  readonly message: string;
  readonly canonicalId?: CanonicalId;
  readonly layer: VerificationLayer;
}

export interface VerificationProjectCheckResult {
  readonly passed: boolean;
  readonly entries: readonly VerificationCheckResult[];
  readonly evidenceIssues: readonly EvidenceIssue[];
}

/**
 * Aggregates normalized evidence against an already structurally valid model.
 * Entries retain manifest Case and verify-layer order; evidence order is irrelevant.
 */
export function checkVerification(
  manifest: MouraManifest,
  evidence: readonly Evidence[],
): VerificationProjectCheckResult {
  const allNodeIds = new Set<CanonicalId>();
  const caseIds = new Set<CanonicalId>();
  const requiredPairs: Array<{
    caseId: CanonicalId;
    layer: VerificationLayer;
  }> = [];

  for (const requirement of manifest.requirements) {
    const requirementId = canonicalId([requirement]);
    allNodeIds.add(requirementId);
    for (const scenario of requirement.scenarios) {
      const scenarioId = canonicalId([requirement, scenario]);
      allNodeIds.add(scenarioId);
      for (const testCase of scenario.cases) {
        const caseId = canonicalId([requirement, scenario, testCase]);
        allNodeIds.add(caseId);
        caseIds.add(caseId);
        for (const layer of testCase.verify)
          requiredPairs.push({ caseId, layer });
      }
    }
  }

  const declaredLayers = new Set(manifest.verificationLayers);
  const issues: EvidenceIssue[] = [];
  const requiredLayersByCase = new Map<CanonicalId, Set<VerificationLayer>>();
  for (const { caseId, layer } of requiredPairs) {
    const layers = requiredLayersByCase.get(caseId) ?? new Set();
    layers.add(layer);
    requiredLayersByCase.set(caseId, layers);
  }
  for (const item of evidence) {
    if (!declaredLayers.has(item.layer)) {
      issues.push({
        code: "unknown-evidence-layer",
        message: `Evidence uses undeclared verification layer ${JSON.stringify(item.layer)}`,
        layer: item.layer,
      });
    }
    if (item.covers.length === 0) {
      issues.push({
        code: "empty-evidence-coverage",
        message: "Evidence must cover at least one canonical Case ID",
        layer: item.layer,
      });
    }
    for (const coveredId of item.covers) {
      if (!allNodeIds.has(coveredId)) {
        issues.push({
          code: "unknown-evidence-id",
          message: `Evidence refers to unknown canonical ID ${JSON.stringify(coveredId)}`,
          canonicalId: coveredId,
          layer: item.layer,
        });
      } else if (!caseIds.has(coveredId)) {
        issues.push({
          code: "non-case-evidence-target",
          message: `Evidence must target a Case, not ${JSON.stringify(coveredId)}`,
          canonicalId: coveredId,
          layer: item.layer,
        });
      } else if (
        declaredLayers.has(item.layer) &&
        !requiredLayersByCase.get(coveredId)?.has(item.layer)
      ) {
        issues.push({
          code: "non-required-evidence-pair",
          message: `Evidence targets ${JSON.stringify(coveredId)} at layer ${JSON.stringify(item.layer)}, but that Case does not require the layer`,
          canonicalId: coveredId,
          layer: item.layer,
        });
      }
    }
  }

  issues.sort((left, right) => {
    const codeOrder = compareStrings(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;
    const canonicalIdOrder = compareStrings(
      left.canonicalId ?? "",
      right.canonicalId ?? "",
    );
    if (canonicalIdOrder !== 0) return canonicalIdOrder;
    return compareStrings(left.layer, right.layer);
  });

  const entries = requiredPairs.map(({ caseId, layer }) => {
    const matching = evidence.filter(
      (item) => item.layer === layer && item.covers.includes(caseId),
    );
    let status: VerificationCheckStatus;
    if (matching.length === 0) status = "MISSING";
    else if (matching.some((item) => item.status === "failed")) status = "FAIL";
    else if (matching.some((item) => item.status === "passed")) status = "PASS";
    else status = "SKIPPED";
    return { caseId, layer, status };
  });

  return {
    passed:
      issues.length === 0 && entries.every((entry) => entry.status === "PASS"),
    entries,
    evidenceIssues: issues,
  };
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
