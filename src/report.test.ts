import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkVerification } from "./check.js";
import { parseManifest, type MouraManifest } from "./manifest.js";
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

  it("renders colliding control-containing identities visibly and unambiguously", () => {
    const collisionManifest: MouraManifest = {
      version: 1,
      sources: { requirements: ["req.md"], specifications: ["spec.md"] },
      verificationLayers: ["y\0<z>", "<z>", "layer�", "layer\\u0000"],
      requirements: [
        {
          kind: "requirement",
          localId: "r\\oot",
          scenarios: [
            {
              kind: "scenario",
              localId: "s",
              cases: [
                { kind: "case", localId: "x", verify: ["y\0<z>"] },
                { kind: "case", localId: "x\0y", verify: ["<z>"] },
                { kind: "case", localId: "x�y", verify: ["layer�"] },
                {
                  kind: "case",
                  localId: "x\\u0000y",
                  verify: ["layer\\u0000"],
                },
              ],
            },
          ],
        },
      ],
    };
    const checked = checkVerification(collisionManifest, [
      { covers: ["r\\oot/s/x"], layer: "y\0<z>", status: "passed" },
      { covers: ["r\\oot/s/x\0y"], layer: "<z>", status: "failed" },
      { covers: ["r\\oot/s/x�y"], layer: "layer�", status: "broken" },
      {
        covers: ["r\\oot/s/x\\u0000y"],
        layer: "layer\\u0000",
        status: "skipped",
      },
    ]);

    const html = renderCoverageReport(collisionManifest, checked);

    expect(renderCoverageReport(collisionManifest, checked)).toBe(html);
    expect(html).toContain(
      '<h4>r\\\\oot/s/x</h4><ul><li><code>y\\u0000&lt;z&gt;</code> <span class="status pass">PASS</span>',
    );
    expect(html).toContain(
      '<h4>r\\\\oot/s/x\\u0000y</h4><ul><li><code>&lt;z&gt;</code> <span class="status fail">FAIL</span>',
    );
    expect(html).toContain(
      '<h4>r\\\\oot/s/x�y</h4><ul><li><code>layer�</code> <span class="status broken">BROKEN</span>',
    );
    expect(html).toContain(
      '<h4>r\\\\oot/s/x\\\\u0000y</h4><ul><li><code>layer\\\\u0000</code> <span class="status skipped">SKIPPED</span>',
    );
    expect(html).not.toContain("\0");
    expect(html).not.toContain("<code>y\\u0000<z></code>");
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
    expect(result.errors).toEqual([
      expect.stringContaining(
        'unknown-evidence-id: unknown [unit]: Evidence refers to unknown canonical ID "unknown"',
      ),
    ]);
    expect(await readFile(result.outputPath!, "utf8")).toContain(
      "unknown-evidence-id",
    );
  });

  it("identifies adapter issue sources in command and escaped HTML diagnostics", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-report-test-"));
    directories.push(directory);
    await writeProject(directory);
    const result = await reportProjectDirectory(directory, {
      loadEvidence: async () => ({
        evidence: [],
        issues: [
          {
            code: "malformed-json",
            message: "Invalid <JSON>\0\\u0000",
            source: "broken\0-result.json",
          },
          { code: "unreadable-results-directory", message: "Cannot read" },
        ],
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.errors).toEqual([
      "malformed-json: broken\0-result.json: Invalid <JSON>\0\\u0000",
      "unreadable-results-directory: Cannot read",
    ]);
    const html = await readFile(result.outputPath!, "utf8");
    expect(html).toContain(
      "malformed-json: broken\\u0000-result.json: Invalid &lt;JSON&gt;\\u0000\\\\u0000",
    );
    expect(html).not.toContain("\0");
    expect(html).toContain("unreadable-results-directory: Cannot read");
    expect(html).not.toContain("undefined");
  });

  it("rejects a symlinked report directory without writing outside the project", async () => {
    const parent = await mkdtemp(join(tmpdir(), "moura-report-test-"));
    directories.push(parent);
    const directory = join(parent, "project");
    const outside = join(parent, "outside");
    await writeProject(directory);
    await mkdir(outside);
    await writeFile(join(outside, "index.html"), "outside sentinel");
    await symlink(outside, join(directory, "moura-report"), "junction");

    const result = await reportProjectDirectory(directory);

    expect(result.exitCode).toBe(1);
    expect(result.outputPath).toBeUndefined();
    expect(result.errors.join("\n")).toContain("must not be a symbolic link");
    expect(await readFile(join(outside, "index.html"), "utf8")).toBe(
      "outside sentinel",
    );
  });

  it("rejects a symlinked report entry point without overwriting its target", async () => {
    const parent = await mkdtemp(join(tmpdir(), "moura-report-test-"));
    directories.push(parent);
    const directory = join(parent, "project");
    const outside = join(parent, "outside.html");
    await writeProject(directory);
    await mkdir(join(directory, "moura-report"));
    await writeFile(outside, "outside sentinel");
    await symlink(outside, join(directory, "moura-report", "index.html"));

    const result = await reportProjectDirectory(directory);

    expect(result.exitCode).toBe(1);
    expect(result.outputPath).toBeUndefined();
    expect(result.errors.join("\n")).toContain(
      "index.html must not be a symbolic link",
    );
    expect(await readFile(outside, "utf8")).toBe("outside sentinel");
  });
});

async function writeProject(directory: string): Promise<void> {
  await mkdir(join(directory, "allure-results"), { recursive: true });
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
  ]);
}
