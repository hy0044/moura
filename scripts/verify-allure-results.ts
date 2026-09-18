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
    const cases = labelValues(result, "moura_case");
    const layers = labelValues(result, "moura_layer");
    if (cases.length === 0 && layers.length === 0) continue;

    const resultName = JSON.stringify(result.name ?? "unnamed result");
    if (cases.length === 0)
      throw new Error(`${resultName} has moura_layer but no moura_case label`);
    if (layers.length === 0)
      throw new Error(`${resultName} has moura_case but no moura_layer label`);
    if (layers.length !== 1)
      throw new Error(`${resultName} must have exactly one moura_layer label`);

    const layer = layers[0];
    if (layer === undefined)
      throw new Error(`${resultName} has no Moura verification layer`);
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
  const actualCases = labelValues(match, "moura_case").sort();
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
