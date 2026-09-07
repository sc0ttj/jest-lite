# AGENT.md - Contributor & Agent Guide for jest-lite

Welcome to **jest-lite**! This document provides an architectural deep-dive, codebase map, development guidelines, and AI/agent skills recommendations to assist human contributors and AI agents in maintaining, extending, and testing `jest-lite`.

---

## 1. Executive Summary

`jest-lite` is a zero-dependency, isomorphic, lightweight JavaScript test runner matching the core Jest API. It is designed to run identically in **Node.js** (via ES Modules or CommonJS) and directly inside **Browser Developer Tools** or frontend runtime contexts without build steps or transpilation.

### Key Characteristics
- **Zero Runtime Dependencies:** Built using pure vanilla ES6+ JavaScript.
- **Isomorphic Core:** Single codebase (`jest-lite.js`) serving both browser and Node.js environments.
- **Two-Phase Runner Engine:** First scans suite trees for focus markers (`it.only` / `describe.only`), then selectively executes matching test branches.
- **Jest API Compatibility:** Provides `describe`, `it`, `expect`, `jest.fn`, `jest.spyOn`, `jest.useFakeTimers`, `waitFor`, `expect.extend`, asymmetric matchers (`expect.any`, `expect.objectContaining`), and snapshot testing (`toMatchSnapshot`).
- **Self-Testing Isolation:** Tested using Node.js's native `node:test` runner (`jest-lite.test.js`), ensuring `jest-lite` can test itself without environment leaks.

---

## 2. Architecture & Engine Design

`jest-lite` is contained within a single IIFE wrapper in `jest-lite.js` that attaches its core primitives to `globalThis` (and `window` when available) while simultaneously exporting ES module named exports.

```
                  ┌─────────────────────────────────────────┐
                  │              jest-lite.js               │
                  └────────────────────┬────────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  │         IIFE Execution Scope            │
                  └────────────────────┬────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
┌───────▼────────┐             ┌───────▼────────┐             ┌───────▼────────┐
│  Suite Tree    │             │ Matcher Engine │             │ Mocking Engine │
│  (describe/it) │             │ (expect/deep)  │             │ (fn/spyOn)     │
└───────┬────────┘             └───────┬────────┘             └───────┬────────┘
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       │
                     ┌─────────────────┴─────────────────┐
                     │ Global Expose & ESM Named Exports │
                     └───────────────────────────────────┘
```

### 2.1 Core State & Data Structures

The framework manages internal state using top-level variables inside the IIFE wrapper:

```javascript
let rootSuite = createSuite('root');
let currentSuite = rootSuite;
let snapshotIndex = 0;
let currentTestName = "";
let assertionCount = 0;
let expectedAssertions = null;

const activeSpies = new Set();
const activeSpiesList = [];
const moduleRegistry = new Map();
const customMatchersRegistry = {};
```

#### Suite Object Blueprint
```javascript
const createSuite = (name = 'root') => ({
  name,
  tests: [],      // Array of test objects: { name, fn, mode: 'run' | 'only' | 'skip' }
  suites: [],     // Child suite objects (nested describe blocks)
  beforeAll: [],  // Functions executed once before suite tests
  afterAll: [],   // Functions executed once after suite tests
  beforeEach: [], // Functions executed before every test (inherited downward)
  afterEach: []   // Functions executed after every test (inherited downward)
});
```

### 2.2 Execution Flow & Two-Phase Runner

When `jest.run()` is called, the runner evaluates suites using a two-phase strategy:

```
[Phase 1: Focus Discovery]
   │
   ▼ Scan rootSuite recursively for any test/suite marked mode === 'only'
   │
   ├─► Found 'only'? Set globalOnly = true (all non-only tests will be skipped)
   └─► No 'only'? Set globalOnly = false (all mode === 'run' tests will execute)

[Phase 2: Suite Traversal & Hook Execution]
   │
   ├─► 1. Run suite.beforeAll hooks
   ├─► 2. For each test in suite.tests:
   │      ├── Check skip / focus state (increment stats.skip if skipped)
   │      ├── Collect parent suites list: [...parents, currentSuite]
   │      ├── Run all beforeEach hooks top-down (parent → child)
   │      ├── Execute test.fn() (await if async)
   │      ├── Validate expect.assertions(n) match
   │      ├── Run mockRestoreAll() global spy cleanup
   │      └── Run all afterEach hooks bottom-up (child → parent)
   ├─► 3. Recursively run child suites: run(childSuite, [...parents, suite], stats)
   └─► 4. Run suite.afterAll hooks
```

---

## 3. Core Subsystems Deep-Dive

### 3.1 Suite & Test DSL (`describe`, `it`, `it.each`)

- **`describe(name, cb)`**: Dynamically pushes a new suite onto `currentSuite.suites`, points `currentSuite` to the child, executes `cb()`, then restores `currentSuite` to the parent.
- **`it(name, fn)` / `it.only` / `it.skip`**: Registers test definitions into `currentSuite.tests` with the appropriate `mode` string (`'run'`, `'only'`, or `'skip'`).
- **`it.each(table)(name, fn)`**: Iterates over a data table (array of arrays or values), interpolating placeholder tokens (`%i`, `%s`, `%o`, `%d`, `%f`, `%j`) into test names using a regex `interpolate` helper, and registers individual test cases for every row.

### 3.2 Matchers & Assertions (`expect`, `deepEquals`)

Assertions use `expect(actual)` which returns a proxy object containing built-in matchers and custom matchers registered via `expect.extend`.

#### Deep Equality Algorithm (`deepEquals(a, b, seen)`)
1. **Strict Identity**: Checks `Object.is(a, b)` (handles `NaN === NaN` and `-0 !== +0`).
2. **Asymmetric Interceptors**: If `b` or `a` has `.asymmetricMatch(val)`, delegates evaluation to the asymmetric matcher (e.g. `expect.any(Number)`).
3. **Circular Reference Guard**: Tracks visited objects in a `seen` `Set` to prevent stack overflow on recursive structures.
4. **Prototypes & Properties**: Validates prototype constructors match (`a.constructor === b.constructor`), prototype chains align via `Object.getPrototypeOf`, and property key-value sets match strictly.

#### Matcher Inversion (`.not`)
Inverted matchers (`expect(x).not.toBe(y)`) wrap matcher calls in a try-catch block:
- If the inner matcher throws (assertion failed), `.not` swallows the error (meaning inverted test passes).
- If the inner matcher completes without error (assertion passed), `.not` throws `new Error('Expected NOT to ...')`.

### 3.3 Mocking & Spying (`jest.fn`, `jest.spyOn`, `mockRestoreAll`)

- **`jest.fn(impl)`**: Creates a mock function with call history tracking (`mock.calls`, `mock.results`), implementation queues (`mock._once` array vs `mock._default`), and helper chainers (`mockReturnValue`, `mockResolvedValue`, `mockImplementation`).
- **`jest.spyOn(obj, method)`**:
  - Saves the original property descriptor / function from `obj[method]`.
  - Replaces `obj[method]` with a spy wrapper that records calls (`mock.calls`) and return values (`mock.returns`).
  - Registers the spy function in `activeSpiesList` and `activeSpies` Set.
  - Exposes `spy.mockRestore()`, which safely restores `obj[method]` to its original implementation and unregisters the spy.
- **Automatic Cleanup (`mockRestoreAll()`)**: Called automatically in the `finally` block after every test execution in `run()`, preventing spy state leakage across test boundaries.

### 3.4 Fake Timers & Virtual Clock

- **`jest.useFakeTimers()`**: Intercepts `globalScope.setTimeout`, `clearTimeout`, `setInterval`, and `clearInterval`. Pushes scheduled tasks into a `pendingVirtualTasks` array as `VirtualTask` instances.
- **`jest.advanceTimersByTime(ms)`**: Fast-forwards `virtualClockTime` by `ms` milliseconds, chronologically sorting and executing due tasks in `pendingVirtualTasks`, automatically re-queueing recurring `setInterval` tasks.
- **`jest.useRealTimers()`**: Restores native timer primitives from `nativeTimers`.

### 3.5 Isomorphic Snapshot Testing (`toMatchSnapshot`)

Snapshots generate unique deterministic storage keys using `snap__${suiteName}__${testName}__${snapshotIndex}`:
- **Node.js Environment**: Uses `createRequire(import.meta.url)` to load native `fs` and `path` modules, writing snapshots to `./__snapshots__/jest-lite.snap` as formatted JSON.
- **Browser Environment**: Saves snapshots to `localStorage` (falling back to an in-memory object `globalThis._fallbackSnapCache`).
- **Snapshot Update Mode**: Checked via `globalThis.updateSnapshots = true`. When set, overwrites stored snapshot expectations.

### 3.6 Asynchronous Polling (`waitFor`)

`waitFor(callback, { timeout = 1000, interval = 50 })` repeatedly executes an assertion block in a polling loop until:
1. The callback completes without throwing an exception (resolves Promise).
2. `timeout` duration is exceeded (rejects Promise with the last caught error message).

---

## 4. Testing Strategy & Developer Workflow

### 4.1 Running the Test Suite

`jest-lite` tests itself using Node.js's native test runner (`node --test`).

```bash
# Run the complete test suite
npm test
```

### 4.2 How the Test Environment Works (`jest-lite.test.js`)

`jest-lite.test.js` sets up a simulated browser environment before importing `jest-lite.js`:

```javascript
// 1. Mock browser globals in Node.js
globalThis.window = globalThis;
globalThis.localStorage = { store: {}, setItem(k,v){...}, getItem(k){...}, clear(){...} };
globalThis.document = { activeElement: null, createElement(){...}, body: {...} };

// 2. Import node:test primitives and jest-lite
import { describe, it, beforeEach } from 'node:test';
import './jest-lite.js';

// 3. Extract jest-lite framework APIs
const jlExpect = globalThis.jest?.expect || globalThis.expect;
const jlFn     = globalThis.jest?.fn     || globalThis.fn;
const jlSpyOn  = globalThis.jest?.spyOn  || globalThis.spyOn;
```

### 4.3 CI/CD Workflow (`.github/workflows/test.yml`)

Every push or pull request to `main`/`master` triggers a GitHub Action matrix test across active Node LTS versions (`20.x`, `22.x`, `24.x`):

```yaml
strategy:
  matrix:
    node-version: [20.x, 22.x, 24.x]
```

---

## 5. Common Pitfalls & Debugging Tips

1. **Unrestored Spies**: If a test manually creates spies or object modifications outside `jest.spyOn`, auto-cleanup won't track them. Always use `jest.spyOn(obj, 'method')`.
2. **`expect.assertions(n)` Miscounts**: Ensure custom matchers or helper matchers call `countAssertion()` at the entry point so the assertion telemetry counter accurately increments.
3. **Fake Timers in Async Tests**: When using `jest.useFakeTimers()`, ensure `jest.useRealTimers()` is called in an `afterEach` or `finally` block if a test fails early, to prevent subsequent tests from hanging on native timer calls.
4. **Circular References in Objects**: When adding new matchers or deep object inspections, always pass the `seen` `Set` to recursive `deepEquals` calls to prevent call stack overflow.

---

## 6. Recommended Agent Skills for `jest-lite`

To assist AI agents working on this repository, the following skills are categorized by domain, specifying their purpose, input/output schemas, and feasibility:

| Skill Name | Domain | Description | Feasibility | Priority |
| :--- | :--- | :--- | :--- | :--- |
| `testcov-analyzer` | Code Analysis | Analyzes `jest-lite.js` vs `jest-lite.test.js` to report uncovered matchers or edge cases. | High | High |
| `spy-leak-detector` | Quality & Bug-Hunting | Audits tests to ensure all `spyOn` calls use `mockRestore` or automatic cleanup. | High | High |
| `matcher-benchmarker` | Performance | Benchmarks execution speed of `deepEquals`, `toEqual`, and `toMatchObject` on large datasets. | Medium | Medium |
| `snapshot-migrator` | Utility | Validates snapshot format compatibility between browser `localStorage` and Node `.snap` files. | High | Medium |
| `property-test-gen` | Testing | Generates fast-check / property-based tests for asymmetric matchers (`expect.any`, `objectContaining`). | Medium | Medium |
| `cross-version-runner` | CI/CD | Runs `npm test` against multiple Node versions locally using nvm/fnm. | High | Low |
| `docgen-agent` | Documentation | Parses JSDoc annotations in `jest-lite.js` and syncs API references in `README.md` and `AGENT.md`. | High | Medium |

### 6.1 Skill Specification Details

#### 1. `testcov-analyzer`
- **Purpose**: Scans all exported matchers, lifecycle hooks, and mock helpers in `jest-lite.js` and cross-references them against test blocks in `jest-lite.test.js`.
- **Inputs**: Paths to source and test files (`jest-lite.js`, `jest-lite.test.js`).
- **Outputs**: Coverage report listing missing matcher tests, un-tested asymmetric matcher edge cases, and missing error boundary checks.

#### 2. `spy-leak-detector`
- **Purpose**: Parses AST or code patterns to detect manual method overwrites (`obj.method = fn`) that bypass `jest.spyOn`, which could lead to cross-test pollution.
- **Inputs**: Test file path (`jest-lite.test.js`).
- **Outputs**: List of line numbers with un-tracked spy modifications and proposed fixes converting them to `jest.spyOn`.

#### 3. `matcher-benchmarker`
- **Purpose**: Creates an isolated benchmark script measuring operations-per-second for `toEqual`, `toMatchObject`, and `deepEquals` across 1,000+ deeply nested objects.
- **Inputs**: Target iteration count, object depth complexity.
- **Outputs**: Execution time metrics in milliseconds and memory allocation delta.

---

## 7. Guidelines for Agentic Code Contributions

When modifying `jest-lite`:
1. **Preserve Zero Dependencies**: Do not add runtime dependencies to `package.json`.
2. **Maintain Isomorphic Support**: Ensure any new DOM, Node `fs`, or environment-specific feature includes safe detection guards (`typeof process !== 'undefined'`, `typeof window !== 'undefined'`).
3. **Keep Code Compact**: `jest-lite` values simplicity and low overhead over complex abstraction layers.
4. **Run Baseline Tests First**: Always run `npm test` before making changes to confirm baseline health.
