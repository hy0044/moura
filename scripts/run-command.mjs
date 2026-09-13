import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import process from "node:process";

const windowsShimExtensions = new Set([".bat", ".cmd"]);

function resolveWindowsCommand(command, environment) {
  if (extname(command)) return command;

  const extensions = (environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  const directories =
    isAbsolute(command) || command.includes("/") || command.includes("\\")
      ? [""]
      : (environment.PATH ?? "").split(delimiter);

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = `${directory ? join(directory, command) : command}${extension.toLowerCase()}`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return command;
}

function quoteForCmd(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function runCommand(
  command,
  args,
  {
    cwd,
    platform = process.platform,
    spawn = spawnSync,
    environment = process.env,
    resolveCommand = resolveWindowsCommand,
  } = {},
) {
  const resolvedCommand =
    platform === "win32" ? resolveCommand(command, environment) : command;
  const isWindowsShim =
    platform === "win32" &&
    windowsShimExtensions.has(extname(resolvedCommand).toLowerCase());
  const executable = isWindowsShim
    ? (environment.ComSpec ?? "cmd.exe")
    : resolvedCommand;
  const executableArgs = isWindowsShim
    ? ["/d", "/s", "/c", [resolvedCommand, ...args].map(quoteForCmd).join(" ")]
    : args;
  const result = spawn(executable, executableArgs, {
    cwd,
    encoding: "utf8",
    shell: false,
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
