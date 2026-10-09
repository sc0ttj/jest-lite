# Mock and Spy Semantics Audit

## Use when

Use when reviewing `jest.fn`, `jest.spyOn`, mock metadata, reset/clear/restore APIs, automatic cleanup, or registry-contained mocks.

## Sources of truth

- Mock and spy engine in `jest-lite.js`
- mock cleanup and registry sections in `README.md`
- mock/spy tests in `jest-lite.test.js`
- mock-related invariants in `AGENT.md`

## Procedure

1. Trace `createMockFunction` for plain calls, constructors, thrown results, contexts, and metadata.
2. Verify `mock.calls`, `results`, `instances`, `contexts`, `returns`, and `lastCall`.
3. Trace queued and default implementations, including class implementations.
4. Trace `activeSpies` and `allMocks` ownership and lifecycle.
5. Compare `mockClear`, `mockReset`, `mockRestore`, and global cleanup semantics.
6. Verify spies restore the original property and preserve ownership behavior.
7. Verify registry-contained mock functions are included in clear/reset operations.
8. Confirm no mock operation intercepts real module resolution.
9. Map behaviors to tests and report gaps.

## Required output

Return a behavior matrix for plain mocks, spies, constructors, and registry mocks, with evidence and discrepancies.

## Guardrails

Do not introduce a second spy registry. Do not expose `esmRequire` or add import/require interception. Do not confuse reset with restore.
