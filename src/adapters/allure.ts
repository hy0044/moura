import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Evidence } from "../model.js";

/** The small, Moura-owned subset of an Allure result used during conversion. */
export interface AllureEvidenceResult {
  readonly labels?: readonly AllureEvidenceLabel[];
  readonly status?: unknown;
}

export interface AllureEvidenceLabel {
  readonly name?: unknown;
  readonly value?: unknown;
}

export type EvidenceAdapterIssueCode =
  | "invalid-result"
  | "invalid-label"
  | "missing-moura-case"
  | "missing-moura-layer"
  | "multiple-moura-layers"
  | "missing-status"
  | "malformed-status"
  | "unknown-status"
  | "unsupported-status"
  | "malformed-json"
  | "unreadable-results-directory"
  | "unreadable-result-file";

export interface EvidenceAdapterIssue {
  readonly code: EvidenceAdapterIssueCode;
  readonly message: string;
  readonly source?: string;
}

export interface EvidenceAdapterResult {
  readonly evidence: readonly Evidence[];
  readonly issues: readonly EvidenceAdapterIssue[];
}

const supportedStatuses = new Set<Evidence["status"]>([
  "passed",
  "failed",
  "broken",
  "skipped",
]);

/** Convert one parsed Allure result. Results without Moura labels are ignored. */
export function convertAllureResult(
  input: unknown,
  source?: string,
): EvidenceAdapterResult {
  if (!isRecord(input))
    return adapterFailure(
      "invalid-result",
      "Allure result must be a JSON object",
      source,
    );

  const labels = Array.isArray(input.labels) ? input.labels : [];
  const mouraLabels = labels.filter(
    (label) =>
      isRecord(label) &&
      (label.name === "moura_case" || label.name === "moura_layer"),
  );
  if (mouraLabels.length === 0) return { evidence: [], issues: [] };

  const issues: EvidenceAdapterIssue[] = [];
  const caseValues: string[] = [];
  const layerValues: string[] = [];
  for (const label of mouraLabels) {
    if (typeof label.value !== "string" || label.value.length === 0) {
      issues.push(
        issue(
          "invalid-label",
          `${String(label.name)} must have a non-empty string value`,
          source,
        ),
      );
    } else if (label.name === "moura_case") caseValues.push(label.value);
    else layerValues.push(label.value);
  }

  if (caseValues.length === 0)
    issues.push(
      issue(
        "missing-moura-case",
        "Result has no valid moura_case label",
        source,
      ),
    );
  if (layerValues.length === 0)
    issues.push(
      issue(
        "missing-moura-layer",
        "Result has no valid moura_layer label",
        source,
      ),
    );
  else if (layerValues.length > 1)
    issues.push(
      issue(
        "multiple-moura-layers",
        "Result must have exactly one moura_layer label",
        source,
      ),
    );

  const status = input.status;
  if (status === undefined)
    issues.push(issue("missing-status", "Result has no status", source));
  else if (typeof status !== "string")
    issues.push(
      issue("malformed-status", "Result status must be a string", source),
    );
  else if (status === "unknown")
    issues.push(
      issue(
        "unknown-status",
        "Allure status unknown is invalid evidence",
        source,
      ),
    );
  else if (!supportedStatuses.has(status as Evidence["status"]))
    issues.push(
      issue(
        "unsupported-status",
        `Unsupported Allure status ${JSON.stringify(status)}`,
        source,
      ),
    );

  if (issues.length > 0) return { evidence: [], issues };
  const evidence: Evidence = {
    covers: [...new Set(caseValues)],
    layer: layerValues[0]!,
    status: status as Evidence["status"],
    ...(source === undefined ? {} : { source }),
  };
  return { evidence: [evidence], issues: [] };
}

/** Load only sorted `*-result.json` files from an Allure results directory. */
export async function loadAllureResultsDirectory(
  directory: string,
): Promise<EvidenceAdapterResult> {
  const evidence: Evidence[] = [];
  const issues: EvidenceAdapterIssue[] = [];
  let files: string[];
  try {
    files = (await readdir(directory))
      .filter((file) => file.endsWith("-result.json"))
      .sort(compareStrings);
  } catch (error) {
    return adapterFailure(
      "unreadable-results-directory",
      `Could not read Allure results directory: ${errorMessage(error)}`,
      directory,
    );
  }

  for (const source of files) {
    let contents: string;
    try {
      contents = await readFile(join(directory, source), "utf8");
    } catch (error) {
      issues.push(
        issue(
          "unreadable-result-file",
          `Could not read Allure result: ${errorMessage(error)}`,
          source,
        ),
      );
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch (error) {
      issues.push(
        issue(
          "malformed-json",
          `Could not parse Allure result JSON: ${errorMessage(error)}`,
          source,
        ),
      );
      continue;
    }
    const converted = convertAllureResult(parsed, source);
    evidence.push(...converted.evidence);
    issues.push(...converted.issues);
  }
  return { evidence, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  code: EvidenceAdapterIssueCode,
  message: string,
  source?: string,
): EvidenceAdapterIssue {
  return { code, message, ...(source === undefined ? {} : { source }) };
}

function adapterFailure(
  code: EvidenceAdapterIssueCode,
  message: string,
  source?: string,
): EvidenceAdapterResult {
  return { evidence: [], issues: [issue(code, message, source)] };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
