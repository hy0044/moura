import { parseDocument, YAMLMap, YAMLSeq, type Node } from "yaml";

import type {
  CaseNode,
  RequirementNode,
  ScenarioNode,
  VerificationLayer,
} from "./model.js";
import {
  error,
  type ValidationError,
  type ValidationResult,
} from "./validation.js";

export interface SourcesConfig {
  readonly requirements: readonly string[];
  readonly specifications: readonly string[];
}

export interface MouraManifest {
  readonly version: number;
  readonly sources: SourcesConfig;
  readonly verificationLayers: readonly VerificationLayer[];
  readonly requirements: readonly RequirementNode[];
}

type Map = YAMLMap<unknown, unknown>;

/** Parse YAML and enforce the closed v0.1 manifest shape. Semantic rules live in the validator. */
export function parseManifest(
  text: string,
  source = "moura.yaml",
): ValidationResult<MouraManifest> {
  const errors: ValidationError[] = [];
  // yaml's default unique-key check makes ambiguous duplicate mappings a
  // normal configuration error while still allowing us to collect diagnostics.
  const document = parseDocument(text);
  for (const problem of document.errors) {
    errors.push(
      error("invalid-yaml", `${source}: ${problem.message}`, { source }),
    );
  }
  const root = document.contents;
  if (!(root instanceof YAMLMap)) {
    errors.push(
      error("invalid-manifest", `${source} must contain a mapping`, { source }),
    );
    return { errors };
  }

  unknownFields(
    root,
    ["version", "sources", "verification", "requirements"],
    source,
    source,
    errors,
  );
  const version = scalar(root, "version");
  if (version !== 1) {
    errors.push(
      error("unsupported-version", `${source} version must be the number 1`, {
        source,
      }),
    );
  }

  const sourcesNode = map(root, "sources", source, source, errors);
  if (sourcesNode)
    unknownFields(
      sourcesNode,
      ["requirements", "specifications"],
      "sources",
      source,
      errors,
    );
  const requirementSources = stringList(
    sourcesNode,
    "requirements",
    "sources.requirements",
    source,
    errors,
  );
  const specificationSources = stringList(
    sourcesNode,
    "specifications",
    "sources.specifications",
    source,
    errors,
  );

  const verification = map(root, "verification", source, source, errors);
  if (verification)
    unknownFields(verification, ["layers"], "verification", source, errors);
  const layers = stringList(
    verification,
    "layers",
    "verification.layers",
    source,
    errors,
  );
  const requirements = objectList(
    root,
    "requirements",
    "requirements",
    source,
    errors,
  ).map((node, index) => requirement(node, index, source, errors));

  const value: MouraManifest = {
    version: typeof version === "number" ? version : 0,
    sources: {
      requirements: requirementSources,
      specifications: specificationSources,
    },
    verificationLayers: layers,
    requirements,
  };
  return { value, errors };
}

function requirement(
  node: Map,
  index: number,
  source: string,
  errors: ValidationError[],
): RequirementNode {
  const path = `requirements[${index}]`;
  unknownFields(node, ["id", "scenarios"], path, source, errors);
  return {
    kind: "requirement",
    localId: stringValue(node, "id", `${path}.id`, source, errors),
    scenarios: objectList(
      node,
      "scenarios",
      `${path}.scenarios`,
      source,
      errors,
    ).map((item, child) =>
      scenario(item, `${path}.scenarios[${child}]`, source, errors),
    ),
  };
}

function scenario(
  node: Map,
  path: string,
  source: string,
  errors: ValidationError[],
): ScenarioNode {
  unknownFields(node, ["id", "cases"], path, source, errors);
  return {
    kind: "scenario",
    localId: stringValue(node, "id", `${path}.id`, source, errors),
    cases: objectList(node, "cases", `${path}.cases`, source, errors).map(
      (item, child) =>
        testCase(item, `${path}.cases[${child}]`, source, errors),
    ),
  };
}

function testCase(
  node: Map,
  path: string,
  source: string,
  errors: ValidationError[],
): CaseNode {
  unknownFields(node, ["id", "verify"], path, source, errors);
  return {
    kind: "case",
    localId: stringValue(node, "id", `${path}.id`, source, errors),
    verify: stringList(node, "verify", `${path}.verify`, source, errors),
  };
}

function map(
  parent: Map,
  key: string,
  path: string,
  source: string,
  errors: ValidationError[],
): Map | undefined {
  const value = parent.get(key, true);
  if (!(value instanceof YAMLMap)) {
    errors.push(
      error("invalid-manifest", `${path}.${key} must be a mapping`, {
        source,
      }),
    );
    return undefined;
  }
  return value;
}

function objectList(
  parent: Map | undefined,
  key: string,
  path: string,
  source: string,
  errors: ValidationError[],
): Map[] {
  const value = parent?.get(key, true);
  if (!(value instanceof YAMLSeq)) {
    errors.push(
      error("invalid-manifest", `${path} must be a list`, {
        source,
      }),
    );
    return [];
  }
  const result: Map[] = [];
  value.items.forEach((item, index) => {
    if (item instanceof YAMLMap) result.push(item);
    else
      errors.push(
        error("invalid-manifest", `${path}[${index}] must be a mapping`, {
          source,
        }),
      );
  });
  return result;
}

function stringList(
  parent: Map | undefined,
  key: string,
  path: string,
  source: string,
  errors: ValidationError[],
): string[] {
  const value = parent?.get(key, true);
  if (!(value instanceof YAMLSeq)) {
    errors.push(
      error("invalid-manifest", `${path} must be a list`, {
        source,
      }),
    );
    return [];
  }
  const result: string[] = [];
  value.items.forEach((item, index) => {
    const parsed = nodeValue(item);
    if (typeof parsed === "string") result.push(parsed);
    else
      errors.push(
        error("invalid-manifest", `${path}[${index}] must be a string`, {
          source,
        }),
      );
  });
  return result;
}

function stringValue(
  parent: Map,
  key: string,
  path: string,
  source: string,
  errors: ValidationError[],
): string {
  const value = scalar(parent, key);
  if (typeof value !== "string") {
    errors.push(
      error("invalid-manifest", `${path} must be a string`, {
        source,
      }),
    );
    return "";
  }
  return value;
}

function scalar(parent: Map, key: string): unknown {
  return nodeValue(parent.get(key, true));
}

function nodeValue(node: Node | null | undefined): unknown {
  return node && "value" in node ? node.value : undefined;
}

function unknownFields(
  node: Map,
  allowed: readonly string[],
  path: string,
  source: string,
  errors: ValidationError[],
): void {
  for (const pair of node.items) {
    const key = nodeValue(pair.key as Node);
    if (typeof key !== "string" || !allowed.includes(key)) {
      errors.push(
        error(
          "unknown-field",
          `${path} contains unknown field ${JSON.stringify(key)}`,
          { source },
        ),
      );
    }
  }
}
