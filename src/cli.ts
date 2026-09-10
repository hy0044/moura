#!/usr/bin/env node

import { validateProjectDirectory } from "./project.js";

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
} else {
  console.log(
    "Moura is in early development. Planned commands: validate, check, report.",
  );
  if (command && command !== "--help" && command !== "-h") {
    process.exitCode = 1;
  }
}
