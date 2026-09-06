# Core concepts

## Purpose and boundaries

Moura verifies the current traceability graph and its verification coverage. Requirement and specification documents stay human-readable and Git-reviewed. Moura does not become an authoring system, history database, test runner, or report host.

## Requirement → Scenario → Case

- A **Requirement** states what must be achieved.
- A **Scenario** groups detailed behavior within one Requirement.
- A **Case** identifies a particular behavior, boundary, error path, or transition that can require verification.

Each node stores a semantic `kind` and a `localId` separately. Parent-child structure, rather than parsing an ID prefix, establishes context.

For v0.1 this is a strict tree. Every Requirement has at least one Scenario,
every Scenario has at least one Case, and every Case requires at least one
verification layer. A node has exactly one parent except for a Requirement,
which is a root. External many-to-many relationships, including issue-tracker
links, are outside v0.1.

## Coverage points

A coverage point is the pair:

```text
Canonical Case ID + Verification Layer
```

For example, a Case requiring unit and integration verification produces two independent coverage points. A verification layer is an arbitrary non-enumerated string so projects and domains can introduce suitable layers without changing Moura core.

## Evidence

Evidence is an adapter-neutral test result linked to one or more canonical Case IDs and one verification layer. This supports both directions of a many-to-many relationship: one result may cover multiple Cases, and multiple results may cover one Case.

Future checks will aggregate evidence into at least `PASS`, `FAIL`, `MISSING`, and `SKIPPED`. Evidence adapters map their native status and metadata into the core representation. Allure Results is the first planned adapter, but Moura neither requires an Allure Report server nor exposes Allure-specific fields in its core types.

Structural validation does not read test results or decide whether evidence is
available. That is the responsibility of the future `moura check` command.

## Deterministic core, optional extensions

Initial validation and coverage calculation should be reproducible static operations. AI is not required. Future features may propose missing scenarios, but suggestions must remain separable from deterministic validation.
