# Root-Cause Investigation

## Use when

Use after a bug has a reproducible symptom and before adding a regression test or implementing a fix.

## Sources of truth

- The triage reproduction
- Relevant sections and symbols in `jest-lite.js`
- Matching tests in `jest-lite.test.js`
- Invariants and subsystem guidance in `AGENT.md`
- User-visible contract in `README.md`

## Procedure

1. Run the reproduction again and capture the failing assertion, stack, phase, and first meaningful error.
2. Trace the call path from the public API to the failing implementation branch.
3. Compare actual control flow and state with the documented contract and applicable invariant.
4. Inspect nearby tests and prior-art helpers before proposing new logic.
5. Form one primary root-cause hypothesis and list alternatives only when evidence remains ambiguous.
6. Use a focused probe or temporary diagnostic only when it can be removed without changing behavior.
7. Confirm the hypothesis by identifying the smallest code path whose correction would explain the failure.
8. Hand off the root cause, affected files, and non-goals to regression-test design and bug fixing.

## Required output

Return evidence, call path, violated contract/invariant, primary root cause, alternatives considered, affected files, non-goals, and confidence.

## Mutation policy and guardrails

Investigation is read-only. Use existing tests and direct inspection rather than editing diagnostics into the repository. Do not refactor while tracing, broaden the bug, or declare a root cause based only on a failing assertion without source evidence.
