# v0.1 traceability specification

This document is the authoritative contract for the v0.1 source and manifest format. `moura.yaml` is the canonical relationship and verification manifest, not a second prose specification.

## Manifest

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
requirements:
  - id: REQ-001
    scenarios:
      - id: SCN-001
        cases:
          - id: CASE-001
            verify:
              - unit
```

`version` must be the number `1`. `sources` names readable, project-relative Markdown files. Requirement prose belongs in requirement sources; detailed normal, abnormal, boundary, state, concurrency, and external-dependency behavior belongs in specification Scenarios and Cases.

`verification.layers` declares the project's allowed layer strings. Moura has no built-in layer names. The nested manifest arrays establish the strict Requirement → Scenario → Case tree, and each Case's non-empty `verify` list declares its required layers. Long descriptions and derived canonical IDs do not belong in the manifest.

The schema is closed for v0.1: implementations must reject unknown fields in the objects shown above rather than silently assigning future meaning to them. Lists required by the model must be present and non-empty.

## Markdown source convention

Sources are natural Markdown documents using ATX headings (`#` through `######`). An ID-bearing heading starts, after the heading marker and whitespace, with its local ID as the first whitespace-delimited token; the rest is an optional title.

```markdown
# Requirements

## REQ-001 Validate traceability

# Specification

## REQ-001

### SCN-001 Valid definition

#### CASE-001 Accept it
```

Heading depth is not absolute. In requirement sources, an ID-bearing Requirement heading may occur at any depth. In specification sources, a Scenario heading must be deeper than its nearest preceding Requirement heading, and a Case heading must be deeper than its nearest preceding Scenario heading. A heading at the same or a shallower depth closes the applicable ancestor. Thus IDs and relative hierarchy, not a particular choice of heading levels, carry meaning.

The manifest tells the parser which local IDs to match. In addition, first heading tokens beginning `REQ-`, `SCN-`, or `CASE-` are reserved Moura-managed IDs under the default convention; finding one in the relevant configured source without a corresponding manifest node is an error. Other ordinary headings are prose and are ignored. A project using non-default ID names can match manifest-declared IDs, but v0.1 cannot infer that an undeclared arbitrary heading token was intended as an ID.

## Structural validation contract

The future `moura validate` command must return failure, without warnings, when it finds any of these conditions:

- missing or unsupported manifest version, malformed structure, an unknown field, or a required empty list;
- a configured source that does not exist or cannot be read;
- a manifest Requirement absent from requirement sources;
- a manifest Scenario or Case absent under its expected Markdown ancestors;
- a duplicate Requirement ID in the project, Scenario ID within its Requirement, or Case ID within its Scenario;
- an empty local ID or one containing `/`;
- a broken or missing Requirement → Scenario → Case relationship;
- a Requirement without a Scenario, a Scenario without a Case, or a Case without a non-empty `verify` list;
- an undeclared verification layer or a repeated layer within one Case;
- a duplicate derived canonical ID; or
- a reserved Moura-managed Markdown ID absent from the manifest.

All errors are collected and reported in deterministic source order where possible, then manifest order. Any error makes validation fail. v0.1 defines no warnings. Evidence availability, result ingestion, and coverage status are not structural concerns and must not affect `validate`; they belong to future `moura check` behavior.
