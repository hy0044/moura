import { readFileSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";

import { parse } from "yaml";

const resultsDirectory = "allure-results";
rmSync(resultsDirectory, { recursive: true, force: true });

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const run = spawnSync(
  pnpm,
  ["exec", "vitest", "run", "--config", "vitest.allure.config.ts"],
  { stdio: "inherit" },
);
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);

const manifest = parse(readFileSync("moura.yaml", "utf8"));
const canonicalCases = new Set(
  manifest.requirements.flatMap((requirement) =>
    requirement.scenarios.flatMap((scenario) =>
      scenario.cases.map(
        (testCase) => `${requirement.id}/${scenario.id}/${testCase.id}`,
      ),
    ),
  ),
);
const layers = new Set(manifest.verification.layers);

const results = readdirSync(resultsDirectory)
  .filter((file) => file.endsWith("-result.json"))
  .map((file) =>
    JSON.parse(readFileSync(`${resultsDirectory}/${file}`, "utf8")),
  );

verifyResult("aggregates an empty set of evidence as MISSING", [
  "REQ-002/SCN-001/CASE-002",
]);
verifyResult("aggregates passed and skipped evidence as PASS", [
  "REQ-002/SCN-001/CASE-001",
  "REQ-002/SCN-001/CASE-005",
]);

function verifyResult(name, expectedCases) {
  const matches = results.filter((result) => result.name === name);
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one Allure result named ${JSON.stringify(name)}`,
    );

  const labels = matches[0].labels ?? [];
  const actualCases = labels
    .filter((label) => label.name === "moura_case")
    .map((label) => label.value);
  const actualLayers = labels
    .filter((label) => label.name === "moura_layer")
    .map((label) => label.value);

  if (
    actualCases.length !== expectedCases.length ||
    !expectedCases.every((caseId) => actualCases.includes(caseId))
  )
    throw new Error(`${name} has unexpected moura_case labels`);
  if (actualLayers.length !== 1 || actualLayers[0] !== "unit")
    throw new Error(`${name} must have exactly one moura_layer label: unit`);
  if (!actualCases.every((caseId) => canonicalCases.has(caseId)))
    throw new Error(`${name} references a Case absent from moura.yaml`);
  if (!layers.has(actualLayers[0]))
    throw new Error(`${name} references a layer absent from moura.yaml`);
}

console.log("Verified Moura labels in generated Allure result JSON.");
