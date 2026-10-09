# Accessibility Testability Audit

## Use when

Use when reviewing DOM matchers, browser-facing examples, focus/visibility behavior, semantic attributes, or whether a browser test can express a lightweight accessibility-relevant assertion.

## Sources of truth

- DOM matcher implementation in `jest-lite.js`
- DOM matcher tests in `jest-lite.test.js`
- `scripts/browser-smoke.mjs`
- DOM and browser sections in `README.md`
- `.github/workflows/test.yml`

## Procedure

1. Identify the DOM behavior under review: existence, text, role-related attributes, labels, disabled state, focus, visibility, or document membership.
2. Verify the matcher uses feature detection and asserts observable behavior rather than implementation-specific internals.
3. Check whether the test uses a real browser or only a Node DOM shim, and state the limitation.
4. Prefer deterministic assertions for accessible names/labels, `aria-*` attributes, native control state, focus, visibility, and keyboard-adjacent state transitions when the fixture supports them.
5. Check negative cases and misleading success-shaped fallbacks.
6. Map findings to existing DOM tests and browser smoke coverage.
7. Report missing testability affordances or assertions separately from application-level accessibility defects.

## Required output

Return a matrix of behavior, observable assertion, test environment, existing coverage, limitation, and recommended test case.

## Guardrails

This skill is read-only and does not certify WCAG conformance, screen-reader behavior, color contrast, or application accessibility. Do not add an accessibility dependency, treat `HTMLElement` shims as full browser evidence, or claim an application is accessible based on matcher availability.
