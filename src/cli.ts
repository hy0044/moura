#!/usr/bin/env node

import { validateProjectDirectory } from "./project.js";

const command = process.argv[2];

if (command === "--version" || command === "-v") {
  console.log("moura 0.1.0");
} else if (command === "validate") {
  const result = await validateProjectDirectory(process.cwd());
  if (result.errors.length === 0) {
    console.log("✓ Traceability is valid");
  } else {
    console.error("✗ Traceability validation failed");
    for (const problem of result.errors) console.error(`- ${problem.message}`);
    process.exitCode = 1;
  }
} else {
  console.log(
    "Moura is in early development. Planned commands: validate, check, report.",
  );
  if (command && command !== "--help" && command !== "-h") {
    process.exitCode = 1;
  }
}
