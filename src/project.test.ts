import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { parseManifest } from "./manifest.js";
import { parseSpecificationMarkdown } from "./markdown.js";
import { validateProject, validateProjectDirectory } from "./project.js";

const validManifest = `
version: 1
sources:
  requirements: [req.md]
  specifications: [spec.md]
verification:
  layers: [unit]
requirements:
  - id: REQ-001
    scenarios:
      - id: SCN-001
        cases:
          - id: CASE-001
            verify: [unit]
`;
const validRequirement = "# Requirements\n\n## REQ-001 A title\n";
const validSpecification =
  "# Specification\n\n## REQ-001 A title\n### SCN-001 Behavior\n#### CASE-001 Example\n";

function validate(
  manifest = validManifest,
  requirement = validRequirement,
  specification = validSpecification,
) {
  return validateProject({
    manifest,
    requirementSources: new Map([["req.md", requirement]]),
    specificationSources: new Map([["spec.md", specification]]),
  });
}
function codes(
  manifest: string,
  requirement?: string,
  specification?: string,
): string[] {
  return validate(manifest, requirement, specification).errors.map(
    (item) => item.code,
  );
}

describe("manifest parsing and validation", () => {
  it("accepts a valid manifest", () => assert.deepEqual(validate().errors, []));

  it("rejects a missing or unsupported version", () => {
    assert.ok(
      codes(validManifest.replace("version: 1", "version: 2")).includes(
        "unsupported-version",
      ),
    );
    assert.ok(
      codes(validManifest.replace("version: 1\n", "")).includes(
        "unsupported-version",
      ),
    );
  });

  it("reports duplicate Requirements, Scenarios, and Cases", () => {
    const manifest = validManifest
      .replace(
        "  - id: REQ-001",
        "  - id: REQ-001\n    scenarios: []\n  - id: REQ-001",
      )
      .replace(
        "      - id: SCN-001",
        "      - id: SCN-001\n        cases: []\n      - id: SCN-001",
      )
      .replace(
        "          - id: CASE-001",
        "          - id: CASE-001\n            verify: [unit]\n          - id: CASE-001",
      );
    const found = codes(manifest);
    assert.ok(found.includes("duplicate-requirement"));
    assert.ok(found.includes("duplicate-scenario"));
    assert.ok(found.includes("duplicate-case"));
  });

  it("reports missing Scenario, Case, and verify lists", () => {
    assert.ok(
      codes(
        validManifest.replace(/ {4}scenarios:[\s\S]*$/u, "    scenarios: []\n"),
      ).includes("missing-scenario"),
    );
    assert.ok(
      codes(
        validManifest.replace(/ {8}cases:[\s\S]*$/u, "        cases: []\n"),
      ).includes("missing-case"),
    );
    assert.ok(
      codes(
        validManifest.replace(
          "            verify: [unit]",
          "            verify: []",
        ),
      ).includes("missing-verify"),
    );
  });

  it("reports unknown and duplicate verification layers", () => {
    assert.ok(
      codes(
        validManifest.replace("verify: [unit]", "verify: [other]"),
      ).includes("unknown-verification-layer"),
    );
    assert.ok(
      codes(
        validManifest.replace("layers: [unit]", "layers: [unit, unit]"),
      ).includes("duplicate-verification-layer"),
    );
    assert.ok(
      codes(
        validManifest.replace("verify: [unit]", "verify: [unit, unit]"),
      ).includes("duplicate-verify-layer"),
    );
  });

  it("uses localId validation including Unicode White_Space", () => {
    assert.ok(
      codes(validManifest.replace("REQ-001", "BAD/ID")).includes(
        "invalid-local-id",
      ),
    );
    assert.ok(
      codes(validManifest.replace("SCN-001", "SCN-\u0085001")).includes(
        "invalid-local-id",
      ),
    );
  });

  it("requires requirement and specification source entries", () => {
    assert.ok(
      codes(
        validManifest.replace("requirements: [req.md]", "requirements: []"),
      ).includes("missing-requirement-source"),
    );
    assert.ok(
      codes(
        validManifest.replace(
          "specifications: [spec.md]",
          "specifications: []",
        ),
      ).includes("missing-specification-source"),
    );
  });

  it("reports configured source files that cannot be read", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-test-"));
    try {
      await writeFile(join(directory, "moura.yaml"), validManifest);
      const result = await validateProjectDirectory(directory);
      assert.equal(
        result.errors.filter((item) => item.code === "unreadable-source")
          .length,
        2,
      );
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("collects multiple independent errors", () => {
    const found = codes(
      validManifest
        .replace("verify: [unit]", "verify: [other, other]")
        .replace("layers: [unit]", "layers: []"),
    );
    assert.ok(found.length >= 3);
    assert.ok(found.includes("duplicate-verify-layer"));
    assert.ok(found.includes("unknown-verification-layer"));
  });
});

describe("Markdown hierarchy and canonical matching", () => {
  it("extracts ID tokens rather than complete heading text", () => {
    const parsed = parseManifest(validManifest).value!;
    const result = parseSpecificationMarkdown(
      validSpecification,
      "spec.md",
      parsed,
    );
    assert.deepEqual(result.value?.requirements[0]?.scenarios[0]?.cases, [
      "CASE-001",
    ]);
  });

  it("detects a Case under the wrong Scenario", () => {
    const wrong = "## REQ-001\n### SCN-OTHER\n#### CASE-001\n### SCN-001\n";
    const found = validate(validManifest, validRequirement, wrong).errors;
    assert.ok(found.some((item) => item.code === "missing-specification-case"));
    assert.ok(found.some((item) => item.code === "unmanaged-markdown-id"));
  });

  it("detects missing and unmanaged Markdown nodes", () => {
    assert.ok(
      validate(validManifest, "# Requirements", validSpecification).errors.some(
        (item) => item.code === "missing-requirement-markdown",
      ),
    );
    assert.ok(
      validate(
        validManifest,
        `${validRequirement}\n## REQ-999 Extra`,
        validSpecification,
      ).errors.some((item) => item.code === "unmanaged-markdown-id"),
    );
    assert.ok(
      validate(
        validManifest,
        validRequirement,
        "## REQ-001\n### SCN-001",
      ).errors.some((item) => item.code === "missing-specification-case"),
    );
  });

  it("reports invalid heading parentage", () => {
    const errors = validate(
      validManifest,
      validRequirement,
      "## REQ-001\n## SCN-001\n### CASE-001",
    ).errors;
    assert.ok(
      errors.some((item) => item.code === "invalid-markdown-hierarchy"),
    );
  });
});
