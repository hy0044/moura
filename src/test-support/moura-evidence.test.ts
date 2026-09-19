import { afterEach, describe, expect, it } from "vitest";

import { mouraEvidenceName } from "./moura-evidence.js";

const originalMetadata = process.env.MOURA_ALLURE_METADATA;

afterEach(() => {
  if (originalMetadata === undefined) delete process.env.MOURA_ALLURE_METADATA;
  else process.env.MOURA_ALLURE_METADATA = originalMetadata;
});

describe("Moura Allure metadata names", () => {
  it("derives local hierarchy labels from canonical Case IDs", () => {
    process.env.MOURA_ALLURE_METADATA = "true";
    expect(
      mouraEvidenceName("evidence", ["REQ-002/SCN-001/CASE-002"], "unit"),
    ).toBe(
      "evidence @allure.label.moura_requirement:REQ-002 " +
        "@allure.label.moura_scenario:SCN-001 " +
        "@allure.label.moura_case:CASE-002 @allure.label.moura_layer:unit",
    );
  });

  it("emits an aligned hierarchy triple for every covered Case", () => {
    process.env.MOURA_ALLURE_METADATA = "true";
    const name = mouraEvidenceName(
      "evidence",
      ["REQ-001/SCN-001/CASE-001", "REQ-002/SCN-002/CASE-002"],
      "unit",
    );
    expect(name.match(/moura_requirement:/gu)).toHaveLength(2);
    expect(name.match(/moura_scenario:/gu)).toHaveLength(2);
    expect(name.match(/moura_case:/gu)).toHaveLength(2);
  });
});
