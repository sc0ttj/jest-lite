# Repository Test Validation

## Use when

Use when asked whether the repository tests pass, before/after a change, or when validating a release candidate.

## Sources of truth

- `package.json` scripts
- `AGENT.md` test workflow
- `jest-lite.test.js`
- `scripts/package-smoke.mjs`
- `scripts/browser-smoke.mjs`
- `.github/workflows/test.yml`

## Procedure

1. Confirm the working tree is not being modified by an unrelated process.
2. Run `npm test`.
3. Run `npm run test:package`.
4. Run `npm run test:browser`.
5. Record each command's exit code and concise final result.
6. If a command fails, report the first actionable failure and do not classify the suite as passing.

## Required output

Report a table with command, result, test counts when available, and failure summary. State the overall result only as **pass** when all three commands exit with code 0.

## Guardrails

This skill is read-only. Do not edit source, install packages, alter snapshots, commit changes, or substitute a partial test run for `npm run test:all`.
