import { appendFile, readFile } from "node:fs/promises";
import process from "node:process";

import { readAllureCounts } from "./ci-summary.js";

interface CoverageMetric {
  readonly pct: number;
}

interface CoverageSummary {
  readonly statements: CoverageMetric;
  readonly branches: CoverageMetric;
  readonly functions: CoverageMetric;
  readonly lines: CoverageMetric;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCoverageMetric(value: unknown): value is CoverageMetric {
  return isRecord(value) && typeof value.pct === "number";
}

function parseCoverageSummary(value: unknown): CoverageSummary {
  if (!isRecord(value) || !("total" in value))
    throw new Error("coverage summary does not contain total metrics");
  const total = value.total;
  const names = ["statements", "branches", "functions", "lines"] as const;
  if (!isRecord(total) || !names.every((name) => isCoverageMetric(total[name])))
    throw new Error("coverage summary has invalid total metrics");
  const { statements, branches, functions, lines } = total;
  if (
    !isCoverageMetric(statements) ||
    !isCoverageMetric(branches) ||
    !isCoverageMetric(functions) ||
    !isCoverageMetric(lines)
  )
    throw new Error("coverage summary has invalid total metrics");
  return {
    statements,
    branches,
    functions,
    lines,
  };
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (!summaryPath) {
  throw new Error("GITHUB_STEP_SUMMARY is not set");
}

const coverageValue: unknown = JSON.parse(
  await readFile("coverage/coverage-summary.json", "utf8"),
);
const coverage = parseCoverageSummary(coverageValue);
const allure = await readAllureCounts("allure-results");
const metrics = [
  ["Statements", coverage.statements.pct],
  ["Branches", coverage.branches.pct],
  ["Functions", coverage.functions.pct],
  ["Lines", coverage.lines.pct],
];
const lines = [
  "## Moura CI Summary",
  "",
  "**Tests:** PASS",
  "",
  "### Coverage",
  "",
  ...metrics.map(([name, percentage]) => `- ${name}: ${percentage}%`),
  "",
  "### Allure",
  "",
  `- Tests: ${allure.tests}`,
  `- Passed: ${allure.passed}`,
  `- Failed: ${allure.failed}`,
  `- Broken: ${allure.broken}`,
  `- Skipped: ${allure.skipped}`,
  "",
  "### Reports",
  "",
  "- Requirement Coverage: uploaded as the `moura-report` workflow artifact",
  "- Coverage HTML: uploaded as the `coverage-report` workflow artifact",
  "- Allure Report: uploaded as the `allure-report` workflow artifact",
];

if (
  process.env.GITHUB_EVENT_NAME === "push" &&
  process.env.GITHUB_REF === "refs/heads/main"
) {
  lines.push(
    "",
    "### Latest main quality reports",
    "",
    "- [Requirement Coverage](https://specxai.github.io/moura/moura/)",
    "- [Code coverage](https://specxai.github.io/moura/coverage/)",
    "- [Allure report](https://specxai.github.io/moura/allure/)",
  );
} else {
  lines.push(
    "",
    "> These artifacts contain this run's results. The shared Pages site represents the latest successful main build, not this pull request.",
  );
}

await appendFile(summaryPath, `${lines.join("\n")}\n`);
