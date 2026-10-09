# Surgical Bug Fix

## Use when

Use after a reproducible failure and root cause are established, preferably with a failing regression test.

## Sources of truth

- The failing regression test
- Root-cause investigation record
- Relevant `jest-lite.js` section
- `AGENT.md` invariants
- Existing implementation patterns and helpers

## Procedure

1. Confirm the regression test fails for the intended reason before editing production code.
2. Identify the smallest implementation change that corrects the root cause.
3. Reuse existing helpers, error contracts, naming, and control-flow patterns.
4. Preserve assertion counting, cleanup, timeout, export, storage, and module-registry invariants as applicable.
5. Apply only the source change and directly dependent test/documentation updates.
6. Run the focused regression test and inspect the diff.
7. Run the broader relevant suite; escalate to package/browser checks based on change impact.
8. Report residual risks rather than making speculative cleanup changes.

## Required output

Return changed files, root cause fixed, why the patch is minimal, focused-test result, broader validation result, and residual risks.

## Mutation policy and guardrails

This skill may make minimal source changes and directly related test changes. Do not add dependencies, rewrite unrelated code, alter public behavior beyond the defect correction, use broad catches, suppress errors, or use destructive git commands.
