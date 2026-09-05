# Traceability manifest

`moura.yaml` is a relationship and verification manifest, not a second specification. Keep intent and requirement prose in requirement sources, and behavior, boundaries, expected values, and transitions in specification sources.

## Initial shape

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

`version` identifies the manifest schema. `sources` lists the Git-controlled documents that validation will inspect. Nested `requirements`, `scenarios`, and `cases` define parentage with local IDs. `verify` declares the verification layers required for each Case.

Do not add canonical IDs: Moura derives them. Verification layers are strings and are not restricted to a built-in enum.

## Planned validation

The future `moura validate` command is expected to check:

- manifest syntax and structure;
- referenced source existence;
- Requirement, Scenario, and Case presence in their declared sources;
- correct parent-child relationships;
- local-ID uniqueness within the applicable scope;
- global canonical-ID uniqueness; and
- the local-ID prohibition on `/`.

The precise document-matching syntax and configurable local-ID patterns are intentionally deferred until their contracts can be designed and versioned.
