import type { MouraManifest } from "./manifest.js";
import {
  error,
  type ValidationError,
  type ValidationResult,
} from "./validation.js";

export interface MarkdownRequirement {
  readonly id: string;
  readonly scenarios: readonly MarkdownScenario[];
}
export interface MarkdownScenario {
  readonly id: string;
  readonly cases: readonly string[];
}
export interface MarkdownDocument {
  readonly requirements: readonly MarkdownRequirement[];
}

interface Heading {
  readonly depth: number;
  readonly token: string;
}

export function parseRequirementMarkdown(
  text: string,
  source: string,
  manifest: MouraManifest,
): ValidationResult<readonly string[]> {
  const expected = new Set(manifest.requirements.map((item) => item.localId));
  const requirements = headings(text)
    .filter(({ token }) => expected.has(token) || token.startsWith("REQ-"))
    .map(({ token }) => token);
  return { value: requirements, errors: [] };
}

export function parseSpecificationMarkdown(
  text: string,
  source: string,
  manifest: MouraManifest,
): ValidationResult<MarkdownDocument> {
  const errors: ValidationError[] = [];
  const reqIds = new Set(manifest.requirements.map((node) => node.localId));
  const scnIds = new Set(
    manifest.requirements.flatMap((node) =>
      node.scenarios.map((child) => child.localId),
    ),
  );
  const caseIds = new Set(
    manifest.requirements.flatMap((node) =>
      node.scenarios.flatMap((child) =>
        child.cases.map((leaf) => leaf.localId),
      ),
    ),
  );
  const result: { id: string; scenarios: { id: string; cases: string[] }[] }[] =
    [];
  let currentRequirement: (typeof result)[number] | undefined;
  let requirementDepth = 0;
  let currentScenario: (typeof result)[number]["scenarios"][number] | undefined;
  let scenarioDepth = 0;

  for (const heading of headings(text)) {
    const kind = classify(heading.token, reqIds, scnIds, caseIds);
    if (!kind) {
      if (currentScenario && heading.depth <= scenarioDepth)
        currentScenario = undefined;
      if (currentRequirement && heading.depth <= requirementDepth)
        currentRequirement = undefined;
      continue;
    }
    if (kind === "requirement") {
      currentRequirement = { id: heading.token, scenarios: [] };
      result.push(currentRequirement);
      requirementDepth = heading.depth;
      currentScenario = undefined;
    } else if (kind === "scenario") {
      if (!currentRequirement || heading.depth <= requirementDepth) {
        errors.push(
          error(
            "invalid-markdown-hierarchy",
            `${heading.token} is not beneath a Requirement heading in ${source}`,
            { source },
          ),
        );
        currentScenario = undefined;
      } else {
        currentScenario = { id: heading.token, cases: [] };
        currentRequirement.scenarios.push(currentScenario);
        scenarioDepth = heading.depth;
      }
    } else if (
      !currentRequirement ||
      !currentScenario ||
      heading.depth <= scenarioDepth
    ) {
      errors.push(
        error(
          "invalid-markdown-hierarchy",
          `${heading.token} is not beneath a Scenario heading in ${source}`,
          { source },
        ),
      );
    } else {
      currentScenario.cases.push(heading.token);
    }
  }
  return { value: { requirements: result }, errors };
}

function headings(text: string): Heading[] {
  const result: Heading[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const match = /^(#{1,6})[\t ]+([^\p{White_Space}#]+)/u.exec(line);
    if (match?.[1] && match[2])
      result.push({ depth: match[1].length, token: match[2] });
  }
  return result;
}

function classify(
  token: string,
  requirements: Set<string>,
  scenarios: Set<string>,
  cases: Set<string>,
): "requirement" | "scenario" | "case" | undefined {
  if (requirements.has(token) || token.startsWith("REQ-")) return "requirement";
  if (scenarios.has(token) || token.startsWith("SCN-")) return "scenario";
  if (cases.has(token) || token.startsWith("CASE-")) return "case";
  return undefined;
}
