export interface AllureLabel {
  readonly name: string;
  readonly value: string;
}

export interface AllureResult {
  readonly name?: string;
  readonly status?: string;
  readonly labels?: readonly AllureLabel[];
}

export type VerificationLayersByCase = ReadonlyMap<string, ReadonlySet<string>>;

export function parseAllureResult(
  value: unknown,
  source: string,
): AllureResult {
  if (typeof value !== "object" || value === null)
    throw new Error(`${source} must contain an Allure result object`);
  const name = "name" in value ? value.name : undefined;
  const status = "status" in value ? value.status : undefined;
  const labels = "labels" in value ? value.labels : undefined;
  if (name !== undefined && typeof name !== "string")
    throw new Error(`${source} has a non-string name`);
  if (status !== undefined && typeof status !== "string")
    throw new Error(`${source} has a non-string status`);
  if (
    labels !== undefined &&
    (!Array.isArray(labels) ||
      !labels.every(
        (label): label is AllureLabel =>
          typeof label === "object" &&
          label !== null &&
          "name" in label &&
          typeof label.name === "string" &&
          "value" in label &&
          typeof label.value === "string",
      ))
  )
    throw new Error(`${source} has invalid labels`);
  return {
    ...(name === undefined ? {} : { name }),
    ...(status === undefined ? {} : { status }),
    ...(labels === undefined ? {} : { labels }),
  };
}

function labelValues(result: AllureResult, name: string): string[] {
  return (result.labels ?? [])
    .filter((label) => label.name === name)
    .map((label) => label.value);
}

export function validateMouraEvidenceResults(
  results: readonly AllureResult[],
  verificationLayersByCase: VerificationLayersByCase,
  verificationLayers: ReadonlySet<string>,
): void {
  for (const result of results) {
    const resultName = JSON.stringify(result.name ?? "unnamed result");
    const converted = convertAllureResult(result, resultName);
    if (converted.issues.length > 0)
      throw new Error(converted.issues[0]!.message);
    if (converted.evidence.length === 0) continue;
    const { covers: cases, layer } = converted.evidence[0]!;
    for (const caseId of cases) {
      const requiredLayers = verificationLayersByCase.get(caseId);
      if (!requiredLayers)
        throw new Error(
          `${resultName} references unknown Moura Case ${caseId}`,
        );
    }
    if (!verificationLayers.has(layer))
      throw new Error(
        `${resultName} references unknown Moura verification layer ${layer}`,
      );

    for (const caseId of cases) {
      if (!verificationLayersByCase.get(caseId)?.has(layer))
        throw new Error(
          `${resultName} references non-required Moura verification pair ${caseId} × ${layer}`,
        );
    }
  }
}

export function verifyRequiredMouraEvidence(
  results: readonly AllureResult[],
  verificationLayersByCase: VerificationLayersByCase,
): void {
  const passedPairs = new Set<string>();
  for (const result of results) {
    if (result.status !== "passed") continue;
    const converted = convertAllureResult(
      result,
      JSON.stringify(result.name ?? "unnamed result"),
    );
    for (const item of converted.evidence) {
      for (const caseId of item.covers)
        passedPairs.add(JSON.stringify([caseId, item.layer]));
    }
  }

  const missing: string[] = [];
  for (const [caseId, layers] of verificationLayersByCase) {
    for (const layer of layers) {
      if (!passedPairs.has(JSON.stringify([caseId, layer])))
        missing.push(`${caseId} × ${layer}`);
    }
  }
  if (missing.length > 0)
    throw new Error(`Missing passing Moura evidence: ${missing.join(", ")}`);
}

export function verifyRepresentativeResult(
  results: readonly AllureResult[],
  name: string,
  expectedCases: readonly string[],
  expectedLayer: string,
): void {
  const matches = results.filter((result) => result.name === name);
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one Allure result named ${JSON.stringify(name)}`,
    );

  const match = matches[0];
  if (!match)
    throw new Error(`Allure result ${JSON.stringify(name)} is missing`);
  const converted = convertAllureResult(match, name);
  if (converted.issues.length > 0 || converted.evidence.length !== 1)
    throw new Error(`${name} has invalid Moura hierarchy labels`);
  const actualCases = [...converted.evidence[0]!.covers].sort();
  const actualLayers = labelValues(match, "moura_layer");
  if (
    actualCases.length !== expectedCases.length ||
    ![...expectedCases]
      .sort()
      .every((caseId, index) => caseId === actualCases[index])
  )
    throw new Error(`${name} has unexpected moura_case labels`);
  if (actualLayers.length !== 1 || actualLayers[0] !== expectedLayer)
    throw new Error(`${name} has an unexpected moura_layer label`);
}
import { convertAllureResult } from "../src/adapters/allure.js";
