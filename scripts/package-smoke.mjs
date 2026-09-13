import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import console from "node:console";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import process from "node:process";

import { runCommand } from "./run-command.mjs";

const root = resolve(import.meta.dirname, "..");
const temporary = await mkdtemp(join(tmpdir(), "moura-package-smoke-"));
const packageDirectory = join(temporary, "consumer");
const fixture = join(temporary, "passing-project");

function run(command, args, cwd = root) {
  const result = runCommand(command, args, { cwd });
  return `${result.stdout}${result.stderr}`;
}

try {
  await cp(join(root, "test/fixtures/passing-project"), fixture, {
    recursive: true,
  });
  const packed = run("pnpm", ["pack", "--pack-destination", temporary]);
  const tarballName = packed.trim().split(/\r?\n/u).at(-1);
  if (!tarballName) throw new Error("pnpm pack did not report a tarball");
  const tarball = join(temporary, basename(tarballName));
  await access(tarball);
  await rm(packageDirectory, { recursive: true, force: true });
  run(process.execPath, [
    "-e",
    "require('fs').mkdirSync(process.argv[1], {recursive:true})",
    packageDirectory,
  ]);
  run("npm", ["init", "-y"], packageDirectory);
  run("npm", ["install", tarball], packageDirectory);
  const binary = join(packageDirectory, "node_modules", ".bin", "moura");
  const packageJson = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const version = run(binary, ["--version"], packageDirectory);
  if (version.trim() !== `moura ${packageJson.version}`)
    throw new Error(`Unexpected version: ${version}`);
  run(binary, ["--help"], packageDirectory);
  run(binary, ["validate", fixture], packageDirectory);
  run(binary, ["check", fixture], packageDirectory);
  console.log("Packed package installed CLI smoke test passed.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
