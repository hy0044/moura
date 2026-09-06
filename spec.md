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

Validation fails when a local ID is empty or contains `/`.

#### CASE-009 Reject an incomplete hierarchy

Validation fails when a Requirement has no Scenario or a Scenario has no Case.

#### CASE-010 Reject a Case without a verification layer

Validation fails when a Case has no `verify` entry or its `verify` list is empty.

#### CASE-011 Reject an unknown or duplicate verification layer

Validation fails when a Case references a layer absent from `verification.layers`, or repeats a layer in its `verify` list.

#### CASE-012 Reject a duplicate canonical ID

Validation fails when derived canonical IDs are not unique.

#### CASE-013 Reject an unmanaged Markdown ID

Validation fails when a Moura-managed Requirement, Scenario, or Case ID is present in a configured Markdown source but absent from the manifest.
