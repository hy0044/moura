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

  it("propagates a custom manifest source to every parsing error", () => {
    const nested = parseManifest(
      `
version: 2
unexpected: true
sources:
  unexpected: true
  requirements: wrong
verification:
  unexpected: true
  layers: [1]
requirements:
  - unexpected: true
    scenarios:
      - id: SCN-001
        unexpected: true
        cases:
          - unexpected: true
            verify: wrong
`,
      "config/custom.yaml",
    );
    const missingMappings = parseManifest(
      "version: 1\nsources: wrong\nverification: wrong\nrequirements: wrong\n",
      "config/custom.yaml",
    );
    const errors = [...nested.errors, ...missingMappings.errors];
    assert.ok(errors.length > 0);
    assert.ok(errors.some((item) => item.code === "unsupported-version"));
    assert.ok(errors.some((item) => item.code === "unknown-field"));
    assert.ok(errors.some((item) => item.code === "invalid-manifest"));
    assert.deepEqual(
      new Set(errors.map((item) => item.source)),
      new Set(["config/custom.yaml"]),
    );
  });

  it("keeps moura.yaml as the default manifest error source", () => {
    const result = parseManifest("version: 2\n");
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.every((item) => item.source === "moura.yaml"));
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

  it("rejects a manifest symlink that resolves outside the project", async () => {
    const parent = await mkdtemp(join(tmpdir(), "moura-test-"));
    const directory = join(parent, "project");
    try {
      await mkdir(directory);
      await writeFile(join(parent, "outside.yaml"), validManifest);
      await symlink(
        join(parent, "outside.yaml"),
        join(directory, "moura.yaml"),
      );
      const result = await validateProjectDirectory(directory);
      assert.ok(
        result.errors.some((item) => item.code === "invalid-source-path"),
      );
    } finally {
      await rm(parent, { recursive: true });
    }
  });

  it("allows a manifest symlink that resolves inside the real project root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "moura-test-"));
    const directory = join(parent, "project");
    const linkedDirectory = join(parent, "linked-project");
    try {
      await mkdir(directory);
      await mkdir(join(directory, "config"));
      await writeFile(join(directory, "config", "moura.yaml"), validManifest);
      await symlink("config/moura.yaml", join(directory, "moura.yaml"));
      await writeFile(join(directory, "req.md"), validRequirement);
      await writeFile(join(directory, "spec.md"), validSpecification);
      await symlink(directory, linkedDirectory);
      assert.deepEqual(
        (await validateProjectDirectory(linkedDirectory)).errors,
        [],
      );
    } finally {
      await rm(parent, { recursive: true });
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

  it("rejects non-project-relative paths before source-map lookup", () => {
    const cases = [
      ["requirement", "/absolute/req.md"],
      ["specification", "/absolute/spec.md"],
      ["requirement", "../req.md"],
      ["specification", "../../spec.md"],
    ] as const;

    for (const [kind, source] of cases) {
      const manifest = validManifest.replace(
        kind === "requirement" ? "req.md" : "spec.md",
        source,
      );
      const result = validateProject({
        manifest,
        requirementSources: new Map([
          [kind === "requirement" ? source : "req.md", validRequirement],
        ]),
        specificationSources: new Map([
          [kind === "specification" ? source : "spec.md", validSpecification],
        ]),
      });
      assert.ok(
        result.errors.some(
          (item) =>
            item.code === "invalid-source-path" && item.source === source,
        ),
        `${kind} source ${source}`,
      );
    }
  });

  it("accepts nested project-relative source paths", () => {
    const manifest = validManifest
      .replace("req.md", "docs/requirements.md")
      .replace("spec.md", "specifications/spec.md");
    const result = validateProject({
      manifest,
      requirementSources: new Map([["docs/requirements.md", validRequirement]]),
      specificationSources: new Map([
        ["specifications/spec.md", validSpecification],
      ]),
    });
    assert.deepEqual(result.errors, []);
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

  it("does not recognize a Requirement heading inside a blockquote", () => {
    const errors = validate(
      validManifest,
      "> ## REQ-001 Retired requirement\n",
      validSpecification,
    ).errors;
    assert.ok(
      errors.some((item) => item.code === "missing-requirement-markdown"),
    );
  });

  it("does not satisfy the specification with a quoted hierarchy", () => {
    const quoted = [
      "> ## REQ-001 Old requirement",
      ">",
      "> ### SCN-001 Old scenario",
      ">",
      "> #### CASE-001 Old case",
      "",
    ].join("\n");
    const errors = validate(validManifest, validRequirement, quoted).errors;
    assert.ok(
      errors.some((item) => item.code === "missing-specification-requirement"),
    );
    assert.ok(
      errors.some((item) => item.code === "missing-specification-scenario"),
    );
    assert.ok(
      errors.some((item) => item.code === "missing-specification-case"),
    );
  });

  it("recognizes a top-level Requirement, Scenario, and Case hierarchy", () => {
    assert.deepEqual(
      validate(validManifest, validRequirement, validSpecification).errors,
      [],
    );
  });

  it("does not recognize a heading nested inside a list", () => {
    const errors = validate(
      validManifest,
      "- ## REQ-001 Listed requirement\n",
      validSpecification,
    ).errors;
    assert.ok(
      errors.some((item) => item.code === "missing-requirement-markdown"),
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

  it("detects every reserved Moura ID prefix in requirement sources", () => {
    for (const id of ["REQ-999", "SCN-999", "CASE-999"]) {
      const errors = validate(
        validManifest,
        `${validRequirement}\n## ${id} Undeclared`,
        validSpecification,
      ).errors;
      assert.ok(
        errors.some(
          (item) =>
            item.code === "unmanaged-markdown-id" && item.message.includes(id),
        ),
        `expected ${id} to be reported as unmanaged`,
      );
    }
  });

  it("does not report declared child IDs as unmanaged in requirement sources", () => {
    const requirement = `${validRequirement}
## SCN-001 Scenario details belong elsewhere
## CASE-001 Case details belong elsewhere`;
    assert.deepEqual(
      validate(validManifest, requirement, validSpecification).errors,
      [],
    );
  });

  it("does not use a reserved prefix as a manifest node kind", () => {
    const manifest = validManifest
      .replace("REQ-001", "SCN-requirement")
      .replace("SCN-001", "CASE-scenario")
      .replace("CASE-001", "REQ-case");
    assert.deepEqual(
      validate(
        manifest,
        "## SCN-requirement Requirement\n",
        "## SCN-requirement\n### CASE-scenario\n#### REQ-case\n",
      ).errors,
      [],
    );
  });

  it("does not let child IDs in a requirement source satisfy specification hierarchy", () => {
    const requirement = `${validRequirement}
## SCN-001 Misplaced scenario
### CASE-001 Misplaced case`;
    const errors = validate(
      validManifest,
      requirement,
      "## REQ-001 Requirement only",
    ).errors;
    assert.ok(
      errors.some((item) => item.code === "missing-specification-scenario"),
    );
    assert.ok(
      errors.some((item) => item.code === "missing-specification-case"),
    );
    assert.ok(!errors.some((item) => item.code === "unmanaged-markdown-id"));
  });

  it("ignores ordinary undeclared headings in requirement sources", () => {
    assert.deepEqual(
      validate(
        validManifest,
        `${validRequirement}\n## Architecture Notes`,
        validSpecification,
      ).errors,
      [],
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
