# Coverage Checking and Analysis

## Use when

Use when checking test coverage, reviewing a coverage change, or deciding whether a new behavior has adequate exercised paths.

## Sources of truth

- `package.json`
- `.github/workflows/test.yml`
- `jest-lite.test.js`
- `jest-lite.js`
- `AGENT.md`

## Procedure

1. Confirm coverage is measured by the existing `npm run test:coverage` command using Node's `--experimental-test-coverage`.
2. Run the coverage command without changing thresholds or test selection.
3. Record the reported line, function, branch, and statement results when available.
4. Map uncovered regions to implementation sections and intended behavior.
5. Check whether uncovered code is a meaningful runtime path, environment-specific branch, defensive error path, or intentionally unreachable path.
6. Compare new or changed behavior with focused tests and regression coverage.
7. Report gaps without inventing repository-wide minimum thresholds that are not configured.

## Required output

Return command/result, coverage metrics, uncovered regions, classification of each gap, related tests, and recommended test targets.

## Guardrails

This skill is read-only. Do not add dependencies, alter coverage thresholds, delete hard-to-cover tests, or equate a high percentage with behavioral completeness.
