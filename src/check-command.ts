import { resolve } from "node:path";

import {
  loadAllureResultsDirectory,
  type EvidenceAdapterResult,
} from "./adapters/allure.js";
import { checkVerification } from "./check.js";
import { loadProjectDirectory } from "./project.js";

export interface CheckCommandOutput {
  readonly exitCode: 0 | 1;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

export interface CheckCommandDependencies {
  readonly loadEvidence?: (directory: string) => Promise<EvidenceAdapterResult>;
}

/** Filesystem command boundary; the check core remains adapter-neutral and pure. */
export async function checkProjectDirectory(
  directory: string,
  dependencies: CheckCommandDependencies = {},
): Promise<CheckCommandOutput> {
  const project = await loadProjectDirectory(directory);
  if (!project.manifest) {
    return {
      exitCode: 1,
      stdout: [],
      stderr: [
        "✗ Traceability validation failed",
        ...project.errors.map((problem) => `- ${problem.message}`),
      ],
    };
  }

  const loadEvidence = dependencies.loadEvidence ?? loadAllureResultsDirectory;
  const adapted = await loadEvidence(resolve(directory, "allure-results"));
  const checked = checkVerification(project.manifest, adapted.evidence);
  const stdout = checked.entries.map(
    (entry) => `${entry.status} ${entry.caseId} [${entry.layer}]`,
  );
  const stderr: string[] = [];
  if (adapted.issues.length > 0) {
    stderr.push("✗ Evidence adapter issues");
    for (const issue of adapted.issues) {
      const source = issue.source === undefined ? "" : `${issue.source}: `;
      stderr.push(`- ${issue.code}: ${source}${issue.message}`);
    }
  }
  if (checked.evidenceIssues.length > 0) {
    stderr.push("✗ Semantic evidence issues");
    for (const issue of checked.evidenceIssues) {
      const target = issue.canonicalId ?? "(no Case ID)";
      stderr.push(
        `- ${issue.code}: ${target} [${issue.layer}]: ${issue.message}`,
      );
    }
  }

  return {
    exitCode: adapted.issues.length === 0 && checked.passed ? 0 : 1,
    stdout,
    stderr,
  };
}
