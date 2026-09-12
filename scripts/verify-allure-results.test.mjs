import { describe, expect, it } from "vitest";

import { validateMouraEvidenceResults } from "./verify-allure-results.mjs";

const knownCases = new Set(["REQ-002/SCN-001/CASE-001"]);
const knownLayers = new Set(["unit"]);

function result(...labels) {
  return { name: "evidence result", labels };
}

describe("Allure Moura evidence metadata verification", () => {
  it("accepts ordinary results without Moura labels", () => {
    expect(() =>
      validateMouraEvidenceResults([result()], knownCases, knownLayers),
    ).not.toThrow();
  });

  it.each([
    {
      name: "missing moura_case",
      labels: [{ name: "moura_layer", value: "unit" }],
      message: "no moura_case",
    },
    {
      name: "missing moura_layer",
      labels: [{ name: "moura_case", value: "REQ-002/SCN-001/CASE-001" }],
      message: "no moura_layer",
    },
    {
      name: "duplicate moura_layer",
      labels: [
        { name: "moura_case", value: "REQ-002/SCN-001/CASE-001" },
        { name: "moura_layer", value: "unit" },
        { name: "moura_layer", value: "unit" },
      ],
      message: "exactly one moura_layer",
    },
    {
      name: "unknown Case",
      labels: [
        { name: "moura_case", value: "REQ-999/SCN-999/CASE-999" },
        { name: "moura_layer", value: "unit" },
      ],
      message: "unknown Moura Case",
    },
    {
      name: "unknown layer",
      labels: [
        { name: "moura_case", value: "REQ-002/SCN-001/CASE-001" },
        { name: "moura_layer", value: "system" },
      ],
      message: "unknown Moura verification layer",
    },
  ])("rejects $name", ({ labels, message }) => {
    expect(() =>
      validateMouraEvidenceResults(
        [result(...labels)],
        knownCases,
        knownLayers,
      ),
    ).toThrow(message);
  });
});
