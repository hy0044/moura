import { readFileSync } from "node:fs";

interface AllureTreeNode {
  readonly name?: unknown;
  readonly groups?: unknown;
  readonly leaves?: unknown;
}

export function verifyBehaviorTree(
  value: unknown,
  hierarchy: readonly [string, string, string],
  testName: string,
): void {
  if (!isRecord(value)) throw new Error("Allure tree must be an object");
  const root = value.root;
  const groups = value.groupsById;
  const leaves = value.leavesById;
  if (!isTreeNode(root) || !isRecord(groups) || !isRecord(leaves))
    throw new Error("Allure tree has an invalid structure");

  let node = root;
  for (const expectedName of hierarchy) {
    const child = nodeIds(node.groups)
      .map((id) => groups[id])
      .find(
        (candidate): candidate is AllureTreeNode =>
          isTreeNode(candidate) && candidate.name === expectedName,
      );
    if (!child)
      throw new Error(
        `Allure Behavior tree is missing hierarchy node ${expectedName}`,
      );
    node = child;
  }

  const hasTest = nodeIds(node.leaves).some(
    (id) => isTreeNode(leaves[id]) && leaves[id].name === testName,
  );
  if (!hasTest)
    throw new Error(
      `Allure Behavior tree is missing test ${JSON.stringify(testName)}`,
    );
}

function nodeIds(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTreeNode(value: unknown): value is AllureTreeNode {
  return isRecord(value);
}

if (process.argv[1]?.endsWith("verify-allure-report.ts")) {
  const tree: unknown = JSON.parse(
    readFileSync("allure-report/widgets/tree.json", "utf8"),
  );
  verifyBehaviorTree(
    tree,
    ["REQ-002", "SCN-001", "CASE-002"],
    "aggregates an empty set of evidence as MISSING",
  );
  console.log("Verified Requirement → Scenario → Case Allure report tree.");
}
