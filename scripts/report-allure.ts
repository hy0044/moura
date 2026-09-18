import { rmSync } from "node:fs";

rmSync("allure-report", { recursive: true, force: true });
