# Test Failure Diagnosis

## Use when

Use when a unit, package, browser, coverage, or targeted test command fails and the cause is unclear.

## Sources of truth

- Exact failing command and complete output
- `package.json`
- `.github/workflows/test.yml`
- Relevant test and implementation files
- `AGENT.md` invariants and environment requirements

## Procedure

1. Re-run the exact failing command once without changing the workspace.
2. Separate assertion failures, uncaught exceptions, timeouts, missing tools, environment errors, and packaging errors.
3. Determine whether the failure is reproducible and whether it existed before the active change.
4. Trace the first actionable failure rather than downstream cascade errors.
5. Compare the failure with the expected Node, browser, dependency, and filesystem assumptions.
6. Classify the cause as product defect, test defect, environment/tooling issue, stale fixture/documentation, or flaky/unreproduced.
7. Recommend the smallest next skill: triage, root-cause, regression test, bug fix, or validation.

## Required output

Return command, first actionable failure, reproducibility, classification, evidence, suspected owner/file, recommended next step, and confidence.

## Mutation policy and guardrails

This skill is read-only. Do not rerun with altered expectations, install packages, regenerate snapshots, or label an environment failure as a product bug without evidence.
