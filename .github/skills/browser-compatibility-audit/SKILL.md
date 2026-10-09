# Browser Compatibility Audit

## Use when

Use when reviewing DOM matchers, browser globals, localStorage snapshots, browser imports, or changes that may differ between Node and Chromium.

## Sources of truth

- DOM, global exposure, and snapshot code in `jest-lite.js`
- README DOM and global exposure sections
- `scripts/browser-smoke.mjs`
- browser-related tests in `jest-lite.test.js`
- `.github/workflows/test.yml`

## Procedure

1. Identify browser-only assumptions and feature detection in the changed area.
2. Verify DOM matchers use duck typing and do not require Node-only globals.
3. Compare the global exposure list with the documented list.
4. Verify browser snapshot storage writes to real localStorage and respects update behavior.
5. Run `npm run test:browser`.
6. Compare smoke assertions with README examples and report discrepancies.

## Required output

Return a browser-surface checklist, global exposure comparison, smoke-test result, and Node/browser divergence findings.

## Guardrails

Do not expand global exposure casually. Do not replace feature detection with hard `HTMLElement` or Node dependencies. Do not treat a Node DOM shim as browser validation.
