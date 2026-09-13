import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { convertAllureResult, loadAllureResultsDirectory } from "./allure.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

function result(status: unknown = "passed", labels: readonly unknown[] = []) {
  return { status, labels };
}

const caseLabel = { name: "moura_case", value: "REQ-001/SCN-001/CASE-001" };
const layerLabel = { name: "moura_layer", value: "unit" };

describe("Allure evidence conversion", () => {
  it.each(["passed", "failed", "broken", "skipped"] as const)(
    "maps %s without an Allure runtime dependency",
    (status) => {
      expect(
        convertAllureResult(
          result(status, [caseLabel, layerLabel]),
          "one.json",
        ),
      ).toEqual({
        evidence: [
          {
            covers: ["REQ-001/SCN-001/CASE-001"],
            layer: "unit",
            status,
            source: "one.json",
          },
        ],
        issues: [],
      });
    },
  );

  it.each([
    [
      "unknown status",
      result("unknown", [caseLabel, layerLabel]),
      "unknown-status",
    ],
    ["missing status", { labels: [caseLabel, layerLabel] }, "missing-status"],
    [
      "unsupported status",
      result("pending", [caseLabel, layerLabel]),
      "unsupported-status",
    ],
    [
      "non-string status",
      result(42, [caseLabel, layerLabel]),
      "malformed-status",
    ],
  ])("reports %s as an adapter issue", (_name, input, code) => {
    const converted = convertAllureResult(input, "bad.json");
    expect(converted.evidence).toEqual([]);
    expect(converted.issues).toContainEqual(
      expect.objectContaining({ code, source: "bad.json" }),
    );
  });

  it("collects multiple Cases and de-duplicates them in first-seen order", () => {
    const converted = convertAllureResult(
      result("passed", [
        caseLabel,
        { name: "moura_case", value: "REQ-001/SCN-001/CASE-002" },
        caseLabel,
        layerLabel,
      ]),
    );
    expect(converted.evidence[0]?.covers).toEqual([
      "REQ-001/SCN-001/CASE-001",
      "REQ-001/SCN-001/CASE-002",
    ]);
  });

  it.each([
    ["missing Case", [layerLabel], "missing-moura-case"],
    ["missing layer", [caseLabel], "missing-moura-layer"],
    [
      "multiple layers",
      [caseLabel, layerLabel, { name: "moura_layer", value: "integration" }],
      "multiple-moura-layers",
    ],
  ])("reports %s metadata", (_name, labels, code) => {
    const converted = convertAllureResult(result("passed", labels));
    expect(converted.evidence).toEqual([]);
    expect(converted.issues).toContainEqual(expect.objectContaining({ code }));
  });

  it("ignores results with no Moura labels", () => {
    expect(
      convertAllureResult(
        result("unknown", [{ name: "suite", value: "unrelated" }]),
        "unrelated.json",
      ),
    ).toEqual({ evidence: [], issues: [] });
  });
});

describe("Allure results directory loading", () => {
  it("loads only sorted result files and reports malformed JSON deterministically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-allure-"));
    temporaryDirectories.push(directory);
    await Promise.all([
      writeFile(join(directory, "z-result.json"), "not json"),
      writeFile(
        join(directory, "b-result.json"),
        JSON.stringify(result("broken", [caseLabel, layerLabel])),
      ),
      writeFile(
        join(directory, "a-result.json"),
        JSON.stringify(result("passed", [caseLabel, layerLabel])),
      ),
      writeFile(join(directory, "ignored-container.json"), "not json"),
      writeFile(join(directory, "categories.json"), "not json"),
    ]);

    const loaded = await loadAllureResultsDirectory(directory);
    expect(
      loaded.evidence.map(({ status, source }) => [status, source]),
    ).toEqual([
      ["passed", "a-result.json"],
      ["broken", "b-result.json"],
    ]);
    expect(loaded.issues).toEqual([
      expect.objectContaining({
        code: "malformed-json",
        source: "z-result.json",
      }),
    ]);
  });
});
