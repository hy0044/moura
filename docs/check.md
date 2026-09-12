# Initial evidence-checking contract

This document defines the initial, framework-independent contract for `moura check`. It is separate from [v0.1 structural validation](config.md): `moura validate` establishes that the traceability definition is valid, while checking determines whether every required Case × verification-layer pair has acceptable evidence.

## Boundary and data model

The pure check core receives an already structurally valid `MouraManifest` and normalized `Evidence[]`. Structural errors must be reported before the core is called; evidence checking neither repairs nor replaces validation.

Each evidence record:

- covers one or more canonical Case IDs derived from the existing Requirement → Scenario → Case tree;
- belongs to exactly one project-declared verification layer;
- has the explicit status `passed`, `failed`, or `skipped`; and
- may retain optional, adapter-neutral source metadata, which does not affect aggregation.

Initial evidence is Case-only. Requirement and Scenario IDs are not accepted as coverage targets, and Moura does not infer node kinds from ID prefixes. Evidence with no targets, an unknown canonical ID, a Requirement or Scenario ID, an undeclared layer, or a Case/layer pair not required by that Case is reported as invalid and makes the project check fail. It is never silently ignored. Duplicate valid evidence records receive no special treatment; they participate in normal aggregation.

The normalized model and aggregation have no Allure, JUnit XML, test-runner, or CI-provider semantics. Defining a persistent normalized-evidence input format and adapters is follow-up work.

## Pair aggregation

Evidence matches a required pair only when `covers` contains that pair's canonical Case ID and `layer` equals its verification layer. Every layer in a Case's `verify` list creates an independent pair.

For all matching evidence, apply this precedence:

1. no records → `MISSING`;
2. any `failed` record → `FAIL`;
3. otherwise, any `passed` record → `PASS`;
4. otherwise → `SKIPPED`.

Consequently, passed plus skipped is `PASS`; any combination containing failed is `FAIL`; and multiple passed records are `PASS`. This rule is independent of evidence order.

## Structured result and ordering

The check result contains one structured entry per required pair with its canonical Case ID, layer, and `PASS`, `FAIL`, `MISSING`, or `SKIPPED` status. It also contains deterministic evidence issues and a project-level `passed` value. Entries retain manifest order: Requirement, then Scenario, then Case, then the Case's `verify` layer order. Adapter or evidence ordering never changes entry order or aggregation.

The project passes only when every required pair is `PASS` and there are no evidence issues.

## Eventual CLI flow

The eventual `moura check` command will:

1. structurally validate the project;
2. load normalized evidence through a narrow adapter boundary;
3. invoke the pure check core;
4. render deterministic results; and
5. exit `0` only when the project check passes.

Any `FAIL`, `MISSING`, `SKIPPED`, invalid evidence, or structural validation error results in exit `1`. This phase does not define a permanent evidence file format or implement CLI/adapters.
