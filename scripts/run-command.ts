import type { URL } from "node:url";

import crossSpawn from "cross-spawn";

interface SpawnResult {
  readonly status: number | null;
  readonly stdout?: string | null;
  readonly stderr?: string | null;
  readonly error?: Error;
}

interface SpawnOptions {
  readonly cwd: string | URL | undefined;
  readonly encoding: "utf8";
}

export type SpawnFunction = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => SpawnResult;

export interface RunCommandOptions {
  readonly cwd?: string | URL;
  readonly spawn?: SpawnFunction;
}

export interface CommandOutput {
  readonly stdout: string;
  readonly stderr: string;
}

const spawnSync: SpawnFunction = (command, args, options) =>
  crossSpawn.sync(command, [...args], options);

export function runCommand(
  command: string,
  args: readonly string[],
  { cwd, spawn = spawnSync }: RunCommandOptions = {},
): CommandOutput {
  const result = spawn(command, args, {
    cwd,
    encoding: "utf8",
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with status ${String(result.status)}\n${stdout}${stderr}`,
    );
  }
  return { stdout, stderr };
}
