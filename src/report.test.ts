import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkVerification } from "./check.js";
import { parseManifest } from "./manifest.js";
import { renderCoverageReport, reportProjectDirectory } from "./report.js";

const directories: string[] = [];
afterEach(async () =>
  Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  ),
);

const manifest = parseManifest(`
version: 1
sources: { requirements: [req.md], specifications: [spec.md] }
verification: { layers: [unit, integration, system, manual, security] }
requirements:
  - id: REQ-A&amp;
    scenarios:
      - id: SCN-ONE
        cases:
          - { id: CASE-X, verify: [unit, integration, system, manual, security] }
`).value!;

describe("requirement coverage report", () => {
  it("renders hierarchy, per-layer aggregation, every status, gaps, and escaped identities deterministically", () => {
    const evidence = [
      {
        covers: ["REQ-A&amp;/SCN-ONE/CASE-X"],
        layer: "unit",
        status: "passed" as const,
      },
      {
        covers: ["REQ-A&amp;/SCN-ONE/CASE-X"],
        layer: "integration",
        status: "failed" as const,
      },
      {
        covers: ["REQ-A&amp;/SCN-ONE/CASE-X"],
        layer: "system",
        status: "broken" as const,
      },
      {
        covers: ["REQ-A&amp;/SCN-ONE/CASE-X"],
        layer: "manual",
        status: "skipped" as const,
      },
    ];
    const checked = checkVerification(manifest, evidence);
    const first = renderCoverageReport(manifest, checked);
    expect(renderCoverageReport(manifest, checked)).toBe(first);
    for (const status of ["PASS", "FAIL", "BROKEN", "SKIPPED", "MISSING"])
      expect(first).toContain(status);
    expect(first).toContain("Per-layer coverage");
    expect(first).toContain("REQ-A&amp;amp;/SCN-ONE/CASE-X");
    expect(first).toContain("0 / 1 (0%)");
  });

  it("rejects an invalid project without writing a report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-report-test-"));
    directories.push(directory);
    const result = await reportProjectDirectory(directory);
    expect(result.exitCode).toBe(1);
    expect(result.outputPath).toBeUndefined();
    await expect(
      readFile(join(directory, "moura-report/index.html")),
    ).rejects.toThrow();
  });

  it("writes diagnostic HTML but fails for invalid normalized evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-report-test-"));
    directories.push(directory);
    await Promise.all([
      writeFile(
        join(directory, "moura.yaml"),
        `version: 1
sources: { requirements: [req.md], specifications: [spec.md] }
verification: { layers: [unit] }
requirements:
  - id: R
    scenarios:
      - id: S
        cases:
          - { id: C, verify: [unit] }
`,
      ),
      writeFile(join(directory, "req.md"), "## R\n"),
      writeFile(join(directory, "spec.md"), "## R\n### S\n#### C\n"),
      mkdir(join(directory, "allure-results")),
    ]);
    const result = await reportProjectDirectory(directory, {
      loadEvidence: async () => ({
        evidence: [{ covers: ["unknown"], layer: "unit", status: "passed" }],
        issues: [],
      }),
    });
    expect(result.exitCode).toBe(1);
    expect(await readFile(result.outputPath!, "utf8")).toContain(
      "unknown-evidence-id",
    );
  });
});
