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
    ["NUL", "REQ-001/SCN-001/CASE\u0000-001"],
    ["C0 control", "REQ-001/SCN-001/CASE\u0001-001"],
    ["DEL", "REQ-001/SCN-001/CASE\u007f-001"],
    ["lone surrogate", "REQ-001/SCN-001/CASE\ud800-001"],
    ["malformed canonical ID", "REQ-001/CASE-001"],
  ])("rejects a moura_case containing %s", (_name, value) => {
    const converted = convertAllureResult(
      result("passed", [{ name: "moura_case", value }, layerLabel]),
      "unsafe-result.json",
    );
    expect(converted.evidence).toEqual([]);
    expect(converted.issues).toContainEqual({
      code: "invalid-moura-case-label",
      message:
        "moura_case contains characters or structure not allowed in a canonical Moura Case ID",
      source: "unsafe-result.json",
    });
  });

  it.each([
    ["NUL", "unit\u0000bad"],
    ["C0 control", "unit\u0001bad"],
    ["DEL", "unit\u007fbad"],
    ["C1 control", "unit\u009fbad"],
    ["lone surrogate", "unit\udfffbad"],
  ])("rejects a moura_layer containing %s", (_name, value) => {
    const converted = convertAllureResult(
      result("passed", [caseLabel, { name: "moura_layer", value }]),
      "unsafe-result.json",
    );
    expect(converted.evidence).toEqual([]);
    expect(converted.issues).toContainEqual({
      code: "invalid-moura-layer-label",
      message:
        "moura_layer contains characters not allowed in a Moura verification-layer name",
      source: "unsafe-result.json",
    });
  });

  it("accepts canonical separators and printable Unicode identities", () => {
    expect(
      convertAllureResult(
        result("passed", [
          { name: "moura_case", value: "要件-一/場面-😀/事例-𠮷" },
          { name: "moura_layer", value: "層-🚀" },
        ]),
      ).evidence,
    ).toEqual([
      {
        covers: ["要件-一/場面-😀/事例-𠮷"],
        layer: "層-🚀",
        status: "passed",
      },
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
