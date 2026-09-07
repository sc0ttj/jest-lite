# AGENT.md — Contributor & Agent Guide for jest-lite

This document is for contributors (human or AI agent) working on `jest-lite` itself — its internals, invariants, and test workflow. For usage documentation, see [README.md](README.md).

---

## 1. What this project actually is

`jest-lite` is a single-file (`jest-lite.js`), zero-runtime-dependency, ESM-only library implementing a large subset of the Jest API: suite/test DSL, `expect` + matchers, mocks/spies, fake timers, snapshots, and an explicit in-memory mock registry. It runs unmodified in Node.js (>=22) and browsers.

It is **not** Jest and does not try to be a drop-in replacement:
- No CLI, no config file, no test-file discovery/globbing, no watch mode.
- No CommonJS build — `package.json`'s `exports` map has only an `"import"` condition. `require('@sc0ttj/jest-lite')` is expected to fail.
- The module/mock registry (`jest.mock`/`jest.requireMock`) is a plain `Map`, **not** an `import`/`require` interceptor. Real module resolution is completely untouched.
- Fake timers virtualize `setTimeout`/`setInterval`/`clearTimeout`/`clearInterval` only — `Date`/`performance.now()` are not mocked.

Keep this framing in mind when reviewing changes or reviewing docs: features should never be described as behaving like real Jest unless the code actually does so.

---

## 2. File map

| Path | Purpose |
|---|---|
| `jest-lite.js` | The entire library. Single IIFE that builds the API, attaches a subset to `globalThis`/`window`, then the file separately re-exports everything as named ESM exports (destructured off the `jest` object) plus a `export default jest`. |
| `jest-lite.test.js` | The library's own test suite, run via Node's native `node:test` (not self-hosted). Stubs `window`/`document`/`localStorage`/`HTMLElement` before importing `jest-lite.js`, then drives `jest-lite`'s own `describe`/`it`/`expect`/`run` as the system under test. |
| `scripts/package-smoke.mjs` | `npm pack`s the repo, installs the tarball into a scratch temp project, imports it as a real dependent package would, and runs a tiny suite through `run()`. Catches "works in this repo but not once published" regressions. |
| `scripts/browser-smoke.mjs` | Serves `jest-lite.js` over local HTTP, loads it in headless Chromium via Playwright, and exercises `describe`/`it`/`expect`/`run`/`toMatchSnapshot` (writing to real `localStorage`) inside an actual browser. |
| `.github/workflows/test.yml` | CI: `node` job (`npm test` + `npm run test:package` on Node 22.x/24.x/26.x), `coverage` job (`npm run test:coverage` on Node 24.x), `browser` job (`npm run test:browser` on Node 24.x with Playwright Chromium installed). |
| `__snapshots__/jest-lite.snap` | Snapshot fixture file — both a real snapshot store used by this repo's own `toMatchSnapshot()` calls, and part of what `jest-lite.test.js` inspects directly. |

`jest-lite.js` is internally organized into numbered `// === N. SECTION ===` blocks (currently 1–16): Error Contracts, Value Formatting, Asymmetric Matchers, Equality Engine, Mock & Spy Engine, Assertion Bookkeeping, Snapshot State, Matchers, Expect, Test/Hook Timeouts, Suite/Test DSL, Runner, Wait-For, Fake Timers, Module Registry, Public Surface. Keep new code inside the section it logically belongs to, and keep the numbering in the file-header JSDoc comment in sync with the section list if you add/remove one.

---

## 3. Core invariants — do not break these

1. **`.not` only inverts `JestLiteAssertionError`.** Every built-in matcher throws via `assertionError(...)`, which is branded with `isJestLiteAssertionError = true`. `invertMatcher` only swallows errors that pass `isAssertionError(error)`; anything else (a `TypeError` from misuse, a bug, etc.) must keep propagating even under `.not`. If you add a matcher, throw failures via `assertionError(...)` and misuse errors via `usageError(...)` — never a bare `throw new Error(...)`.
2. **Assertion counting.** Every matcher (including custom ones registered through `expect.extend`) must call `countAssertion()` exactly once per invocation so `expect.assertions(n)`/`expect.hasAssertions()` stay accurate. Custom matchers get this for free via `createCustomMatcherRunner`; built-ins call `countAssertion()` manually as the first line — don't forget it when adding one.
3. **Assertion contracts are validated after `afterEach`.** This is intentional (so hooks can assert too) — don't move the `expectedAssertions`/`requiresAssertions` check earlier.
4. **Only the first hook/test failure per test is recorded**, but **all** `afterEach` hooks in the chain still run even after an earlier failure (`beforeEach`/test failure doesn't short-circuit cleanup). Don't change `runSuite`'s `finally`/`recordFailure` structure without preserving this "always attempt cleanup" behavior.
5. **Automatic per-test cleanup is unconditional.** `runSuite`'s `finally` block calls `restoreAllMocks()` (spies only) and `useRealTimers()` (if fake timers were left on) after every test, pass or fail. Never gate this behind `if (!failure)`.
6. **Two-phase runner / `.only` scanning.** `suiteHasOnly(target)` is computed once per `run()` call *before* any suite executes, and is treated as a static `globalOnly` flag for the whole run. Don't switch this to a lazy/per-suite recomputation — Jest-like `.only` semantics depend on scanning the whole tree upfront.
7. **`reset` only clears the suite tree when `target === rootSuite`.** `run({ suite: someOtherSuite })` (internal recursion / advanced usage) must never reset the shared `rootSuite` registered by top-level `describe`/`it` calls.
8. **Snapshot storage feature-detects Node vs. browser at call time** (`useNodeSnapshotStorage()`), not at import time, and respects the internal `globalScope._forceBrowserStorage` test hook (used by `jest-lite.test.js` to exercise the browser/localStorage snapshot path from Node without needing an actual browser). Don't remove this hook — it's load-bearing for test coverage of the non-Node code path.
9. **`esmRequire` (from `createRequire(import.meta.url)`) exists solely to load `fs`/`path` in Node for snapshot persistence.** It is *not* a general CommonJS interop layer for user code, and must never be exposed as a way to `require()` arbitrary user modules — that would silently reintroduce real module loading into what's supposed to be an explicit, inert mock registry.
10. **The mock registry (`jest.mock`/`registerMock`) never touches real module resolution.** Don't add loader hooks, `import.meta.resolve` patching, or dynamic `import()` interception to "improve" this — it's an explicit design boundary, not a missing feature. If this ever changes, the README's "not an import interceptor" framing must be rewritten, not just amended.
11. **Global exposure is intentionally partial.** Only `jest, describe, it, test, expect, run, waitFor, beforeAll, afterAll, beforeEach, afterEach` are copied onto `globalThis`/`window`. `fn`, `spyOn`, `mock`/`requireMock`, timer functions, `resetSuites`, `getRootSuite`, `extendExpect`, `AssertionError` are reachable only via the `jest` namespace or ESM named imports. If you add a new top-level API, decide deliberately whether it belongs in the global-exposure list, the named-export list (`export const { ... } = jest`), or both — don't just default to "expose everywhere."
12. **Zero runtime dependencies.** `axios` and `playwright` in `package.json` are `devDependencies` used only by tests/smoke scripts. Never add a runtime dependency.
13. **Test/hook timeouts are enforced with the real, native timer, never the fake-timer clock.** `REAL_SET_TIMEOUT`/`REAL_CLEAR_TIMEOUT` are captured at module load time, before `jest.useFakeTimers()` (or anything else) can monkey-patch `globalScope.setTimeout`/`clearTimeout`. `withTimeout()` always schedules against these captured references. Don't change timeout enforcement to use `globalScope.setTimeout` directly — that would let `jest.useFakeTimers()` silently disable a test's own timeout, which is the whole point of this invariant.
14. **Timeout inputs are validated at registration time, not at run time.** `validateTimeout()` throws a `usageError` immediately (inside `it`/`test`/`.each`/`beforeAll`/`afterAll`/`beforeEach`/`afterEach`) for anything that isn't a non-negative finite number, `undefined` falling back to `DEFAULT_TEST_TIMEOUT` (5000ms). Don't move this check into the runner — misuse should fail fast when the suite tree is built, matching how `registerTest`/`registerSuite` already validate their other arguments.

---

## 4. Key subsystems (quick reference)

- **Equality engine (`equals`/`deepEquals`)** — pair-based cycle tracking (an array of `[a, b]` pairs, not just a single `WeakSet`, since two different comparisons can visit the same object). Handles `Date`, `RegExp`, `Error` (name+message, plus constructor check in strict mode), `Map`, `Set`, plain objects/arrays, and delegates to `asymmetricMatch()` whenever either side is an asymmetric matcher. `strict` (used by `toStrictEqual`) additionally requires matching constructors/prototypes and treats `undefined`-valued keys and array sparsity as significant.
- **Mock engine (`createMockFunction`)** — a single factory backs both `jest.fn()` and `jest.spyOn()` (spies pass `isSpy: true`, `originalImplementation`, and an `onRestore` callback that restores the wrapped property). `mock.calls`/`results`/`instances`/`contexts`/`returns` are populated synchronously inside the mock's own call wrapper: results are Jest-shaped (`{ type: 'return' | 'throw' | 'incomplete', value }`); `instances` distinguishes `new mockFn()` construction from a plain call via `new.target`; class implementations are invoked through `Reflect.construct` so `instanceof` behaves correctly.
- **Spy registry** — a single `Set` called `activeSpies` tracks every live spy (there is no separate parallel array/list — don't reintroduce one; earlier drafts of this doc referenced an `activeSpiesList` array that no longer exists in the source). `restoreAllMocks()` iterates and clears this set. A second, larger `Set` called `allMocks` tracks every mock/spy ever created (used by `clearAllMocks`/`resetAllMocks`, which must never restore spies — only clear/reset their state).
- **Runner (`runSuite`/`run`)** — recursive suite walker carrying a `context` object (`parents`, `stats`, `options`, `skipped`, `focused`, `globalOnly`, `inheritedError`). A failed `beforeAll` produces an `inheritedError` that fails every descendant test without re-running `beforeAll` per nested suite. `afterAll` always runs unless the suite itself is skipped (regardless of `inheritedError`).
- **Test/hook timeouts (`withTimeout`)** — every test (`test.timeout`) and hook (`{ fn, timeout }` objects stored in `suite.beforeAll`/`afterAll`/`beforeEach`/`afterEach`) is raced against a real `REAL_SET_TIMEOUT` call inside `withTimeout()`; whichever settles first (the work or the timer) wins, and the timer is always cleared in the losing/other branch so nothing leaks. A timeout produces a plain `Error` naming the test/hook and the duration, which flows through the exact same `recordFailure`/`onError` paths as a thrown error — the runner doesn't need a separate "timed out" code path. Default timeout is `DEFAULT_TEST_TIMEOUT = 5000`; validated via `validateTimeout()` at registration time (see invariants #13/#14).
- **Fake timers** — a from-scratch virtual clock (`virtualClockTime`, `pendingVirtualTasks` sorted by `(expiryTime, sequence)`), not backed by any timer library. `MAX_TIMER_ITERATIONS = 100000` guards `runAllTimers`/`advanceTimersByTime` against infinite `setInterval` loops. Recurring tasks are clamped to a minimum 1ms delay so a zero-delay `setInterval` can't spin forever. There is deliberately no `Date`/`performance.now()` virtualization — don't add it without updating the README limitation note and adding real coverage for it. Note: this system is completely separate from the `REAL_SET_TIMEOUT`-based timeout enforcement above; `jest.useFakeTimers()` only patches `globalScope.setTimeout`, which `withTimeout()` never touches.
- **Snapshots** — key format is `` snap__<suitePath joined by " > ">__<testName>__<callIndexWithinTest> `` unless an explicit name is passed to `toMatchSnapshot(name)`. Serialization is a custom `JSON.stringify` replacer (functions → `"[Function name]"`, `undefined` → `"[undefined]"`, circular → `"[Circular]"`, anything else that throws → `"[Unserializable]"`). Node storage path is `./__snapshots__/jest-lite.snap` relative to `process.cwd()` (not relative to the module file).

---

## 5. Test workflow

```bash
git clone https://github.com/sc0ttj/jest-lite.git
cd jest-lite
npm install

npm test              # node --test jest-lite.test.js (the main suite)
npm run test:coverage # same, with --experimental-test-coverage
npm run test:package  # npm pack + install tarball + smoke-test the published shape
npm run test:browser  # Playwright/Chromium smoke test (requires `npx playwright install --with-deps chromium` once)
npm run test:all      # all three of the above in sequence
```

- Always run `npm test` before and after making changes to establish a pass/fail baseline.
- `jest-lite.test.js` is large (thousands of lines) and organized as one big `nodeDescribe('jest-lite Framework Coverage Suite', ...)` block with nested `nodeDescribe`s per subsystem. It uses a `runIsolated(register, options)` helper (`jlResetSuites()` → register suites/tests → `jlRun({ silent: true, setExitCode: false, ...options })`) to execute a fresh, isolated `jest-lite` suite tree per `node:test` case, so one test's suite registration can't leak into another's.
- If you add a new matcher, mock feature, timer API, or runner option, add coverage for it in `jest-lite.test.js` using the same `runIsolated`/`nodeAssert.doesNotThrow`/`nodeAssert.throws` pattern already used throughout the file, rather than inventing a new harness style.
- `npm run test:browser` needs Playwright's Chromium browser installed locally (`npx playwright install --with-deps chromium`) — CI installs it automatically in the `browser` job.

---

## 6. Checklist before submitting a source change

1. Does the change preserve zero runtime dependencies? (No new entries under `dependencies` in `package.json`.)
2. Does it preserve ESM-only, no-CommonJS-build semantics? (Don't add a `"require"` condition to `exports`, don't reintroduce a UMD/CJS wrapper.)
3. Does every new/changed matcher call `countAssertion()` and throw via `assertionError`/`usageError` as appropriate (see invariant #1/#2)?
4. Does automatic per-test cleanup (spy restore, fake timer revert) still run unconditionally, even for a change that touches `runSuite`?
5. If you touched test/hook registration or the runner's `beforeAll`/`beforeEach`/`afterEach`/`afterAll` handling, do timeouts still enforce against `REAL_SET_TIMEOUT` (never `globalScope.setTimeout`), and is the timer still cleared on both the success and failure/timeout paths (invariant #13)?
6. If you touched the module registry, does it still avoid any form of real import/require interception?
7. If you touched global exposure or the ESM export list, did you update it deliberately (invariant #11) and reflect it in the README's "Global exposure in browsers" section?
8. Did you run `npm test` (and `npm run test:package`/`npm run test:browser` if the change could affect packaging or DOM/browser behavior) and confirm they pass?
9. Did you add/adjust tests in `jest-lite.test.js` covering the new behavior, following the existing `runIsolated` pattern?
10. If behavior visible to users changed (new matcher, changed default, new option), does `README.md` need a corresponding update? (Owned separately, but flag it.)

---

## 7. Known, intentional limitations (do not "fix" without discussion)

- No CLI, no test-file discovery/globbing, no watch mode, no config file.
- No CommonJS build/entry point.
- `jest.mock`/`jest.requireMock` is an explicit registry only; it never intercepts real `import`/`require`.
- Fake timers virtualize only `setTimeout`/`setInterval`/`clearTimeout`/`clearInterval`; `Date`/`performance.now()` remain real/unmocked.
- `runOnlyPendingTimers()` takes a single snapshot pass — timers scheduled *by* the callbacks it runs are left pending, not executed in the same call.
- Snapshot serialization is a bespoke JSON-based format, not Jest's pretty-printed snapshot format.
- The module registry's global alias assignment (`globalScope[moduleName] = mockExports`) is best-effort and silently no-ops against frozen/read-only globals.

These are documented in `README.md` as well; keep both files consistent if any of them ever change.

---

## 8. Useful agent skills for this repository

| Skill | When to use it |
|---|---|
| **Source-of-truth doc sync** | Before writing or reviewing any README/AGENT change, grep/read `jest-lite.js` directly rather than trusting prior docs or memory — this file has been rewritten multiple times and prior documentation has drifted from the implementation (e.g. `activeSpiesList` and CommonJS/CLI framing no longer apply). |
| **Cross-file consistency check** | After changing an exported API's name, default, or behavior in `jest-lite.js`, grep for its old name/behavior across `jest-lite.test.js`, `README.md`, and `AGENT.md` to catch stale references. |
| **Matcher coverage audit** | When adding a matcher, cross-reference `BUILT_IN_MATCHER_NAMES` (derived from `createMatchers(undefined)`) against both the README's matcher tables and `jest-lite.test.js` coverage to ensure nothing is documented-but-untested or implemented-but-undocumented. |
| **Runner semantics tracing** | For any change touching `runSuite`/`run`, manually trace the `beforeAll`-failure, `beforeEach`-failure, and `.only`-cascading code paths described in section 3 above before merging — these interact subtly and are easy to regress silently. |
| **Smoke-test triad** | Before considering a change "done," run `npm test`, `npm run test:package`, and (for anything touching DOM matchers, snapshots, or global exposure) `npm run test:browser`. |
