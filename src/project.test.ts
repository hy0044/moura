import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

  it("rejects duplicate YAML mapping keys", () => {
    const result = parseManifest(`version: 1\nversion: 1\n`);
    assert.ok(result.errors.some((item) => item.code === "invalid-yaml"));
    assert.match(
      result.errors[0]?.message ?? "",
      /unique|map keys|duplicate/iu,
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

  it("rejects source paths outside the project directory before reading", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-test-"));
    try {
      for (const source of [
        "../outside.md",
        "/tmp/outside.md",
        "C:\\outside.md",
      ]) {
        const manifest = validManifest.replace("req.md", source);
        await writeFile(join(directory, "moura.yaml"), manifest);
        const result = await validateProjectDirectory(directory);
        assert.ok(
          result.errors.some((item) => item.code === "invalid-source-path"),
          source,
        );
      }
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("rejects a configured source that resolves through a symlink outside the project", async () => {
    const parent = await mkdtemp(join(tmpdir(), "moura-test-"));
    const directory = join(parent, "project");
    try {
      await mkdir(directory);
      await writeFile(join(directory, "moura.yaml"), validManifest);
      await writeFile(join(directory, "spec.md"), validSpecification);
      await writeFile(join(parent, "outside.md"), validRequirement);
      await symlink(join(parent, "outside.md"), join(directory, "req.md"));
      const result = await validateProjectDirectory(directory);
      assert.ok(
        result.errors.some((item) => item.code === "invalid-source-path"),
      );
    } finally {
      await rm(parent, { recursive: true });
    }
  });

  it("allows a configured source that resolves through an internal symlink", async () => {
    const directory = await mkdtemp(join(tmpdir(), "moura-test-"));
    try {
      await writeFile(join(directory, "moura.yaml"), validManifest);
      await writeFile(join(directory, "actual-req.md"), validRequirement);
      await symlink("actual-req.md", join(directory, "req.md"));
      await writeFile(join(directory, "spec.md"), validSpecification);
      assert.deepEqual((await validateProjectDirectory(directory)).errors, []);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("does not substitute an unrelated source-map entry for a configured path", () => {
    const result = validateProject({
      manifest: validManifest,
      requirementSources: new Map([["other.md", validRequirement]]),
      specificationSources: new Map([["spec.md", validSpecification]]),
    });
    assert.ok(result.errors.some((item) => item.code === "missing-source"));
    assert.ok(
      result.errors.some(
        (item) => item.code === "missing-requirement-markdown",
      ),
    );
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

  it("ignores heading-like content in backtick and tilde fences", () => {
    const fenced = `${validSpecification}
\`\`\`md
## REQ-999
### SCN-999
#### CASE-999
\`\`\`
~~~markdown
## REQ-998
### SCN-998
#### CASE-998
~~~~
`;
    assert.deepEqual(
      validate(validManifest, validRequirement, fenced).errors,
      [],
    );
  });

  it("ignores headings in block and single-line HTML comments", () => {
    const commented = `${validSpecification}
<!--
## REQ-999 Disabled requirement
### SCN-999 Disabled scenario
#### CASE-999 Disabled case
-->
<!-- ## REQ-998 Disabled requirement -->
`;
    assert.deepEqual(
      validate(validManifest, validRequirement, commented).errors,
      [],
    );
  });

  it("recognizes ATX headings with up to three leading spaces", () => {
    assert.deepEqual(
      validate(
        validManifest,
        " ## REQ-001 Requirement\n",
        " ## REQ-001 Requirement\n  ### SCN-001 Scenario\n   #### CASE-001 Case\n",
      ).errors,
      [],
    );
  });

  it("does not treat four-space-indented lines as ATX headings", () => {
    const specification = `${validSpecification}\n    ## REQ-999 Not a heading\n`;
    assert.deepEqual(
      validate(validManifest, validRequirement, specification).errors,
      [],
    );
  });

  it("preserves # in the complete whitespace-delimited ID token", () => {
    const manifest = validManifest.replaceAll("REQ-001", "REQ-001#draft");
    assert.deepEqual(
      validate(
        manifest,
        "## REQ-001#draft Requirement\n",
        validSpecification.replace("REQ-001", "REQ-001#draft"),
      ).errors,
      [],
    );
  });

  it("uses hierarchy to disambiguate local IDs shared by every node kind", () => {
    const manifest = validManifest
      .replace("REQ-001", "shared")
      .replace("SCN-001", "shared")
      .replace("CASE-001", "shared");
    const result = validate(
      manifest,
      "# Requirements\n## shared Requirement\n",
      "# Specification\n## shared Requirement\n### shared Scenario\n#### shared Case\n",
    );
    assert.deepEqual(result.errors, []);
  });

  it("allows Requirement/Scenario and Scenario/Case ID sharing independently", () => {
    const requirementScenario = validManifest
      .replace("REQ-001", "same-parent")
      .replace("SCN-001", "same-parent");
    assert.deepEqual(
      validate(
        requirementScenario,
        "## same-parent\n",
        "## same-parent\n### same-parent\n#### CASE-001\n",
      ).errors,
      [],
    );

    const scenarioCase = validManifest
      .replace("SCN-001", "same-child")
      .replace("CASE-001", "same-child");
    assert.deepEqual(
      validate(
        scenarioCase,
        validRequirement,
        "## REQ-001\n### same-child\n#### same-child\n",
      ).errors,
      [],
    );
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
