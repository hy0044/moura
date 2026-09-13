#!/usr/bin/env node

import { validateProjectDirectory } from "./project.js";
import { checkProjectDirectory } from "./check-command.js";

const [command, ...commandArguments] = process.argv.slice(2);

if (command === "--version" || command === "-v") {
  console.log("moura 0.1.0");
} else if (command === "validate") {
  if (commandArguments.length > 1) {
    console.error("Usage: moura validate [directory]");
    process.exitCode = 1;
  } else {
    const directory = commandArguments[0] ?? process.cwd();
    const result = await validateProjectDirectory(directory);
    if (result.errors.length === 0) {
      console.log("✓ Traceability is valid");
    } else {
      console.error("✗ Traceability validation failed");
      for (const problem of result.errors)
        console.error(`- ${problem.message}`);
      process.exitCode = 1;
    }
  }
} else if (command === "check") {
  if (commandArguments.length > 1) {
    console.error("Usage: moura check [directory]");
    process.exitCode = 1;
  } else {
    const result = await checkProjectDirectory(
      commandArguments[0] ?? process.cwd(),
    );
    for (const line of result.stdout) console.log(line);
    for (const line of result.stderr) console.error(line);
    process.exitCode = result.exitCode;
  }
} else {
  console.log(
    [
      "Moura is in early development.",
      "Available commands: validate, check.",
      "Planned commands: report.",
    ].join("\n"),
  );
  if (command && command !== "--help" && command !== "-h") {
    process.exitCode = 1;
  }
}
