# Snapshot Compatibility Audit

## Use when

Use when reviewing snapshot persistence, naming, serialization, update mode, Node/browser behavior, or localStorage handling.

## Sources of truth

- Snapshot section in `jest-lite.js`
- snapshot section in `README.md`
- `__snapshots__/jest-lite.snap`
- snapshot tests in `jest-lite.test.js`
- `scripts/browser-smoke.mjs`

## Procedure

1. Trace storage selection at call time, including `_forceBrowserStorage`.
2. Verify Node path resolution is relative to `process.cwd()`.
3. Verify browser localStorage and in-memory fallback behavior.
4. Verify implicit key format, explicit names, and per-test call indexes.
5. Verify serialization for functions, `undefined`, circular values, and unserializable values.
6. Verify first-write, mismatch, update, and silent-mode behavior.
7. Compare Node tests, fixture contents, and browser smoke assertions.
8. Report compatibility gaps with exact evidence.

## Required output

Return a storage matrix, key/serialization matrix, update-mode behavior, and test evidence.

## Guardrails

Do not replace the bespoke JSON snapshot format with Jest's format. Do not assume browser capability from import-time environment detection.
