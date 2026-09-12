/**
 * Adds Allure Metadata API labels only for the dedicated Allure run. The Allure
 * reporter removes these suffixes from its result title, while normal Vitest
 * output retains the readable name alone.
 */
export function mouraEvidenceName(
  name: string,
  cases: readonly string[],
  layer: string,
): string {
  if (process.env.MOURA_ALLURE_METADATA !== "true" || cases.length === 0)
    return name;

  const caseLabels = cases.map(
    (caseId) => `@allure.label.moura_case:${caseId}`,
  );
  return [name, ...caseLabels, `@allure.label.moura_layer:${layer}`].join(" ");
}
