import type { NodeKind, TraceNode } from "./model.js";

const SEPARATOR = "/";

export type LocalId = string;
export type CanonicalId = string;

export class InvalidLocalIdError extends Error {
  constructor(localId: string, reason: string) {
    super(`Invalid local ID ${JSON.stringify(localId)}: ${reason}`);
    this.name = "InvalidLocalIdError";
  }
}

/**
 * Applies the invariant shared by every node kind. Naming patterns remain a
 * configuration concern so the core is not coupled to REQ/SCN/CASE prefixes.
 */
export function localId(value: string): LocalId {
  if (value.length === 0) {
    throw new InvalidLocalIdError(value, "must not be empty");
  }
  if (value.includes(SEPARATOR)) {
    throw new InvalidLocalIdError(
      value,
      `must not contain reserved separator '${SEPARATOR}'`,
    );
  }
  return value;
}

/** The single construction point for logical canonical IDs. */
export function canonicalId(nodes: readonly TraceNode[]): CanonicalId {
  if (nodes.length === 0) {
    throw new Error("A canonical ID requires at least one node");
  }

  assertHierarchy(nodes.map((node) => node.kind));
  return nodes.map((node) => localId(node.localId)).join(SEPARATOR);
}

function assertHierarchy(kinds: readonly NodeKind[]): void {
  const hierarchy: readonly NodeKind[] = ["requirement", "scenario", "case"];
  if (
    kinds.length > hierarchy.length ||
    kinds.some((kind, index) => kind !== hierarchy[index])
  ) {
    throw new Error(`Invalid node hierarchy: ${kinds.join(" -> ")}`);
  }
}
