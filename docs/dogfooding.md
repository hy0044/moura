# Moura dogfooding evidence

Moura's own test suite uses the same Case × verification-layer model that it
offers to projects. The mapping is intentionally narrower than the test suite:
an ordinary implementation test remains unlabelled unless its assertions
actually verify a declared Case.

## Mapping rules

- Pass canonical Case IDs such as `REQ-002/SCN-001/CASE-002` to
  `mouraEvidenceName()`; do not pass separate or abbreviated IDs.
- Use the layer where the assertion runs. Tests of a pure function or in-memory
  project model are `unit`; tests that cross the filesystem command/project
  boundary are `integration`.
- Multiple Cases may share one result only when every mapped Case is genuinely
  asserted by that test. For example, one aggregation example can demonstrate
  both a status rule and the general multi-record precedence rule.
- Do not add a nearby Case merely to make coverage pass. If no suitable test
  exists, leave the required pair `MISSING` until a test can be justified from
  the specification.
- Keep unrelated regression, parser-detail, CLI-presentation, and hardening
  tests unlabelled. They still run and appear in Allure, but are not claimed as
  specification evidence.

`pnpm test:allure` checks the generated result JSON, not just the test source.
It rejects malformed or undeclared mappings, but does not implement project
coverage policy. After it runs, `node dist/cli.js check .` consumes those same
files through Moura's production Allure adapter and core verification path. The
self-check is responsible for reporting absent required pairs as `MISSING` and
returning a non-zero exit code. `pnpm report:moura` uses that same path to render
coverage.

## Current mapping

The following is the reviewed mapping for the current specification. Test names
are stable human-readable names; parameterized aggregation rows are described
as a group.

| Case                                                          | Layer       | Test evidence                                                                                                               |
| ------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `REQ-001/SCN-001/CASE-001`                                    | unit        | `accepts a valid manifest`                                                                                                  |
| `REQ-001/SCN-001/CASE-001`                                    | integration | `returns the validated manifest from the canonical filesystem boundary`                                                     |
| `REQ-001/SCN-001/CASE-002`                                    | unit        | `rejects a missing or unsupported version`                                                                                  |
| `REQ-001/SCN-001/CASE-003`                                    | integration | `reports configured source files that cannot be read`                                                                       |
| `REQ-001/SCN-001/CASE-004`                                    | integration | `rejects invalid hierarchy and unmanaged IDs through the filesystem boundary`                                               |
| `REQ-001/SCN-001/CASE-005` through `CASE-007`, and `CASE-012` | unit        | `reports duplicate Requirements, Scenarios, and Cases`                                                                      |
| `REQ-001/SCN-001/CASE-008`                                    | unit        | local-ID rejection and printable/supplementary Unicode acceptance tests                                                     |
| `REQ-001/SCN-001/CASE-009` and `CASE-010`                     | unit        | `reports missing Scenario, Case, and verify lists`                                                                          |
| `REQ-001/SCN-001/CASE-011`                                    | unit        | unknown/duplicate layer, unsafe layer, and Unicode acceptance tests                                                         |
| `REQ-001/SCN-001/CASE-013`                                    | integration | `rejects invalid hierarchy and unmanaged IDs through the filesystem boundary`                                               |
| `REQ-002/SCN-001/CASE-001` through `CASE-005`, and `CASE-008` | unit        | the applicable `aggregates ... evidence as ...` rows; Case 5 also maps ordering, independent-pair, and manifest-order tests |
| `REQ-002/SCN-001/CASE-005`                                    | integration | `aggregates multiple records and layers through the filesystem command`                                                     |
| `REQ-002/SCN-001/CASE-006`                                    | unit        | unknown ID, non-Case target, and empty-target tests                                                                         |
| `REQ-002/SCN-001/CASE-007`                                    | unit        | undeclared-layer and non-required-pair tests                                                                                |
| `REQ-002/SCN-001/CASE-009` and `CASE-010`                     | unit        | warning-severity, explicit-unimplemented, and contradiction tests                                                           |
| `REQ-002/SCN-001/CASE-011`                                    | integration | CLI explicit-UNIMPLEMENTED warning and exit-code test                                                                       |

There are currently no declared Case × layer pairs intentionally left without
evidence. This statement is enforced by running `node dist/cli.js check .`
against generated Allure results; it must not be preserved by weakening a
mapping when the specification or tests change. Moura deliberately has no
dogfooding-only completeness checker parallel to its core verification
semantics.

Moura's `moura_*` labels remain the machine-readable evidence contract. Mapping
Requirement, Scenario, and Case IDs to Allure's behavior hierarchy is a separate
presentation concern and is not part of this dogfooding policy.
