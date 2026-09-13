import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

rmSync("allure-report", { recursive: true, force: true });
const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "allure", "generate", "--output", "allure-report"],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
