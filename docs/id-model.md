# ID model

## Local IDs

A local ID identifies a node in its immediate scope:

- Requirement IDs are unique at the manifest root.
- Scenario IDs are unique within their parent Requirement.
- Case IDs are unique within their parent Scenario.

The defaults are `REQ-001`, `SCN-001`, and `CASE-001`. They are conventions, not assumptions in the domain model. Future configuration may accept forms such as `R-001`, `LOGIN-04`, or `CASE-INVALID`.

A local ID must be non-empty and must not contain `/`. The slash is reserved as the canonical hierarchy separator.

Gaps in a numbering scheme are valid. Projects should never reuse a deleted ID;
Git history is the v0.1 record of retired identities, and Moura does not maintain
an ID registry.

## Canonical IDs

Moura constructs canonical IDs from validated local IDs and parent relationships:

```text
REQ-001
REQ-001/SCN-001
REQ-001/SCN-001/CASE-001
```

The canonical-ID function is the sole construction boundary in the codebase. Callers should not reproduce it with ad hoc string concatenation.

A canonical ID is a logical identifier, not a filesystem path. Implementations must not assume that it can safely or usefully become a filename.

Canonical IDs must be unique across the project.

## Identity and reparenting

Parentage contributes to identity. Moving `CASE-001` from `REQ-001/SCN-001` to `REQ-001/SCN-002` changes its canonical ID and represents a new Case. Moura analyzes the current Git state; it does not maintain a database to infer historical node movement. Historical identity migration is not part of v0.1.
