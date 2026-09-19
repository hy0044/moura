import { canonicalCaseIdError } from "../id.js";

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

  const hierarchyLabels = cases.flatMap((caseId) => {
    if (canonicalCaseIdError(caseId))
      throw new Error(`Invalid canonical Moura Case ID: ${caseId}`);
    const parts = caseId.split("/");
    const [requirement, scenario, testCase] = parts as [string, string, string];
    return [
      `@allure.label.moura_requirement:${requirement}`,
      `@allure.label.moura_scenario:${scenario}`,
      `@allure.label.moura_case:${testCase}`,
    ];
  });
  return [name, ...hierarchyLabels, `@allure.label.moura_layer:${layer}`].join(
    " ",
  );
}
