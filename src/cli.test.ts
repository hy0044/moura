import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url));
const validManifest = `
version: 1
sources:
  requirements: [req.md]
  specifications: [spec.md]
verification:
  layers: [unit]
requirements:
  - id: REQ-001
    scenarios:
      - id: SCN-001
        cases:
          - id: CASE-001
            verify: [unit]
`;

function run(args: readonly string[], cwd: string) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

async function writeValidProject(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "moura.yaml"), validManifest),
    writeFile(join(directory, "req.md"), "# Requirements\n\n## REQ-001\n"),
    writeFile(
      join(directory, "spec.md"),
      "# Specification\n\n## REQ-001\n### SCN-001\n#### CASE-001\n",
    ),
  ]);
}

describe("CLI", () => {
  it("validates the current working directory when no directory is given", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-cli-test-"));
    try {
      await writeValidProject(directory);
      const result = run(["validate"], directory);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Traceability is valid/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("validates the requested relative directory instead of the invalid cwd", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-cli-test-"));
    try {
      await writeValidProject(join(directory, "valid-project"));
      const result = run(["validate", "valid-project"], directory);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Traceability is valid/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("fails for a missing project directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-cli-test-"));
    try {
      const result = run(["validate", "missing-project"], directory);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /validation failed/u);
      assert.match(result.stderr, /Cannot read configured manifest source/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("preserves help and version behavior", () => {
    const version = run(["--version"], process.cwd());
    assert.equal(version.status, 0, version.stderr);
    assert.match(version.stdout, /moura 0\.1\.0/u);

    const help = run(["--help"], process.cwd());
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Moura is in early development/u);
  });
});
