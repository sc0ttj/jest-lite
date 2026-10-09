# Repository Skills

These repository-local skills are deterministic procedures for maintaining `jest-lite`. Choose the smallest applicable skill and preserve the source-of-truth and invariant rules in [`AGENT.md`](../../AGENT.md).

## Testing and quality

- [Node Testing and Matrix Validation](node-testing-and-matrix-validation/SKILL.md)
- [Browser Testing and Diagnosis](browser-testing-and-diagnosis/SKILL.md)
- [Coverage Checking and Analysis](coverage-checking-and-analysis/SKILL.md)
- [Accessibility Testability Audit](accessibility-testability-audit/SKILL.md)

These skills are read-only. They distinguish declared CI coverage from locally executed versions, real-browser checks from DOM shims, coverage percentage from behavioral completeness, and lightweight accessibility testability from WCAG conformance.

## Defect lifecycle

Use these in order when a bug needs investigation and repair:

1. [Bug Triage and Reproduction](bug-triage-and-reproduction/SKILL.md) — reduce a report to a repeatable, minimal failure.
2. [Root-Cause Investigation](root-cause-investigation/SKILL.md) — trace the failure to a specific code path or violated contract.
3. [Regression Test Design](regression-test-design/SKILL.md) — add deterministic coverage that fails before the fix.
4. [Surgical Bug Fix](surgical-bug-fix/SKILL.md) — implement the smallest invariant-preserving correction.
5. [Test Failure Diagnosis](test-failure-diagnosis/SKILL.md) — classify failures when any validation step is unclear.
6. [Post-Fix Validation](post-fix-validation/SKILL.md) — verify targeted, baseline, package, browser, and release checks by impact.

The fix workflow may modify source and tests only within the active bug's scope. Triage, root-cause analysis, failure diagnosis, and post-fix validation are read-only; regression-test design may add or adjust tests.

## Audits and release

- [Repository Test Validation](repo-test-validation/SKILL.md)
- [Source-of-Truth Documentation Sync](source-of-truth-documentation-sync/SKILL.md)
- [Public API Consistency Audit](public-api-consistency-audit/SKILL.md)
- [Matcher Coverage Audit](matcher-coverage-audit/SKILL.md)
- [Runner Invariants Audit](runner-invariants-audit/SKILL.md)
- [Mock and Spy Semantics Audit](mock-spy-semantics-audit/SKILL.md)
- [Fake Timer Safety Audit](fake-timer-safety-audit/SKILL.md)
- [Snapshot Compatibility Audit](snapshot-compatibility-audit/SKILL.md)
- [Package Publication Audit](package-publication-audit/SKILL.md)
- [Browser Compatibility Audit](browser-compatibility-audit/SKILL.md)
- [Release Readiness Check](release-readiness-check/SKILL.md)

These skills are read-only audits and gates. They report evidence and recommended actions but do not edit repository files.
