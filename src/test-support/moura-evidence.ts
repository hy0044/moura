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

  const hierarchies = cases.map((caseId) => {
    if (canonicalCaseIdError(caseId))
      throw new Error(`Invalid canonical Moura Case ID: ${caseId}`);
    const parts = caseId.split("/");
    const [requirement, scenario, testCase] = parts as [string, string, string];
    return { requirement, scenario, testCase };
  });
  const mouraLabels = hierarchies.flatMap(
    ({ requirement, scenario, testCase }) => [
      `@allure.label.moura_requirement:${requirement}`,
      `@allure.label.moura_scenario:${scenario}`,
      `@allure.label.moura_case:${testCase}`,
    ],
  );
  const representative = hierarchies[0]!;
  const behaviorLabels = [
    `@allure.label.epic:${representative.requirement}`,
    `@allure.label.feature:${representative.scenario}`,
    `@allure.label.story:${representative.testCase}`,
  ];
  return [
    name,
    ...mouraLabels,
    `@allure.label.moura_layer:${layer}`,
    ...behaviorLabels,
  ].join(" ");
}
