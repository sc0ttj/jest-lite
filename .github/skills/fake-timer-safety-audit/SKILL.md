# Fake Timer Safety Audit

## Use when

Use when reviewing fake timers, interval scheduling, timer cleanup, virtual clock behavior, or test/hook timeout changes.

## Sources of truth

- Fake timer and `withTimeout` sections in `jest-lite.js`
- fake timer and timeout sections in `README.md`
- timer tests in `jest-lite.test.js`
- timer invariants in `AGENT.md`

## Procedure

1. Confirm `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `Date`, and available `performance.now()` reads share the same virtual timeline.
2. Trace virtual task ordering by expiry time and sequence.
3. Verify recurring timers clamp zero-delay intervals and enforce the iteration guard.
4. Verify `runOnlyPendingTimers()` executes one initial snapshot only.
5. Verify `advanceTimersByTime`, `runAllTimers`, `advanceTimersToNextTimer`, and `clearAllTimers`.
6. Verify fake wall-clock reads start at activation values, remain frozen while real time passes, and expose each callback's scheduled virtual time.
7. Verify `useRealTimers()` restores native functions and property descriptors, and runner cleanup invokes it when needed.
8. Verify test/hook timeouts use `REAL_SET_TIMEOUT` and cannot be disabled by fake timers.
9. Check corresponding Node and browser tests and report missing coverage.

## Required output

Return a timer API matrix, real-vs-virtual timer boundary, cleanup-path evidence, and findings.

## Guardrails

Do not claim `setSystemTime` support. Do not replace the native timeout or `waitFor` references with patched globals.
