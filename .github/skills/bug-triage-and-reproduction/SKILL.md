# Bug Triage and Reproduction

## Use when

Use when a bug report, failing example, or unexpected behavior has not yet been reduced to a repeatable repository-local failure.

## Sources of truth

- The reported symptom and reproduction
- `jest-lite.js`
- `jest-lite.test.js`
- `README.md`
- `AGENT.md`
- `package.json`

## Procedure

1. Record the exact expected behavior, observed behavior, environment, command, and input.
2. Check the working tree and identify unrelated pre-existing changes; never overwrite them.
3. Reproduce with the smallest relevant existing test command.
4. Reduce the case to the smallest input, suite, API call, or environment condition that still fails.
5. Classify the failure as implementation, test expectation, documentation, packaging, environment, or unreproduced.
6. Identify the likely subsystem and relevant invariant without changing files.
7. Hand off a minimal reproduction and evidence to root-cause investigation.

## Required output

Return a triage record containing symptom, expected/actual behavior, exact reproduction command, minimized case, environment, classification, affected subsystem, and confidence.

## Mutation policy and guardrails

This skill is read-only. Do not edit source or tests, change dependencies, alter snapshots, or suppress a failure. If reproduction is impossible, report the missing prerequisite instead of guessing.
