function labelValues(result, name) {
  return (result.labels ?? [])
    .filter((label) => label.name === name)
    .map((label) => label.value);
}

export function validateMouraEvidenceResults(
  results,
  canonicalCases,
  verificationLayers,
) {
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

    for (const caseId of cases) {
      if (!canonicalCases.has(caseId))
        throw new Error(
          `${resultName} references unknown Moura Case ${caseId}`,
        );
    }
    if (!verificationLayers.has(layers[0]))
      throw new Error(
        `${resultName} references unknown Moura verification layer ${layers[0]}`,
      );
  }
}

export function verifyRepresentativeResult(
  results,
  name,
  expectedCases,
  expectedLayer,
) {
  const matches = results.filter((result) => result.name === name);
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one Allure result named ${JSON.stringify(name)}`,
    );

  const actualCases = labelValues(matches[0], "moura_case").toSorted();
  const actualLayers = labelValues(matches[0], "moura_layer");
  if (
    actualCases.length !== expectedCases.length ||
    !expectedCases
      .toSorted()
      .every((caseId, index) => caseId === actualCases[index])
  )
    throw new Error(`${name} has unexpected moura_case labels`);
  if (actualLayers.length !== 1 || actualLayers[0] !== expectedLayer)
    throw new Error(`${name} has an unexpected moura_layer label`);
}
