import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const allureStatuses = ["passed", "failed", "broken", "skipped"];

export async function readAllureCounts(directory) {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith("-result.json"))
    .sort();
  const counts = {
    tests: files.length,
    passed: 0,
    failed: 0,
    broken: 0,
    skipped: 0,
  };

  for (const file of files) {
    const path = join(directory, file);
    let result;
    try {
      result = JSON.parse(await readFile(path, "utf8"));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Cannot read Allure test result ${path}: ${detail}`, {
        cause,
      });
    }
    if (!allureStatuses.includes(result?.status)) {
      throw new Error(
        `Allure test result ${path} has unsupported status ${JSON.stringify(result?.status)}`,
      );
    }
    counts[result.status] += 1;
  }

  return counts;
}
