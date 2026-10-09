# Post-Fix Validation

## Use when

Use after a source or regression-test change, before reporting a bug as fixed or handing it off for review.

## Sources of truth

- Final working-tree diff
- The regression test and affected implementation
- `package.json` scripts
- `AGENT.md` test workflow and invariants
- `README.md` when behavior is user-visible

## Procedure

1. Confirm the regression test now passes and still asserts the original symptom.
2. Run the smallest affected test subset.
3. Run `npm test` for any production or test-harness change.
4. Run `npm run test:package` for export, packaging, or public-surface changes.
5. Run `npm run test:browser` for DOM, global exposure, browser storage, or browser-runtime changes.
6. Run `npm run test:all` for release-level or cross-subsystem changes.
7. Inspect `git diff --check`, changed paths, and related documentation.
8. Confirm no dependency, snapshot, runtime, or unrelated changes slipped in.
9. Report passing evidence and unresolved risks; do not call a fix complete when a required check is unavailable or failing.

## Required output

Return a validation matrix with check, reason required, command, result, and evidence, followed by changed-file scope and remaining risks.

## Mutation policy and guardrails

This skill may run checks and make no source changes. Do not repair failures during validation; hand them to failure diagnosis or the bug-fix workflow.
