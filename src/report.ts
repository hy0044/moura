import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { EvidenceAdapterIssue } from "./adapters/allure.js";
import type { VerificationProjectCheckResult } from "./check.js";
import {
  evaluateProjectDirectory,
  formatEvidenceAdapterIssue,
  formatEvidenceIssue,
  type CheckCommandDependencies,
} from "./check-command.js";
import {
  summarizeCoverage,
  coverageStatuses,
  type CoverageCount,
} from "./coverage.js";
import { canonicalId } from "./id.js";
import type { MouraManifest } from "./manifest.js";

export interface ReportCommandOutput {
  readonly exitCode: 0 | 1;
  readonly outputPath?: string;
  readonly errors: readonly string[];
}

export async function reportProjectDirectory(
  directory: string,
  dependencies: CheckCommandDependencies = {},
): Promise<ReportCommandOutput> {
  const evaluation = await evaluateProjectDirectory(directory, dependencies);
  if (evaluation.kind === "invalid-project")
    return { exitCode: 1, errors: evaluation.errors };
  let outputPath: string;
  try {
    outputPath = await writeReportFile(
      directory,
      renderCoverageReport(
        evaluation.manifest,
        evaluation.check,
        evaluation.adapterIssues,
      ),
    );
  } catch (error) {
    return {
      exitCode: 1,
      errors: [
        `Could not write Requirement Coverage report: ${errorMessage(error)}`,
      ],
    };
  }
  const semanticErrors =
    evaluation.check.evidenceIssues.map(formatEvidenceIssue);
  return {
    exitCode:
      evaluation.adapterIssues.length === 0 &&
      evaluation.check.evidenceIssues.length === 0
        ? 0
        : 1,
    outputPath,
    errors: [
      ...evaluation.adapterIssues.map(formatEvidenceAdapterIssue),
      ...semanticErrors,
    ],
  };
}

async function writeReportFile(
  directory: string,
  contents: string,
): Promise<string> {
  const projectRoot = await realpath(resolve(directory));
  const outputDirectory = resolve(projectRoot, "moura-report");
  let outputDirectoryStatus = await optionalLstat(outputDirectory);
  if (outputDirectoryStatus?.isSymbolicLink())
    throw new Error("moura-report must not be a symbolic link");
  if (outputDirectoryStatus && !outputDirectoryStatus.isDirectory())
    throw new Error("moura-report must be a directory");
  if (!outputDirectoryStatus) {
    await mkdir(outputDirectory);
    outputDirectoryStatus = await lstat(outputDirectory);
    if (outputDirectoryStatus.isSymbolicLink())
      throw new Error("moura-report must not be a symbolic link");
  }

  const realOutputDirectory = await realpath(outputDirectory);
  if (!isWithin(projectRoot, realOutputDirectory))
    throw new Error("moura-report must remain inside the project directory");

  const outputPath = resolve(realOutputDirectory, "index.html");
  const outputStatus = await optionalLstat(outputPath);
  if (outputStatus?.isSymbolicLink())
    throw new Error("moura-report/index.html must not be a symbolic link");
  if (outputStatus?.isDirectory())
    throw new Error("moura-report/index.html must be a file");

  const handle = await open(
    outputPath,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_TRUNC |
      constants.O_NOFOLLOW,
    0o666,
  );
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
  return outputPath;
}

async function optionalLstat(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function isWithin(projectRoot: string, targetPath: string): boolean {
  const relativePath = relative(projectRoot, targetPath);
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function renderCoverageReport(
  manifest: MouraManifest,
  check: VerificationProjectCheckResult,
  adapterIssues: readonly EvidenceAdapterIssue[] = [],
): string {
  const summary = summarizeCoverage(manifest, check);
  const entries = new Map(
    check.entries.map((entry) => [
      `${entry.caseId}\0${entry.layer}`,
      entry.status,
    ]),
  );
  const cards = (["requirements", "scenarios", "cases", "pairs"] as const)
    .map(
      (key) =>
        `<div class="metric"><strong>${title(key)}</strong><span>${count(summary[key])}</span></div>`,
    )
    .join("");
  const statusCounts = coverageStatuses
    .map(
      (status) =>
        `<li><span class="status ${status.toLowerCase()}">${status}</span> ${check.entries.filter((entry) => entry.status === status).length}</li>`,
    )
    .join("");
  const layers = summary.layers
    .map(
      (layer) =>
        `<tr><th>${escapeHtml(layer.layer)}</th><td>${count(layer)}</td></tr>`,
    )
    .join("");
  const hierarchy = manifest.requirements
    .map((requirement) => {
      const scenarios = requirement.scenarios
        .map((scenario) => {
          const cases = scenario.cases
            .map((testCase) => {
              const caseId = canonicalId([requirement, scenario, testCase]);
              const statuses = testCase.verify
                .map((layer) => {
                  const status = entries.get(`${caseId}\0${layer}`);
                  if (!status)
                    throw new Error(
                      `Check result omitted required pair ${caseId} × ${layer}`,
                    );
                  return `<li><code>${escapeHtml(layer)}</code> <span class="status ${status.toLowerCase()}">${status}</span></li>`;
                })
                .join("");
              return `<section class="case"><h4>${escapeHtml(caseId)}</h4><ul>${statuses}</ul></section>`;
            })
            .join("");
          return `<section><h3>${escapeHtml(canonicalId([requirement, scenario]))}</h3>${cases}</section>`;
        })
        .join("");
      return `<article><h2>${escapeHtml(canonicalId([requirement]))}</h2>${scenarios}</article>`;
    })
    .join("");
  const issues = [
    ...adapterIssues.map(formatEvidenceAdapterIssue),
    ...check.evidenceIssues.map((issue) => `${issue.code}: ${issue.message}`),
  ];
  const issueHtml =
    issues.length === 0
      ? "<p>None.</p>"
      : `<ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Moura Requirement Coverage</title>
<style>body{font:16px system-ui,sans-serif;line-height:1.5;max-width:72rem;margin:auto;padding:2rem;color:#172033}h1,h2,h3,h4{line-height:1.2}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem}.metric,.case{border:1px solid #ccd3df;border-radius:.5rem;padding:1rem}.metric span{display:block;font-size:1.4rem}.status{font-weight:700}.pass{color:#167044}.fail,.broken{color:#b42318}.skipped,.missing{color:#854d0e}table{border-collapse:collapse}th,td{border:1px solid #ccd3df;padding:.5rem;text-align:left}code{font-size:.9em}</style></head>
<body><main><h1>Moura Requirement Coverage</h1><p>Coverage of declared traceability and evidence. Moura does not prove that a test semantically verifies the specification it declares.</p>
<div class="metrics">${cards}</div><h2>Pair statuses</h2><ul>${statusCounts}</ul><h2>Per-layer coverage</h2><table><thead><tr><th>Layer</th><th>PASS / required</th></tr></thead><tbody>${layers}</tbody></table>
<h2>Requirement hierarchy and exact verification gaps</h2>${hierarchy}<h2>Evidence issues</h2>${issueHtml}</main></body></html>\n`;
}

function count(value: CoverageCount): string {
  return `${value.covered} / ${value.total} (${percent(value)}%)`;
}
function percent(value: CoverageCount): number {
  return value.total === 0
    ? 100
    : Math.round((value.covered / value.total) * 100);
}
function title(value: string): string {
  return value === "pairs"
    ? "Required Case × layer pairs"
    : value[0]!.toUpperCase() + value.slice(1);
}
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
