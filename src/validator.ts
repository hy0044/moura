import { canonicalId, localId } from "./id.js";
import type { MouraManifest } from "./manifest.js";
import type { MarkdownDocument } from "./markdown.js";
import type { TraceNode } from "./model.js";
import { error, type ValidationError } from "./validation.js";

export interface ParsedSources {
  readonly requirements: ReadonlyMap<string, readonly string[]>;
  readonly specifications: ReadonlyMap<string, MarkdownDocument>;
}

/** Pure structural validation over already parsed inputs. */
export function validateStructure(
  manifest: MouraManifest,
  sources: ParsedSources,
): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  nonEmpty(
    manifest.sources.requirements,
    "missing-requirement-source",
    "sources.requirements must contain at least one source",
    errors,
  );
  nonEmpty(
    manifest.sources.specifications,
    "missing-specification-source",
    "sources.specifications must contain at least one source",
    errors,
  );
  nonEmpty(
    manifest.requirements,
    "missing-requirement",
    "requirements must contain at least one Requirement",
    errors,
  );
  nonEmpty(
    manifest.verificationLayers,
    "missing-verification-layer",
    "verification.layers must contain at least one layer",
    errors,
  );

  duplicates(
    manifest.verificationLayers,
    (layer) =>
      error(
        "duplicate-verification-layer",
        `verification layer ${JSON.stringify(layer)} is declared more than once`,
      ),
    errors,
  );

  const requirementIds = new Set<string>();
  const canonicalIds = new Set<string>();
  for (const requirement of manifest.requirements) {
    validateId(requirement.localId, "Requirement", errors);
    duplicate(
      requirementIds,
      requirement.localId,
      "duplicate-requirement",
      `Requirement ${JSON.stringify(requirement.localId)} is declared more than once`,
      errors,
    );
    addCanonical([requirement], canonicalIds, errors);
    nonEmpty(
      requirement.scenarios,
      "missing-scenario",
      `${requirement.localId || "Requirement"} must contain at least one Scenario`,
      errors,
    );
    const scenarioIds = new Set<string>();
    for (const scenario of requirement.scenarios) {
      validateId(scenario.localId, "Scenario", errors);
      duplicate(
        scenarioIds,
        scenario.localId,
        "duplicate-scenario",
        `Scenario ${JSON.stringify(scenario.localId)} is repeated under ${requirement.localId}`,
        errors,
      );
      addCanonical([requirement, scenario], canonicalIds, errors);
      nonEmpty(
        scenario.cases,
        "missing-case",
        `${path([requirement, scenario])} must contain at least one Case`,
        errors,
      );
      const caseIds = new Set<string>();
      for (const testCase of scenario.cases) {
        const nodes = [requirement, scenario, testCase] as const;
        validateId(testCase.localId, "Case", errors);
        duplicate(
          caseIds,
          testCase.localId,
          "duplicate-case",
          `Case ${JSON.stringify(testCase.localId)} is repeated under ${path([requirement, scenario])}`,
          errors,
        );
        addCanonical(nodes, canonicalIds, errors);
        nonEmpty(
          testCase.verify,
          "missing-verify",
          `${path(nodes)} must declare at least one verification layer`,
          errors,
        );
        const verifies = new Set<string>();
        for (const layer of testCase.verify) {
          duplicate(
            verifies,
            layer,
            "duplicate-verify-layer",
            `${path(nodes)} repeats verification layer ${JSON.stringify(layer)}`,
            errors,
          );
          if (!manifest.verificationLayers.includes(layer)) {
            errors.push(
              error(
                "unknown-verification-layer",
                `${path(nodes)} references unknown verification layer ${JSON.stringify(layer)}`,
                { canonicalId: path(nodes) },
              ),
            );
          }
        }
      }
    }
  }
  compareMarkdown(manifest, sources, errors);
  return errors;
}

function compareMarkdown(
  manifest: MouraManifest,
  sources: ParsedSources,
  errors: ValidationError[],
): void {
  const requirementOccurrences = new Map<string, string[]>();
  for (const [source, ids] of sources.requirements) {
    for (const id of ids) append(requirementOccurrences, id, source);
  }
  const specificationOccurrences = new Map<string, string[]>();
  for (const [source, document] of sources.specifications) {
    for (const requirement of document.requirements) {
      append(specificationOccurrences, requirement.id, source);
      for (const scenario of requirement.scenarios) {
        append(
          specificationOccurrences,
          `${requirement.id}/${scenario.id}`,
          source,
        );
        for (const testCase of scenario.cases)
          append(
            specificationOccurrences,
            `${requirement.id}/${scenario.id}/${testCase}`,
            source,
          );
      }
    }
  }
  const expected = new Set<string>();
  for (const requirement of manifest.requirements) {
    expected.add(requirement.localId);
    missing(
      requirementOccurrences,
      requirement.localId,
      "missing-requirement-markdown",
      `${requirement.localId} is declared in moura.yaml but was not found in a requirement source`,
      errors,
    );
    missing(
      specificationOccurrences,
      requirement.localId,
      "missing-specification-requirement",
      `${requirement.localId} is declared in moura.yaml but was not found in a specification source`,
      errors,
    );
    for (const scenario of requirement.scenarios) {
      const scenarioId = `${requirement.localId}/${scenario.localId}`;
      expected.add(scenarioId);
      missing(
        specificationOccurrences,
        scenarioId,
        "missing-specification-scenario",
        `${scenarioId} is declared in moura.yaml but was not found under its expected Requirement`,
        errors,
      );
      for (const testCase of scenario.cases) {
        const caseId = `${scenarioId}/${testCase.localId}`;
        expected.add(caseId);
        missing(
          specificationOccurrences,
          caseId,
          "missing-specification-case",
          `${caseId} is declared in moura.yaml but was not found under its expected Scenario`,
          errors,
        );
      }
    }
  }
  for (const [id, locations] of requirementOccurrences) {
    if (!manifest.requirements.some((item) => item.localId === id))
      errors.push(
        error(
          "unmanaged-markdown-id",
          `${id} in ${locations[0]!} is not declared in moura.yaml`,
          { source: locations[0]! },
        ),
      );
    if (locations.length > 1)
      errors.push(
        error(
          "duplicate-canonical-id",
          `${id} occurs more than once in requirement sources`,
          { canonicalId: id },
        ),
      );
  }
  for (const [id, locations] of specificationOccurrences) {
    if (!expected.has(id))
      errors.push(
        error(
          "unmanaged-markdown-id",
          `${id} in ${locations[0]!} is not declared at that hierarchy in moura.yaml`,
          { canonicalId: id, source: locations[0]! },
        ),
      );
    if (locations.length > 1)
      errors.push(
        error(
          "duplicate-canonical-id",
          `${id} occurs more than once in specification sources`,
          { canonicalId: id },
        ),
      );
  }
}

function validateId(
  value: string,
  kind: string,
  errors: ValidationError[],
): void {
  try {
    localId(value);
  } catch (cause) {
    errors.push(
      error(
        "invalid-local-id",
        `${kind} ${JSON.stringify(value)} is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }
}
function addCanonical(
  nodes: readonly TraceNode[],
  seen: Set<string>,
  errors: ValidationError[],
): void {
  let id: string;
  try {
    id = canonicalId(nodes);
  } catch {
    return;
  }
  duplicate(
    seen,
    id,
    "duplicate-canonical-id",
    `canonical ID ${id} is derived more than once`,
    errors,
  );
}
function path(nodes: readonly TraceNode[]): string {
  try {
    return canonicalId(nodes);
  } catch {
    return nodes.map((node) => node.localId).join("/");
  }
}
function nonEmpty(
  values: readonly unknown[],
  code: string,
  message: string,
  errors: ValidationError[],
): void {
  if (values.length === 0) errors.push(error(code, message));
}
function duplicate(
  seen: Set<string>,
  value: string,
  code: string,
  message: string,
  errors: ValidationError[],
): void {
  if (seen.has(value)) errors.push(error(code, message));
  else seen.add(value);
}
function duplicates(
  values: readonly string[],
  make: (value: string) => ValidationError,
  errors: ValidationError[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(make(value));
    else seen.add(value);
  }
}
function append(map: Map<string, string[]>, id: string, source: string): void {
  const entries = map.get(id) ?? [];
  entries.push(source);
  map.set(id, entries);
}
function missing(
  map: Map<string, string[]>,
  id: string,
  code: string,
  message: string,
  errors: ValidationError[],
): void {
  if (!map.has(id)) errors.push(error(code, message, { canonicalId: id }));
}
