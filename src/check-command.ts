import { resolve } from "node:path";

import {
  loadAllureResultsDirectory,
  type EvidenceAdapterResult,
} from "./adapters/allure.js";
import { checkVerification } from "./check.js";
import type { EvidenceIssue, VerificationProjectCheckResult } from "./check.js";
import type { MouraManifest } from "./manifest.js";
import { loadProjectDirectory } from "./project.js";

export interface CheckCommandOutput {
  readonly exitCode: 0 | 1;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

export interface CheckCommandDependencies {
  readonly loadEvidence?: (directory: string) => Promise<EvidenceAdapterResult>;
}

export function formatEvidenceAdapterIssue(
  issue: EvidenceAdapterResult["issues"][number],
): string {
  const source = issue.source === undefined ? "" : `${issue.source}: `;
  return `${issue.code}: ${source}${issue.message}`;
}

export function formatEvidenceIssue(issue: EvidenceIssue): string {
  const target = issue.canonicalId ?? "(no Case ID)";
  return `${issue.code}: ${target} [${issue.layer}]: ${issue.message}`;
}

export type ProjectCheckEvaluation =
  | {
      readonly kind: "invalid-project";
      readonly errors: readonly string[];
    }
  | {
      readonly kind: "checked";
      readonly manifest: MouraManifest;
      readonly check: VerificationProjectCheckResult;
      readonly adapterIssues: EvidenceAdapterResult["issues"];
    };

/** Shared filesystem evaluation used by both human CLI and artifact renderers. */
export async function evaluateProjectDirectory(
  directory: string,
  dependencies: CheckCommandDependencies = {},
): Promise<ProjectCheckEvaluation> {
  const project = await loadProjectDirectory(directory);
  if (!project.manifest)
    return {
      kind: "invalid-project",
      errors: project.errors.map((problem) => problem.message),
    };

  const loadEvidence = dependencies.loadEvidence ?? loadAllureResultsDirectory;
  const adapted = await loadEvidence(resolve(directory, "allure-results"));
  return {
    kind: "checked",
    manifest: project.manifest,
    check: checkVerification(project.manifest, adapted.evidence),
    adapterIssues: adapted.issues,
  };
}

/** Filesystem command boundary; the check core remains adapter-neutral and pure. */
export async function checkProjectDirectory(
  directory: string,
  dependencies: CheckCommandDependencies = {},
): Promise<CheckCommandOutput> {
  const evaluation = await evaluateProjectDirectory(directory, dependencies);
  if (evaluation.kind === "invalid-project") {
    return {
      exitCode: 1,
      stdout: [],
      stderr: [
        "✗ Traceability validation failed",
        ...evaluation.errors.map((message) => `- ${message}`),
      ],
    };
  }

  const adapted = { issues: evaluation.adapterIssues };
  const checked = evaluation.check;
  const stdout = checked.entries.map(
    (entry) => `${entry.status} ${entry.caseId} [${entry.layer}]`,
  );
  const stderr: string[] = [];
  if (adapted.issues.length > 0) {
    stderr.push("✗ Evidence adapter issues");
    for (const issue of adapted.issues) {
      stderr.push(`- ${formatEvidenceAdapterIssue(issue)}`);
    }
  }
  if (checked.evidenceIssues.length > 0) {
    stderr.push("✗ Semantic evidence issues");
    for (const issue of checked.evidenceIssues) {
      stderr.push(`- ${formatEvidenceIssue(issue)}`);
    }
  }

  return {
    exitCode: adapted.issues.length === 0 && checked.passed ? 0 : 1,
    stdout,
    stderr,
  };
}
