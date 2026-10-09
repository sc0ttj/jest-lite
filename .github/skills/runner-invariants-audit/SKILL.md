# Runner Invariants Audit

## Use when

Use when reviewing changes to `run`, `runSuite`, suite registration, hooks, timeouts, `.only`, reset behavior, or assertion bookkeeping.

## Sources of truth

- Runner and registration sections in `jest-lite.js`
- runner invariants in `AGENT.md`
- lifecycle and run sections in `README.md`
- runner tests in `jest-lite.test.js`

## Procedure

1. Trace top-level `run()` setup, static `.only` scanning, options, and reset handling.
2. Trace `beforeAll`, `beforeEach`, test, `afterEach`, and `afterAll` control flow.
3. Verify first-failure recording and continued cleanup after failures.
4. Verify inherited `beforeAll` failures reach all descendants without rerunning setup.
5. Verify skipped suites do not run hooks and `afterAll` behavior matches the documented exception.
6. Verify assertion contracts are checked after `afterEach`.
7. Verify test and hook timeouts use captured real timers and clear timers on all paths.
8. Verify unconditional spy restoration and fake-timer cleanup.
9. Map each claim to an existing test or report missing coverage.

## Required output

Return an execution-path checklist, evidence table, and any untested or violated invariant. Include the affected phase (`beforeAll`, `beforeEach`, `test`, `afterEach`, or `afterAll`) when relevant.

## Guardrails

Do not replace static global `.only` scanning with lazy scanning. Do not move assertion checks before `afterEach` or make cleanup conditional on success.
