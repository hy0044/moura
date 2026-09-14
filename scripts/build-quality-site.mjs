import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import process from "node:process";

for (const entry of ["coverage/index.html", "allure-report/index.html"]) {
  readFileSync(entry);
}
rmSync("_site", { recursive: true, force: true });
mkdirSync("_site", { recursive: true });
cpSync("coverage", "_site/coverage", { recursive: true });
cpSync("allure-report", "_site/allure", { recursive: true });
const sha = process.env.GITHUB_SHA ?? "local build";
writeFileSync(
  "_site/index.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Moura Quality Reports</title></head>
<body><main><h1>Moura Quality Reports</h1><ul><li><a href="./coverage/">Test Coverage</a></li><li><a href="./allure/">Allure Report</a></li></ul><p>Source: <a href="https://github.com/hy0044/moura">hy0044/moura</a></p><p>Commit: <code>${sha}</code></p></main></body></html>\n`,
);
