# Specification

## REQ-001

### SCN-001 Validate a traceability definition

#### CASE-001 Accept a structurally valid definition

A definition that satisfies the v0.1 manifest, source, hierarchy, identity, and verification-layer rules is valid.

#### CASE-002 Reject an unsupported or missing manifest version

Validation fails when `version` is absent or is not a supported version.

#### CASE-003 Reject an unavailable source file

Validation fails when a configured requirement or specification source does not exist or cannot be read.

#### CASE-004 Reject a missing source node or invalid hierarchy

Validation fails when a manifest Requirement is absent from requirement sources, or a manifest Scenario or Case is absent beneath its expected ancestors in specification sources.

#### CASE-005 Reject a duplicate Requirement ID

Validation fails when a Requirement local ID occurs more than once in the project.

#### CASE-006 Reject a duplicate Scenario ID within a Requirement

Validation fails when a Scenario local ID occurs more than once under the same Requirement.

#### CASE-007 Reject a duplicate Case ID within a Scenario

Validation fails when a Case local ID occurs more than once under the same Scenario.

#### CASE-008 Reject an invalid local ID

Validation fails when a local ID is empty; contains `/` or a Unicode
`White_Space` character; contains a Unicode control code point whose
`General_Category` is `Cc`; or contains an unpaired UTF-16 surrogate code unit.
Ordinary printable and supplementary Unicode code points remain valid and are
not normalized.

#### CASE-009 Reject an incomplete hierarchy

Validation fails when a Requirement has no Scenario or a Scenario has no Case.

#### CASE-010 Reject a Case without a verification layer

Validation fails when a Case declares no verification layer: both `verify` and
`unimplemented` are absent or empty. A Case is valid when at least one of the
two lists contains a layer, including when `unimplemented` is the only
non-empty list.

#### CASE-011 Reject an unknown or duplicate verification layer

Validation fails when a Case references a layer absent from
`verification.layers`; repeats a layer within either its `verify` or
`unimplemented` list; or declares the same layer in both lists.
Layer names are also invalid when they contain a Unicode `Cc` control code point
or an unpaired UTF-16 surrogate; valid surrogate pairs remain supported.

#### CASE-012 Reject a duplicate canonical ID

Validation fails when derived canonical IDs are not unique.

#### CASE-013 Reject an unmanaged Markdown ID

Validation fails when a Moura-managed Requirement, Scenario, or Case ID is present in a configured Markdown source but absent from the manifest.

## REQ-002

### SCN-001 Evaluate required Case × verification-layer evidence

#### CASE-001 Pass when required evidence passes

A required Case × layer pair is `PASS` when at least one matching record is passed and no matching record is failed or broken.

#### CASE-002 Report missing evidence

A required Case × layer pair is `MISSING` when no evidence matches its canonical Case ID and layer.

#### CASE-003 Fail when matching evidence fails

A required Case × layer pair is `FAIL` when any matching record is failed. Failure dominates broken, passed, and skipped records.

#### CASE-004 Treat skipped-only evidence as skipped

A required Case × layer pair is `SKIPPED` when matching evidence exists but every matching record is skipped.

#### CASE-005 Aggregate multiple records and layers deterministically

Multiple records are aggregated independently of input order using the precedence `FAILED > BROKEN > PASSED > SKIPPED`. Passed plus skipped is `PASS`; broken plus passed or skipped is `BROKEN`; any set containing failed, including failed plus broken, is `FAIL`; and multiple passed records are `PASS`. Each required layer is evaluated independently, and results retain Requirement → Scenario → Case → verify-layer manifest order.

#### CASE-006 Reject invalid canonical evidence targets

Evidence checking fails and reports evidence that has no target, refers to an unknown canonical ID, or targets a Requirement or Scenario. Initial evidence coverage targets Cases only and uses Moura's derived canonical IDs without interpreting ID prefixes.

#### CASE-007 Reject invalid verification layers

Evidence checking fails and reports evidence using a layer not declared by the project or not required by its covered Case.

#### CASE-008 Treat broken evidence as broken

A required Case × layer pair is `BROKEN` when at least one matching record is broken and no matching record is failed. Broken dominates passed and skipped records: broken alone, broken plus passed, and broken plus skipped are `BROKEN`, while failed plus broken is `FAIL`.

#### CASE-009 Separate verification status from project severity

`PASS` has success severity; `SKIPPED` and explicitly declared `UNIMPLEMENTED`
have warning severity; and `FAIL`, `BROKEN`, and `MISSING` have error severity.
A project passes with success and warning entries only, but fails when any error
or evidence-validation issue exists.

#### CASE-010 Represent unimplemented verification explicitly

A Case may declare a layer in `unimplemented` instead of `verify`. This
Git-reviewed Case × layer declaration produces `UNIMPLEMENTED` without
Evidence. Omitting both a declaration and required Evidence never implies
`UNIMPLEMENTED`; a `verify` pair without Evidence remains `MISSING`. A layer
cannot appear in both lists, and Evidence for an unimplemented pair is a
contradiction that fails checking.

#### CASE-011 Surface status and severity through the CLI and report

The check CLI and Requirement Coverage report preserve every verification
status and identify its success, warning, or error severity. Warning-only
checks exit successfully; errors and evidence-validation issues do not.
