# Source-of-Truth Documentation Sync

## Use when

Use before or after changing `README.md`, `AGENT.md`, API documentation, limitations, examples, or workflow descriptions.

## Sources of truth

Read implementation first: `jest-lite.js`. Then compare `jest-lite.test.js`, `package.json`, smoke scripts, `README.md`, and `AGENT.md`.

## Procedure

1. Identify the documented claim, symbol, option, behavior, or command.
2. Locate its implementation in `jest-lite.js` or its authoritative package/test source.
3. Locate direct coverage in tests or smoke scripts.
4. Compare names, defaults, error behavior, limitations, environment assumptions, and examples.
5. Report each mismatch with file and line evidence.
6. Re-check nearby cross-references and headings after any proposed documentation correction.

## Required output

Return a table of claim, implementation evidence, test evidence, documentation evidence, status, and recommended correction. Distinguish stale documentation from behavior that is merely undocumented.

## Guardrails

Do not infer behavior from prior documentation. Do not edit files, rewrite examples speculatively, or describe `jest-lite` as a full Jest replacement.
