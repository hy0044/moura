import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";

import { parseManifest } from "./manifest.js";
import {
  parseRequirementMarkdown,
  parseSpecificationMarkdown,
} from "./markdown.js";
import {
  error,
  type ValidationError,
  type ValidationResult,
} from "./validation.js";
import { validateStructure } from "./validator.js";

export interface ProjectInput {
  readonly manifest: string;
  readonly requirementSources: ReadonlyMap<string, string>;
  readonly specificationSources: ReadonlyMap<string, string>;
}

/** Reusable, deterministic validation entry point for in-memory project files. */
export function validateProject(input: ProjectInput): ValidationResult {
  const parsed = parseManifest(input.manifest);
  const errors: ValidationError[] = [...parsed.errors];
  if (!parsed.value) return { errors };
  const requirements = new Map<string, readonly string[]>();
  const specifications = new Map();
  for (const [source, text] of input.requirementSources) {
    const result = parseRequirementMarkdown(text, source, parsed.value);
    errors.push(...result.errors);
    if (result.value) requirements.set(source, result.value);
  }
  for (const [source, text] of input.specificationSources) {
    const result = parseSpecificationMarkdown(text, source, parsed.value);
    errors.push(...result.errors);
    if (result.value) specifications.set(source, result.value);
  }
  errors.push(
    ...validateStructure(parsed.value, { requirements, specifications }),
  );
  return { errors };
}

/** Filesystem adapter used by the CLI; integrations can use validateProject directly. */
export async function validateProjectDirectory(
  directory: string,
): Promise<ValidationResult> {
  const manifestPath = resolve(directory, "moura.yaml");
  let manifest: string;
  try {
    manifest = await readFile(manifestPath, "utf8");
  } catch (cause) {
    return { errors: [readError("moura.yaml", cause)] };
  }
  const parsed = parseManifest(manifest);
  if (!parsed.value) return { errors: parsed.errors };
  const requirementSources = new Map<string, string>();
  const specificationSources = new Map<string, string>();
  const errors: ValidationError[] = [];
  await load(
    parsed.value.sources.requirements,
    requirementSources,
    directory,
    errors,
    "requirement",
  );
  await load(
    parsed.value.sources.specifications,
    specificationSources,
    directory,
    errors,
    "specification",
  );
  const result = validateProject({
    manifest,
    requirementSources,
    specificationSources,
  });
  return { errors: [...errors, ...result.errors] };
}

async function load(
  paths: readonly string[],
  target: Map<string, string>,
  directory: string,
  errors: ValidationError[],
  kind: string,
): Promise<void> {
  const projectRoot = resolve(directory);
  for (const path of paths) {
    const targetPath = resolve(projectRoot, path);
    const relativePath = relative(projectRoot, targetPath);
    if (
      isAbsolute(path) ||
      win32.isAbsolute(path) ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      errors.push(
        error(
          "invalid-source-path",
          `Configured ${kind} source ${path} must remain within the project directory`,
          { source: path },
        ),
      );
      continue;
    }
    try {
      target.set(path, await readFile(targetPath, "utf8"));
    } catch (cause) {
      errors.push(readError(path, cause, kind));
    }
  }
}
function readError(
  path: string,
  cause: unknown,
  kind = "manifest",
): ValidationError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return error(
    "unreadable-source",
    `Cannot read configured ${kind} source ${path}: ${detail}`,
    { source: path },
  );
}
