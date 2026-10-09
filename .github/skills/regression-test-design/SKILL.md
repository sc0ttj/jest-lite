# Regression Test Design

## Use when

Use after triage and root-cause analysis have produced a reproducible defect that needs durable coverage.

## Sources of truth

- `jest-lite.test.js`
- The failing reproduction
- `jest-lite.js`
- `AGENT.md` test patterns and invariants
- `package.json` test scripts

## Procedure

1. Choose the smallest existing `node:test` section matching the affected subsystem.
2. Reuse the repository's `runIsolated`, `nodeAssert`, DOM stubs, and fixture patterns where applicable.
3. Write a focused test that fails against the pre-fix behavior for the reported symptom.
4. Cover the relevant boundary or invariant, not unrelated implementation details.
5. Run the narrowest test selector that demonstrates the failure.
6. Keep the test deterministic: no network, wall-clock sleeps, random values, or order dependence.
7. Hand off the failing test and expected post-fix result to the bug-fix skill.

## Required output

Return the test location, behavior asserted, pre-fix failure evidence, determinism rationale, and any intentionally untested adjacent cases.

## Mutation policy and guardrails

This skill may add or minimally adjust regression tests only. Do not change production code, weaken existing assertions, update snapshots to hide a failure, or add dependencies.
