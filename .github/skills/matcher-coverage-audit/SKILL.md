# Matcher Coverage Audit

## Use when

Use when adding, removing, renaming, or changing a built-in or custom matcher.

## Sources of truth

- `jest-lite.js` matcher factory and `BUILT_IN_MATCHER_NAMES`
- matcher sections in `README.md`
- matcher-focused cases in `jest-lite.test.js`
- `AGENT.md` matcher invariants

## Procedure

1. Derive the implemented built-in matcher names from the source.
2. Compare them with every README matcher table and alias.
3. Find positive, negative, misuse, and edge-case tests for the affected matcher.
4. Verify every built-in matcher calls `countAssertion()` exactly once.
5. Verify assertion failures use `assertionError(...)` and misuse uses `usageError(...)`.
6. Verify `.not`, asymmetric values, async wrappers, and custom matcher registration where applicable.
7. Report implemented-but-undocumented, documented-but-unimplemented, and untested behavior separately.

## Required output

Return coverage matrices for implementation, documentation, and tests, followed by invariant violations and exact evidence.

## Guardrails

Do not treat a matcher name appearing in one file as proof of complete coverage. Do not alter matcher behavior or tests while auditing.
