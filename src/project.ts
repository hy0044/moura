import { readFile, realpath } from "node:fs/promises";
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
  for (const source of parsed.value.sources.requirements) {
    if (!isValidProjectRelativeSourcePath(source)) {
      errors.push(invalidSourcePath(source, "requirement"));
      continue;
    }
    const text = input.requirementSources.get(source);
    if (text === undefined) {
      errors.push(missingSource(source, "requirement"));
      continue;
    }
    const result = parseRequirementMarkdown(text, source, parsed.value);
    errors.push(...result.errors);
    if (result.value) requirements.set(source, result.value);
  }
  for (const source of parsed.value.sources.specifications) {
    if (!isValidProjectRelativeSourcePath(source)) {
      errors.push(invalidSourcePath(source, "specification"));
      continue;
    }
    const text = input.specificationSources.get(source);
    if (text === undefined) {
      errors.push(missingSource(source, "specification"));
      continue;
    }
    const result = parseSpecificationMarkdown(text, source, parsed.value);
    errors.push(...result.errors);
    if (result.value) specifications.set(source, result.value);
  }
  errors.push(
    ...validateStructure(parsed.value, { requirements, specifications }),
  );
  return { errors };
}

function missingSource(path: string, kind: string): ValidationError {
  return error(
    "missing-source",
    `Configured ${kind} source ${path} was not provided`,
    { source: path },
  );
}

function invalidSourcePath(path: string, kind: string): ValidationError {
  return error(
    "invalid-source-path",
    `Configured ${kind} source ${path} must be project-relative`,
    { source: path },
  );
}

function isValidProjectRelativeSourcePath(path: string): boolean {
  if (isAbsolute(path) || win32.isAbsolute(path) || /^[a-z]:/iu.test(path))
    return false;

  let depth = 0;
  for (const segment of path.split(/[\\/]+/u)) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (depth === 0) return false;
      depth -= 1;
    } else {
      depth += 1;
    }
  }
  return true;
}

/** Filesystem adapter used by the CLI; integrations can use validateProject directly. */
export async function validateProjectDirectory(
  directory: string,
): Promise<ValidationResult> {
  const manifestPath = resolve(directory, "moura.yaml");
  let manifest: string;
  try {
    const projectRoot = await realpath(resolve(directory));
    const realManifestPath = await realpath(manifestPath);
    if (!isWithin(projectRoot, realManifestPath)) {
      return {
        errors: [
          error(
            "invalid-source-path",
            "Configured manifest source moura.yaml must remain within the project directory",
            { source: "moura.yaml" },
          ),
        ],
      };
    }
    manifest = await readFile(realManifestPath, "utf8");
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
  const projectRoot = await realpath(resolve(directory));
  for (const path of paths) {
    // Core validation owns the manifest diagnostic. The adapter only skips the
    // unsafe read here so validateProject reports that contract error once.
    if (!isValidProjectRelativeSourcePath(path)) continue;

    const targetPath = resolve(projectRoot, path);
    if (!isWithin(projectRoot, targetPath)) {
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
      const realTargetPath = await realpath(targetPath);
      if (!isWithin(projectRoot, realTargetPath)) {
        errors.push(
          error(
            "invalid-source-path",
            `Configured ${kind} source ${path} must remain within the project directory`,
            { source: path },
          ),
        );
        continue;
      }
      target.set(path, await readFile(realTargetPath, "utf8"));
    } catch (cause) {
      errors.push(readError(path, cause, kind));
    }
  }
}

function isWithin(projectRoot: string, targetPath: string): boolean {
  const relativePath = relative(projectRoot, targetPath);
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
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
