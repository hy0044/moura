import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

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

async function run(args: readonly string[], cwd: string) {
  const originalArgv = process.argv;
  const originalCwd = process.cwd();
  const originalExitCode = process.exitCode;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = vi
    .spyOn(console, "log")
    .mockImplementation((...values) => stdout.push(values.join(" ")));
  const error = vi
    .spyOn(console, "error")
    .mockImplementation((...values) => stderr.push(values.join(" ")));

  try {
    process.argv = [process.execPath, "moura", ...args];
    process.chdir(cwd);
    process.exitCode = undefined;
    vi.resetModules();
    await import("./cli.js");
    return {
      status: process.exitCode ?? 0,
      stdout: `${stdout.join("\n")}\n`,
      stderr: `${stderr.join("\n")}\n`,
    };
  } finally {
    process.argv = originalArgv;
    process.chdir(originalCwd);
    process.exitCode = originalExitCode;
    log.mockRestore();
    error.mockRestore();
  }
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
      const result = await run(["validate"], directory);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/Traceability is valid/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("validates the requested relative directory instead of the invalid cwd", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-cli-test-"));
    try {
      await writeValidProject(join(directory, "valid-project"));
      const result = await run(["validate", "valid-project"], directory);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/Traceability is valid/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("fails for a missing project directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-cli-test-"));
    try {
      const result = await run(["validate", "missing-project"], directory);
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/validation failed/u);
      expect(result.stderr).toMatch(/Cannot read configured manifest source/u);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("lists validate as available and only unimplemented commands as planned", async () => {
    for (const args of [[], ["--help"]]) {
      const help = await run(args, process.cwd());
      expect(help.status, help.stderr).toBe(0);
      expect(help.stdout).toMatch(/^Available commands: validate\.$/mu);
      expect(help.stdout).toMatch(/^Planned commands: check, report\.$/mu);
      expect(help.stdout).not.toMatch(/^Planned commands:.*validate/mu);
    }
  });

  it("preserves version behavior", async () => {
    const version = await run(["--version"], process.cwd());
    expect(version.status, version.stderr).toBe(0);
    expect(version.stdout).toMatch(/moura 0\.1\.0/u);
  });
});
