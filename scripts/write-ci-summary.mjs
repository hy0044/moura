import { appendFile, readFile } from "node:fs/promises";
import process from "node:process";

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (!summaryPath) {
  throw new Error("GITHUB_STEP_SUMMARY is not set");
}

const coverage = JSON.parse(
  await readFile("coverage/coverage-summary.json", "utf8"),
).total;
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
  "### Reports",
  "",
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
    "- [Coverage report](https://hy0044.github.io/moura/coverage/)",
    "- [Allure report](https://hy0044.github.io/moura/allure/)",
  );
} else {
  lines.push(
    "",
    "> These artifacts contain this run's results. The shared Pages site represents the latest successful main build, not this pull request.",
  );
}

await appendFile(summaryPath, `${lines.join("\n")}\n`);
