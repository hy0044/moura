import crossSpawn from "cross-spawn";

export function runCommand(
  command,
  args,
  { cwd, spawn = crossSpawn.sync } = {},
) {
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
