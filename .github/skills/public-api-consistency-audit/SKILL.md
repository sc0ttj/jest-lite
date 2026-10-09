# Public API Consistency Audit

## Use when

Use when an export, namespace member, global convenience API, or public usage example changes or is under review.

## Sources of truth

- `jest-lite.js` public-surface section and ESM export list
- `README.md` API examples and global exposure section
- `jest-lite.test.js`
- `scripts/package-smoke.mjs`

## Procedure

1. Enumerate named ESM exports from `jest-lite.js`.
2. Enumerate members attached to the `jest` namespace.
3. Enumerate APIs copied to `globalThis`/`window`.
4. Compare all three surfaces with README examples and package smoke imports.
5. Confirm aliases point to the same intended implementation where documented.
6. Check that intentionally non-global APIs remain non-global.
7. Report missing, extra, incorrectly named, or incorrectly documented entries.

## Required output

Return three API-surface lists and a discrepancy table with symbol, expected surface, observed surface, evidence, and severity.

## Guardrails

Do not recommend broadening global exposure by default. Preserve ESM-only exports, the import-only package condition, and the deliberate partial browser global surface.
