/** The stable domain roles in Moura's traceability hierarchy. */
export type NodeKind = "requirement" | "scenario" | "case";

/** A configurable verification dimension, deliberately not a closed enum. */
export type VerificationLayer = string;

export interface TraceNode {
  readonly kind: NodeKind;
  readonly localId: string;
}

export interface CaseNode extends TraceNode {
  readonly kind: "case";
  readonly verify: readonly VerificationLayer[];
}

export interface ScenarioNode extends TraceNode {
  readonly kind: "scenario";
  readonly cases: readonly CaseNode[];
}

export interface RequirementNode extends TraceNode {
  readonly kind: "requirement";
  readonly scenarios: readonly ScenarioNode[];
}

/** The smallest unit for which verification coverage is evaluated. */
export interface CoveragePoint {
  readonly canonicalCaseId: string;
  readonly layer: VerificationLayer;
}

/** Adapter-neutral evidence. A single result may cover several cases. */
export interface Evidence {
  readonly covers: readonly string[];
  readonly layer: VerificationLayer;
  readonly status: "passed" | "failed" | "skipped";
  readonly source?: string;
}
