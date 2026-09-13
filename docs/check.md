# Initial evidence-checking contract

This document defines the initial, framework-independent contract for `moura check`. It is separate from [v0.1 structural validation](config.md): `moura validate` establishes that the traceability definition is valid, while checking determines whether every required Case × verification-layer pair has acceptable evidence.

## Boundary and data model

The pure check core receives an already structurally valid `MouraManifest` and normalized `Evidence[]`. Structural errors must be reported before the core is called; evidence checking neither repairs nor replaces validation.

Each evidence record:

- covers one or more canonical Case IDs derived from the existing Requirement → Scenario → Case tree;
- belongs to exactly one project-declared verification layer;
- has the explicit status `passed`, `failed`, `broken`, or `skipped`; and
- may retain optional, adapter-neutral source metadata, which does not affect aggregation.

Initial evidence is Case-only. Requirement and Scenario IDs are not accepted as coverage targets, and Moura does not infer node kinds from ID prefixes. Evidence with no targets, an unknown canonical ID, a Requirement or Scenario ID, an undeclared layer, or a Case/layer pair not required by that Case is reported as invalid and makes the project check fail. It is never silently ignored. Duplicate valid evidence records receive no special treatment; they participate in normal aggregation.

The normalized model and aggregation have no Allure, JUnit XML, test-runner, or CI-provider semantics. Adapters translate their native formats into this framework-independent model before invoking the check core.

## Pair aggregation

Evidence matches a required pair only when `covers` contains that pair's canonical Case ID and `layer` equals its verification layer. Every layer in a Case's `verify` list creates an independent pair.

For all matching evidence, apply this precedence:

1. no records → `MISSING`;
2. any `failed` record → `FAIL`;
3. otherwise, any `broken` record → `BROKEN`;
4. otherwise, any `passed` record → `PASS`;
5. otherwise → `SKIPPED`.

Consequently, precedence is `FAILED > BROKEN > PASSED > SKIPPED`: passed plus skipped is `PASS`, broken plus passed or skipped is `BROKEN`, and any combination containing failed is `FAIL`. This rule is independent of evidence order.

## Structured result and ordering

The check result contains one structured entry per required pair with its canonical Case ID, layer, and `PASS`, `FAIL`, `BROKEN`, `MISSING`, or `SKIPPED` status. It also contains deterministic evidence issues and a project-level `passed` value. Entries retain manifest order: Requirement, then Scenario, then Case, then the Case's `verify` layer order. Adapter or evidence ordering never changes entry order or aggregation.

The project passes only when every required pair is `PASS` and there are no evidence issues.

## Eventual CLI flow

The eventual `moura check` command will:

1. structurally validate the project;
2. load normalized evidence through a narrow adapter boundary;
3. invoke the pure check core;
4. render deterministic results; and
5. exit `0` only when the project check passes.

Any `FAIL`, `BROKEN`, `MISSING`, `SKIPPED`, invalid evidence, or structural validation error results in exit `1`. This phase does not wire evidence ingestion into the CLI.

## Allure evidence adapter

The public Allure adapter reads the small structural subset of Allure result JSON that Moura needs; parsing does not require Allure runtime libraries. Only `*-result.json` files are discovered by the directory loader, in deterministic filename order. Results without Moura labels are unrelated and ignored. Partially or incorrectly labelled results produce structured adapter issues that remain distinct from semantic `EvidenceIssue`s.

Custom labels and statuses map as follows:

| Allure input                    | Normalized Moura field |
| ------------------------------- | ---------------------- |
| every `moura_case` label        | `Evidence.covers[]`    |
| exactly one `moura_layer` label | `Evidence.layer`       |
| `passed`                        | `passed`               |
| `failed`                        | `failed`               |
| `broken`                        | `broken`               |
| `skipped`                       | `skipped`              |
| `unknown`                       | invalid adapter input  |

Repeated identical `moura_case` values are de-duplicated while preserving their first-seen order. The caller-supplied source, or the result filename when loading a directory, is retained as adapter-neutral `Evidence.source` and does not affect aggregation. Canonical-ID and project-layer validity remain the responsibility of `checkVerification()` rather than the Allure-format adapter.
