# Browser Testing and Diagnosis

## Use when

Use when validating real browser behavior, diagnosing Chromium smoke failures, or reviewing changes to browser imports, DOM behavior, globals, or localStorage.

## Sources of truth

- `scripts/browser-smoke.mjs`
- `package.json`
- `.github/workflows/test.yml`
- `jest-lite.js`
- `jest-lite.test.js`
- `README.md`

## Procedure

1. Confirm the browser test uses Playwright Chromium rather than only a Node DOM shim.
2. Confirm required browser installation assumptions from CI and the smoke script.
3. Run `npm run test:browser`.
4. If it fails, classify the first actionable error as browser availability, HTTP serving, module loading, DOM behavior, snapshot storage, assertion, or environment.
5. Compare browser behavior with the corresponding Node test and documented global/API contract.
6. Report whether the failure is reproducible and whether it is browser-only.

## Required output

Return prerequisites, command, browser/runtime evidence, first actionable failure, Node comparison, classification, and unresolved limitations.

## Guardrails

This skill is read-only. Do not substitute a DOM shim for real-browser validation, install browsers during diagnosis, update snapshots to hide a failure, or call browser compatibility proven when the smoke test did not run.
