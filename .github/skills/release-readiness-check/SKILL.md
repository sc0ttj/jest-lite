# Release Readiness Check

## Use when

Use before publishing a version, creating a release, or declaring a broad change ready for consumers.

## Sources of truth

- `package.json`
- `README.md`
- `AGENT.md`
- `jest-lite.js`
- `jest-lite.test.js`
- `scripts/package-smoke.mjs`
- `scripts/browser-smoke.mjs`
- `.github/workflows/test.yml`

## Procedure

1. Check package metadata, version, ESM-only exports, engine, license, and published files.
2. Check README and AGENT claims against current implementation.
3. Check public API, matcher, runner, mock, timer, and snapshot consistency as applicable.
4. Run `npm run test:all`.
5. Confirm zero runtime dependencies and package smoke success.
6. Confirm browser smoke success when browser-visible behavior is included.
7. Inspect the final diff and list unresolved blockers.

## Required output

Return a release checklist with pass/fail status, command evidence, documentation findings, package findings, and explicit blockers. The result is **ready** only when all required checks pass and no high-confidence contradiction remains.

## Guardrails

This is a read-only gate. Do not bump versions, edit source/docs, regenerate snapshots, commit, publish, or waive a failed required check.
