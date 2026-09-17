import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import process from "node:process";

for (const entry of [
  "moura-report/index.html",
  "allure-report/index.html",
  "coverage/index.html",
]) {
  readFileSync(entry);
}
rmSync("_site", { recursive: true, force: true });
mkdirSync("_site", { recursive: true });
cpSync("coverage", "_site/coverage", { recursive: true });
cpSync("allure-report", "_site/allure", { recursive: true });
cpSync("moura-report", "_site/moura", { recursive: true });
const sha = process.env.GITHUB_SHA?.slice(0, 7) ?? "local build";
writeFileSync(
  "_site/index.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="format-detection" content="telephone=no"><title>Moura Quality Reports</title>
<style>body{font:16px system-ui,sans-serif;line-height:1.5;max-width:72rem;margin:auto;padding:2rem;color:#172033}h1,h2{line-height:1.2}.intro{margin-bottom:2rem}.reports{display:grid;gap:1rem}.report{display:block;border:1px solid #ccd3df;border-radius:.5rem;padding:1.25rem;color:inherit;text-decoration:none}.report:first-child{border-color:#167044;border-width:2px}.report h2{margin:0 0 .35rem;font-size:1.2rem}.report p{margin:.35rem 0;color:#4b5565}.open{font-weight:700;color:#167044}.meta{margin-top:2rem;font-size:.9rem}.meta p{margin:.25rem 0}.meta a{color:#167044}@media(max-width:40rem){body{padding:1rem}.intro{margin-bottom:1.5rem}}</style></head>
<body><main><h1>Moura Quality Reports</h1><p class="intro">Quality reports generated from Moura's own CI.</p><div class="reports">
<a class="report" href="./moura/"><h2>Requirement Coverage</h2><p>Declared traceability and verification status</p><span class="open">Open →</span></a>
<a class="report" href="./allure/"><h2>Allure Report</h2><p>Test execution details</p><span class="open">Open →</span></a>
<a class="report" href="./coverage/"><h2>Code Coverage</h2><p>Source code coverage</p><span class="open">Open →</span></a>
</div><footer class="meta"><p>Source: <a href="https://github.com/specxai/moura">specxai/moura</a></p><p>Commit: <code>${sha}</code></p></footer></main></body></html>\n`,
);
