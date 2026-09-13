import { readFileSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import console from "node:console";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";

import { parse } from "yaml";

import {
  validateMouraEvidenceResults,
  verifyRepresentativeResult,
} from "./verify-allure-results.mjs";

const resultsDirectory = "allure-results";
rmSync(resultsDirectory, { recursive: true, force: true });

const require = createRequire(import.meta.url);
const vitestPackagePath = require.resolve("vitest/package.json");
const vitestPackage = JSON.parse(readFileSync(vitestPackagePath, "utf8"));
const vitestBin =
  typeof vitestPackage.bin === "string"
    ? vitestPackage.bin
    : vitestPackage.bin.vitest;
const vitestCliPath = resolve(dirname(vitestPackagePath), vitestBin);
const run = spawnSync(
  process.execPath,
  [vitestCliPath, "run", "--config", "vitest.allure.config.ts"],
  { stdio: "inherit" },
);
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);

const manifest = parse(readFileSync("moura.yaml", "utf8"));
const verificationLayersByCase = new Map();
for (const requirement of manifest.requirements) {
  for (const scenario of requirement.scenarios) {
    for (const testCase of scenario.cases) {
      const caseId = `${requirement.id}/${scenario.id}/${testCase.id}`;
      verificationLayersByCase.set(caseId, new Set(testCase.verify));
    }
  }
}
const layers = new Set(manifest.verification.layers);

const results = readdirSync(resultsDirectory)
  .filter((file) => file.endsWith("-result.json"))
  .map((file) =>
    JSON.parse(readFileSync(`${resultsDirectory}/${file}`, "utf8")),
  );

validateMouraEvidenceResults(results, verificationLayersByCase, layers);
verifyRepresentativeResult(
  results,
  "aggregates an empty set of evidence as MISSING",
  ["REQ-002/SCN-001/CASE-002"],
  "unit",
);
verifyRepresentativeResult(
  results,
  "aggregates passed and skipped evidence as PASS",
  ["REQ-002/SCN-001/CASE-001", "REQ-002/SCN-001/CASE-005"],
  "unit",
);

console.log("Verified Moura labels in generated Allure result JSON.");
