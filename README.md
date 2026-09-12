# Moura

Moura is an open-source, Git-native CLI for checking traceability between requirements, specifications, and test evidence, and for reporting verification coverage. It does not own the requirements or specifications: it connects the documents already reviewed in Git with evidence produced by test tools.

> **Status:** Moura is in early development. Static project validation and the pure evidence-checking core are available; evidence adapters, the `check` CLI command, and reporting are not implemented yet.

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

A **local ID** identifies a node among its siblings. The v0.1 convention is `REQ-001`, `SCN-001`, and `CASE-001`, but the model does not embed those prefixes or a three-digit rule. Local IDs must be non-empty and cannot contain `/` or whitespace.

Moura derives a logical **canonical ID** from the hierarchy:

```text
REQ-001
REQ-001/SCN-001
REQ-001/SCN-001/CASE-001
```

Canonical IDs are identities, not paths or prescribed filenames. Reparenting a node changes its canonical ID and therefore creates a different logical node.

The smallest coverage point is a canonical Case ID plus an open-ended verification-layer string, such as `REQ-001/SCN-001/CASE-001 + integration`. Tests and Cases have a many-to-many relationship; Moura does not require a proprietary test ID.

See [Concepts](docs/concepts.md), the [v0.1 traceability specification](docs/config.md), the [initial evidence-checking contract](docs/check.md), and the [ID model](docs/id-model.md) for the authoritative details.

## Traceability manifest

`moura.yaml` records relationships and required verification layers. Descriptions, boundary values, and expected behavior remain in requirement and specification documents rather than being duplicated into YAML.

```yaml
version: 1

sources:
  requirements:
    - req.md
  specifications:
    - spec.md

verification:
  layers:
    - unit
    - integration

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

Canonical IDs are intentionally omitted and derived from the nesting. Layer names are strings rather than a closed enum, allowing domains to use values such as `contract`, `security`, `manual`, `sil`, or `vehicle`. The repository's own [`moura.yaml`](moura.yaml), [`req.md`](req.md), and [`spec.md`](spec.md) are the primary real-world example; see the [v0.1 contract](docs/config.md).

## CLI

```sh
moura validate [directory] # validate moura.yaml and its configured Markdown sources
```

Run `moura validate` to validate the current working directory, or pass a relative or absolute project directory explicitly. Relative paths are resolved from the current working directory. The pure evidence check is exported for integrations, while evidence ingestion, the `check` CLI command, `report`, and adapters remain future work.

## Development

Moura starts as a small Node.js 24+ and TypeScript project.

```sh
pnpm install
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
```

The executable exposes `validate`, version, and help commands. Domain types and canonical-ID construction are also exported for integrations.

## License

Licensed under the existing [Apache License 2.0](LICENSE).
