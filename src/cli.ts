#!/usr/bin/env node

const command = process.argv[2];

if (command === "--version" || command === "-v") {
  console.log("moura 0.1.0");
} else {
  console.log(
    "Moura is in early development. Planned commands: validate, check, report.",
  );
  if (command && command !== "--help" && command !== "-h") {
    process.exitCode = 1;
  }
}
