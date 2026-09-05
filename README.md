# Moura

Moura is an open-source, Git-native CLI for checking traceability between requirements, specifications, and test evidence, and for reporting verification coverage. It does not own the requirements or specifications: it connects the documents already reviewed in Git with evidence produced by test tools.

> **Status:** Moura is in early development. The data model and manifest described here establish the intended foundation; the full CLI workflow is not implemented yet.

## Why Moura?

Teams often keep requirements, detailed behavior, and test results in separate formats. It can then be difficult to answer whether every specified case has evidence at every required verification layer. Moura aims to answer that question deterministically without introducing another system of record or requiring AI.

Its operating principles are:

- **No server** — analysis runs locally or in CI.
- **No database** — no separate traceability store must be operated.
- **Git is the source of truth** — reviewed files define the current specification.
- **Tool-neutral core** — evidence adapters translate external results; the core does not depend on Allure or another report format.
- **Deterministic first** — v0.1 focuses on static validation and aggregation. Optional AI-assisted gap suggestions may be added later.

## Traceability model

Moura uses three domain roles:

```text
Requirement
  └ Scenario
      └ Case
```

A **local ID** identifies a node among its siblings. The v0.1 convention is `REQ-001`, `SCN-001`, and `CASE-001`, but the model does not embed those prefixes or a three-digit rule. `/` is reserved and is never valid inside a local ID.

Moura derives a logical **canonical ID** from the hierarchy:

```text
REQ-001
REQ-001/SCN-001
REQ-001/SCN-001/CASE-001
```

Canonical IDs are identities, not paths or prescribed filenames. Reparenting a node changes its canonical ID and therefore creates a different logical node.

The smallest coverage point is a canonical Case ID plus an open-ended verification-layer string, such as `REQ-001/SCN-001/CASE-001 + integration`. Tests and Cases have a many-to-many relationship; Moura does not require a proprietary test ID.

See [Concepts](docs/concepts.md) and [ID model](docs/id-model.md) for details.

## Traceability manifest

`moura.yaml` records relationships and required verification layers. Descriptions, boundary values, and expected behavior remain in requirement and specification documents rather than being duplicated into YAML.

```yaml
version: 1

sources:
  requirements:
    - req.md
  specifications:
    - spec.md

requirements:
  - id: REQ-001
    scenarios:
      - id: SCN-001
        cases:
          - id: CASE-001
            verify:
              - unit
              - integration
```

Canonical IDs are intentionally omitted and derived from the nesting. Layer names are strings rather than a closed enum, allowing domains to use values such as `contract`, `security`, `manual`, `sil`, or `vehicle`. See the complete [example](examples/moura.yaml) and [configuration notes](docs/config.md).

## Planned CLI

```sh
moura validate # validate documents, manifest structure, hierarchy, and IDs
moura check    # compare required coverage points with available evidence
moura report   # render coverage by Requirement, Scenario, Case, and layer
```

Allure Results (`allure-results/*.json`) is the first intended evidence adapter, but the adapter is not part of the core model. `validate`, `check`, `report`, and the Allure adapter remain future work.

## Development

Moura starts as a small Node.js 20+ and TypeScript project.

```sh
pnpm install
pnpm typecheck
pnpm test
```

The current executable only exposes a version and an early-development help message. Domain types and canonical-ID construction are exported for continued implementation.

## License

Licensed under the existing [Apache License 2.0](LICENSE).
