# jest-lite

A zero-runtime-dependency, Jest-compatible test **library** for modern Node.js (>=22) and browsers. `jest-lite` gives you `describe`/`it`/`expect`/`jest.fn`/fake timers/snapshots/etc. in a single ~80KB ESM file that you `import` and drive yourself with `await run()` — there is no CLI, no test-file discovery, and no watch mode.

[![Node.js CI](https://github.com/sc0ttj/jest-lite/actions/workflows/test.yml/badge.svg)](https://github.com/sc0ttj/jest-lite/actions/workflows/test.yml)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What this is (and isn't)

- **Is:** a small, self-contained ESM module implementing a large, practical subset of the Jest API (suites, hooks, `expect` + matchers, mocks/spies, fake timers, snapshots, an explicit mock registry) that runs unmodified in Node.js and in browsers/DevTools.
- **Is not:** a drop-in replacement for Jest. There is no `jest` CLI, no automatic test-file discovery/globbing, no watch mode, no config file, no CommonJS build, and no coverage tool bundled in. You call `describe`/`it` yourself, then explicitly call `run()` yourself (Node's own `node --test` runner, or a `<script>` tag/console, is what actually invokes your file).
- **Module registry, not module interception:** `jest.mock()`/`jest.requireMock()` provide an in-memory lookup table for fake exports. Real `import`/`require` statements in your code are **never** rewritten or intercepted — see [Explicit Mock Registry](#explicit-mock-registry-not-an-import-interceptor) below.

---

## Requirements

- Node.js **>= 22** (only relevant if you run tests under Node; the file itself also runs directly in any modern browser).
- No install-time or runtime dependencies. `axios` and `playwright` in `package.json` are **devDependencies** used only by this repo's own smoke tests.
- Your project must be ESM (`"type": "module"` in `package.json`, or a `.mjs` file) — `jest-lite.js` has no CommonJS entry point and cannot be `require()`-d.

## Install

Until the first scoped npm release, install directly from GitHub:

```bash
npm install --save-dev github:sc0ttj/jest-lite
```

After `@sc0ttj/jest-lite` is published:

```bash
npm install --save-dev @sc0ttj/jest-lite
```

This installs a single file (`jest-lite.js`) plus `README.md`, `AGENT.md` and `LICENSE` — there's nothing else to build or configure.

---

## Quickstart

### Node.js

Create `math.test.js` (ESM — either add `"type": "module"` to your `package.json`, or use a `.mjs` extension):

```javascript
import { describe, it, expect, run } from '@sc0ttj/jest-lite';

describe('Calculator', () => {
  it('adds numbers correctly', () => {
    expect(2 + 3).toBe(5);
  });

  it('handles object equality', () => {
    expect({ user: 'Alice' }).toEqual({ user: 'Alice' });
  });
});

const stats = await run();
console.log(stats); // { pass, fail, skip, todo, total, failures }
```

Run it directly with Node:

```bash
node math.test.js
```

**Failure signaling:** by default `run()` sets `process.exitCode = 1` in Node when any test fails (so `node math.test.js && echo ok` behaves like a normal CLI test runner), without terminating the process itself. Pass `{ exitOnFail: true }` to hard-`process.exit(1)` instead, `{ throwOnFail: true }` to throw an aggregated `Error` (with a `.stats` property) that you can catch, or `{ setExitCode: false }` to disable exit-code mutation entirely (useful when you only care about the returned `stats` object, e.g. in the package/browser smoke tests in this repo).

### Browser

**Script tag (page under test):**

```html
<script type="module">
  import { describe, it, expect, run } from './jest-lite.js';

  describe('UI check', () => {
    it('has a document title', () => {
      expect(document.title).not.toBe('');
    });
  });

  const stats = await run();
  console.log(stats);
</script>
```

**DevTools console (paste-and-run, no build step):** modern DevTools consoles support top-level `await` and dynamic `import()`:

```javascript
const { describe, it, expect, run } = await import('https://cdn.jsdelivr.net/gh/sc0ttj/jest-lite@1.0.0/jest-lite.js');

describe('UI Live Check', () => {
  it('verifies document title', () => {
    expect(document.title).not.toBe('');
  });
});

await run();
```

> **Pin the CDN URL to a tag or commit SHA** (e.g. `@1.0.0`, not `@main`/unversioned), so a future breaking change to this repo can't silently change behavior of code you've already written. After the scoped package is published, `https://cdn.jsdelivr.net/npm/@sc0ttj/jest-lite@1.0.0/jest-lite.js` is the npm-backed equivalent.

The module also attaches a subset of its API onto `globalThis`/`window` as a convenience for console pasting (see [Global exposure in browsers](#global-exposure-in-browsers) below), so `describe`, `it`, `test`, `expect`, `run`, `waitFor`, `jest`, and the hooks are usable without destructuring the import.

---

## Table of contents

1. [Suites & tests](#1-suites--tests)
2. [Lifecycle hooks](#2-lifecycle-hooks)
3. [Data-driven tests (`.each`)](#3-data-driven-tests-each)
4. [Running tests: `run()`](#4-running-tests-run)
5. [Writing assertions with `expect`](#5-writing-assertions-with-expect)
6. [Core matchers](#6-core-matchers)
7. [Asymmetric matchers](#7-asymmetric-matchers)
8. [DOM matchers](#8-dom-matchers)
9. [Mock functions (`jest.fn`)](#9-mock-functions-jestfn)
10. [Spies (`jest.spyOn`)](#10-spies-jestspyon)
11. [Mock/spy cleanup semantics](#11-mockspy-cleanup-semantics)
12. [Fake timers](#12-fake-timers)
13. [Snapshot testing](#13-snapshot-testing)
14. [Explicit mock registry](#explicit-mock-registry-not-an-import-interceptor)
15. [Custom matchers (`expect.extend`)](#15-custom-matchers-expectextend)
16. [Async polling (`waitFor`)](#16-async-polling-waitfor)
17. [Global exposure in browsers](#global-exposure-in-browsers)
18. [Development, packaging & CI](#18-development-packaging--ci)

---

## 1. Suites & tests

```javascript
import { describe, it, expect } from '@sc0ttj/jest-lite';

describe('User Authentication', () => {
  describe('Login Form', () => {
    it('validates email format', () => {
      expect('user@example.com').toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('rejects empty passwords', () => {
      expect('').toBeEmpty();
    });
  });
});
```

- `test(name, fn, timeout)` is a complete alias of `it(name, fn, timeout)`, including every sub-API below (`test.only`, `test.skip`, `test.todo`, `test.each`).
- `describe`/`it`/`test` callbacks may be sync or async; `it`/`test` functions may return a Promise, which is awaited.

### Focus & exclusion: `.only`, `.skip`, `.todo`

```javascript
describe('Feature Suite', () => {
  it.only('focuses exclusively on the critical path', () => {
    expect(true).toBe(true);
  });

  it('is skipped while a sibling .only exists anywhere in the tree', () => {
    expect(1).toBe(2); // never runs, so never fails
  });

  it.skip('explicitly disabled', () => {});

  it.todo('write this test later'); // no implementation function; reported separately as "todo"
});
```

- Before running anything, `run()` scans the **entire** registered suite tree for any `.only`. If one exists anywhere, every test not itself `.only` (or nested inside a `describe.only`) is skipped — this scan-then-run strategy is what the source calls the "two-phase runner".
- `describe.only`/`describe.skip` cascade to every nested `describe`/`it` inside them. A suite whose ancestor is `.skip` never runs its `beforeAll`/`afterAll` hooks, and its tests are all reported as skipped.
- `it.todo(name)` takes no function; it's counted in `stats.todo` and never executes.
- `.only`/`.skip` compose with `.each` (`it.only.each`, `it.skip.each`, `describe.only.each`, `describe.skip.each`) since `test.only`/`test.skip` are literally the same function objects as `it.only`/`it.skip`.

### Per-test timeouts

```javascript
it('settles quickly', async () => {
  await doWork();
}, 200); // fails if the test hasn't settled within 200ms

it('uses the default timeout', async () => {
  await doWork(); // fails after 5000ms (jest-lite's default) if it never settles
});
```

- `it(name, fn, timeout)`/`test(name, fn, timeout)` accept an optional trailing `timeout` in milliseconds, matching Jest. It applies to `.only`, `.skip`, and `.each` (each row shares the same `timeout` argument) as well.
- The default is **5000ms** when `timeout` is omitted.
- `timeout` must be a non-negative finite number; anything else (a string, `NaN`, `Infinity`, a negative number) throws immediately when the test is registered, rather than silently misbehaving at run time.
- Timeout enforcement always uses the real, native timer captured when `jest-lite` loads — **never** the fake-timer clock — so a test that calls `jest.useFakeTimers()` cannot accidentally disable its own timeout by leaving the virtual clock unadvanced.
- A timed-out test is recorded as a normal failure (`phase: 'test'`) whose message names the test and the timeout duration, e.g. `Test "settles quickly" timed out after 200ms. ...`.

---

## 2. Lifecycle hooks

`beforeAll`/`afterAll` run once per `describe` block; `beforeEach`/`afterEach` run around every test and are inherited from every ancestor `describe`, outer-to-inner for `beforeEach`, inner-to-outer for `afterEach`. Each accepts an optional trailing `timeout` in milliseconds: `beforeAll(fn, timeout)`, `afterAll(fn, timeout)`, `beforeEach(fn, timeout)`, `afterEach(fn, timeout)`.

```javascript
describe('Database Operations', () => {
  let db;

  beforeAll(() => { db = { connected: true, queries: 0 }; });
  afterAll(() => { db.connected = false; });

  beforeEach(() => { db.queries = 0; });

  describe('User Records', () => {
    it('creates a user record', () => {
      db.queries++;
      expect(db.connected).toBe(true);
      expect(db.queries).toBe(1);
    });
  });
});

// Hooks may run long-lived setup/teardown; give them more time if needed:
beforeAll(async () => { await connectToSlowService(); }, 10000);
```

**Failure behavior:**
- A hook that throws is recorded as a test failure with `phase` set to `'beforeAll'`, `'beforeEach'`, `'test'`, or `'afterEach'`. Only the *first* failure per test is kept in `stats.failures`, even if multiple hooks throw.
- If a `beforeAll` throws, every test in that `describe` (and all nested `describe`s) is reported as failed with `phase: 'beforeAll'` — but the suite's `afterAll` still runs (cleanup always attempts to run, even after setup failed).
- If a `beforeEach` throws, remaining `beforeEach` hooks and the test body are skipped, but **every** `afterEach` in the chain still runs.
- `expect.assertions(n)`/`expect.hasAssertions()` are checked *after* `afterEach` hooks, so assertions made inside `afterEach` count toward the contract.
- After every test (pass or fail), `jest-lite` automatically restores active spies (`jest.restoreAllMocks()`-equivalent) and reverts fake timers if they were left enabled — see [Mock/spy cleanup semantics](#11-mockspy-cleanup-semantics).

**Hook timeouts:**
- Every hook defaults to the same **5000ms** timeout as tests, overridable via the trailing `timeout` argument shown above.
- A hook that doesn't settle in time is treated exactly like a hook that threw: it's recorded as a failure with the matching `phase` (`'beforeAll'`, `'afterAll'`, `'beforeEach'`, or `'afterEach'`), and the message names the hook and the timeout duration.
- Like test timeouts, hook timeouts are enforced with the real native timer, so `jest.useFakeTimers()` cannot be used (accidentally or otherwise) to disable a hook's own timeout.
- `timeout` is validated the same way as for tests: it must be a non-negative finite number, or registering the hook throws immediately.

---

## 3. Data-driven tests (`.each`)

```javascript
describe('Math Utilities', () => {
  it.each([
    [1, 1, 2],
    [5, 5, 10],
    [10, -2, 8],
  ])('adds %i + %i to equal %i', (a, b, expected) => {
    expect(a + b).toBe(expected);
  });
});

describe('Discount Calculator', () => {
  it.each([
    { tier: 'gold', price: 100, expected: 80 },
    { tier: 'silver', price: 100, expected: 90 },
  ])('applies discount for $tier ($price -> $expected)', ({ tier, price, expected }) => {
    const rate = { gold: 0.2, silver: 0.1 }[tier];
    expect(price * (1 - rate)).toBe(expected);
  });
});

// Tagged-template form:
it.each`
  a    | b    | expected
  ${1} | ${2} | ${3}
  ${4} | ${5} | ${9}
`('$a + $b = $expected', ({ a, b, expected }) => {
  expect(a + b).toBe(expected);
});
```

- Rows may be an array of arrays (spread as positional args), an array of single values/objects (passed as one arg), or a tagged template with a `a | b | expected` header row.
- Title placeholders: `%s`, `%d`/`%i`, `%f`, `%j` (JSON), `%o`/`%p` (pretty-printed), `%#` (row index), `%%` (literal `%`). Object rows also support `$property` (dot paths supported, e.g. `$profile.name`) and `$#` for the index.
- `describe.each(...)` works identically, generating one `describe` block per row.
- `it.each(table)(name, fn, timeout)`/`test.each(table)(name, fn, timeout)` accept the same optional trailing `timeout` as a plain `it`/`test`; it's forwarded to every row generated from the table.

---

## 4. Running tests: `run()`

```javascript
const stats = await run({
  silent: false,       // suppress console reporting (default: false)
  reset: true,         // clear the registered suite tree afterwards (default: true)
  setExitCode: true,   // Node only: process.exitCode = 1 on failure (default: true)
  exitOnFail: false,   // Node only: process.exit(1) on failure (default: false)
  throwOnFail: false,  // throw an aggregated Error (with .stats) on failure (default: false)
});
```

Returns a stats object:

```javascript
{
  pass: 2, fail: 1, skip: 0, todo: 0, total: 3,
  failures: [
    { test: 'Suite > nested > test name', phase: 'test', error: Error, message: 'Expected 5, got 4' },
  ],
}
```

- `phase` is one of `'beforeAll'`, `'beforeEach'`, `'test'`, `'afterEach'`, or `'afterAll'`.
- **Reset behavior:** by default, calling `run()` clears the module-level suite tree afterwards (`reset: true`), so registering new `describe`/`it` calls and calling `run()` again starts fresh. Pass `{ reset: false }` to keep the same tests registered for a second `run()` (useful for testing the runner itself, or re-running with different global flags like `updateSnapshots`). `resetSuites()` and `getRootSuite()` are also exported directly for introspection/manual resets.
- Every top-level `run()` call executes the currently-registered suite tree; you don't pass suites into `run()` yourself in normal usage (the internal `{ suite }` option exists for the runner's own recursion and advanced use).

---

## 5. Writing assertions with `expect`

```javascript
expect(42).toBe(42);
expect(10).not.toBe(20);          // .not inverts any matcher
expect([1, 2, 3]).not.toContain(99);
```

- `.not` inverts matcher **assertion failures only**. If a matcher throws because of misuse (wrong argument type, non-mock value passed to a mock matcher, etc.) that error always propagates — `.not` never hides a bug in your test.
- `.resolves` / `.rejects` await a promise/thenable, then apply any matcher to the resolved value or rejection reason:

```javascript
await expect(Promise.resolve(42)).resolves.toBe(42);
await expect(Promise.reject(new Error('boom'))).rejects.toThrow('boom');
```

  `.resolves` throws if the promise rejects; `.rejects` throws if it resolves. Both require an actual promise/thenable (a non-thenable value throws a usage error).

- **Assertion contracts:**
  - `expect.assertions(n)` — fails the test if exactly `n` matcher calls didn't happen by the end of the test (checked after `afterEach`).
  - `expect.hasAssertions()` — fails the test if zero matcher calls happened.
  - `expect.getState()` — returns `{ assertionCount, expectedAssertions, requiresAssertions, currentTestName, currentSuitePath }`, mainly useful inside custom matchers/debugging.

---

## 6. Core matchers

**Equality & identity**
- `toBe(value)` — `Object.is` identity (correctly distinguishes `NaN`/`NaN` as equal and `0`/`-0` as different).
- `toEqual(value)` — recursive structural equality; ignores `undefined`-valued keys; supports `Date`, `RegExp`, `Error` (by name/message), `Map`, `Set`, circular references, and asymmetric matchers.
- `toStrictEqual(value)` — like `toEqual`, but also requires matching constructors/prototypes and treats `undefined`-valued keys and array sparsity as significant.

**Nullability & booleans**
- `toBeDefined()`, `toBeUndefined()`, `toBeNull()`, `toBeNaN()`, `toBeTruthy()`, `toBeFalsy()`, `toBeEmpty()` (length/size/`Object.keys().length` of 0 — this is a `jest-lite` addition, not part of Jest).

**Numbers**
- `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo(number, precision = 2)`, `toBeWithinRange(floor, ceiling)` *(jest-lite addition)*.

**Strings & collections**
- `toContain(item)` — substring for strings; `.has()` for `Set`; identity (`Object.is`) membership for arrays/array-likes.
- `toContainEqual(item)` — deep-equality membership for arrays, `Set`, or array-likes.
- `toHaveLength(n)` — reads `.length` or `.size`.
- `toMatch(stringOrRegExp)`, `toStartWith(str)`, `toEndWith(str)` *(the last two are jest-lite additions)*.
- `toBeOneOf(array)` *(jest-lite addition)* — deep-equality membership check against a collection.

**Objects & types**
- `toHaveProperty(pathStringOrArray, value?)` — dot-path or array-of-keys lookup, with an optional value comparison.
- `toMatchObject(subset)` — recursive partial match (objects/arrays); extra properties on the received value are ignored, arrays must match length and matching indices.
- `toBeInstanceOf(Ctor)`.
- `toBeType(typeofString)`, `toBeArray()`, `toBeObject()` *(all three are jest-lite additions wrapping `typeof`/`Array.isArray`)*.

**Errors**
- `toThrow(expectedOrNothing)` / `toThrowError` (alias) — calls the received function and asserts it throws. With no argument, just asserts *something* was thrown. Accepts a substring, a `RegExp` (tested against `.message`), an `Error` instance (exact `.message` match), or an Error subclass (`instanceof` check).

**Mock/spy call & return matchers** (all require a `jest.fn()`/`jest.spyOn()` value — see [section 9](#9-mock-functions-jestfn)):
- `toHaveBeenCalled()`, `toHaveBeenCalledTimes(n)`, `toHaveBeenCalledWith(...args)`, `toHaveBeenLastCalledWith(...args)`, `toHaveBeenNthCalledWith(n, ...args)` (1-based).
- `toHaveReturned()`, `toHaveReturnedTimes(n)`, `toHaveReturnedWith(value)`, `toHaveLastReturnedWith(value)`, `toHaveNthReturnedWith(n, value)` (1-based) — all consider only calls that returned normally (a call that threw does not count as "returned").

**Snapshots**
- `toMatchSnapshot(name?)` — see [section 13](#13-snapshot-testing).

---

## 7. Asymmetric matchers

Usable anywhere a value is compared: inside `toEqual`/`toStrictEqual`/`toMatchObject`, or as an argument to `toHaveBeenCalledWith` and friends.

```javascript
expect({ id: 101, username: 'dev_user', createdAt: new Date(), tags: ['js', 'testing'] }).toEqual({
  id: expect.any(Number),
  username: expect.stringMatching(/^dev_/),
  createdAt: expect.anything(),
  tags: expect.arrayContaining(['testing']),
});

expect({ id: 101, extra: 'ignored' }).toEqual(expect.objectContaining({ id: 101 }));
expect(0.30000001).toEqual(expect.closeTo(0.3, 5));
```

- `expect.any(Constructor)` — `typeof`/`instanceof` check; has special handling for `Number`, `String`, `Boolean`, `BigInt`, `Symbol`, `Object`, `Array`, `Function`.
- `expect.anything()` — anything except `null`/`undefined`.
- `expect.stringMatching(stringOrRegExp)`, `expect.stringContaining(substring)`.
- `expect.arrayContaining(items)` — received array must deep-equal-contain every item in `items` (extra items allowed).
- `expect.objectContaining(subset)` — received object must deep-equal every key in `subset` (extra keys allowed).
- `expect.closeTo(number, precision = 2)`.

---

## 8. DOM matchers

Available whenever the received value is a DOM-like element (they use duck-typing/feature detection, not a hard `HTMLElement` dependency, so they also work against DOM shims in Node — see how `jest-lite.test.js` mocks `document`/`HTMLElement`). These are inspired by `@testing-library/jest-dom` but implemented natively with no extra dependency.

```javascript
const button = document.createElement('button');
button.className = 'btn btn-primary';
button.setAttribute('data-testid', 'submit-btn');
document.body.appendChild(button);

expect(button).toExist();
expect(button).toHaveClass('btn-primary');
expect(button).toHaveAttribute('data-testid', 'submit-btn');
expect(button).not.toBeDisabled();
```

- `toExist()` — non-null, and (for array-likes) non-empty.
- `toHaveClass(name)` — uses `classList.contains` when available, else splits `className`.
- `toBeVisible()` — requires `getComputedStyle`; checks `display`/`visibility` plus a non-zero box (`offsetWidth`/`offsetHeight`/`getClientRects()`).
- `toHaveTextContent(stringOrRegExp)`.
- `toBeDisabled()` — reads the `.disabled` property.
- `toHaveAttribute(name, value?)` — requires `hasAttribute`/`getAttribute`.
- `toBeInTheDocument()` — requires a global `document.contains`.
- `toHaveStyle(stylesObject)` — compares each property (camelCase auto-converted to kebab-case) via computed style.
- `toHaveFocus()` — compares against `document.activeElement`.

---

## 9. Mock functions (`jest.fn`)

```javascript
import { fn, expect } from '@sc0ttj/jest-lite';

const mockFn = fn((a, b) => a + b);
mockFn(10, 20);
mockFn(5, 5);

expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(10, 20);
expect(mockFn).toHaveReturnedWith(30);
```

**Mock metadata** (`mockFn.mock`):
- `calls` — array of argument arrays, one per call.
- `results` — array of `{ type: 'return' | 'throw' | 'incomplete', value }` (Jest-shaped). `'incomplete'` only appears transiently while the call is in flight (e.g. inspected recursively from within the implementation itself).
- `instances` — for calls made with `new mockFn()`, the constructed instance (or `this` if the implementation didn't return an object).
- `contexts` — the `this` each call was invoked with.
- `returns` — convenience array of raw returned values (`undefined` for calls that threw); a `jest-lite` legacy/simplified view alongside `results`.
- `lastCall` — getter returning the most recent entry in `calls`.

**Configuring behavior:**
- `mockImplementation(fn)` / `mockImplementationOnce(fn)` (queued, FIFO, consumed before falling back to the default implementation) / `getMockImplementation()`.
- `mockReturnValue(v)` / `mockReturnValueOnce(v)` / `mockReturnThis()`.
- `mockResolvedValue(v)` / `mockResolvedValueOnce(v)` / `mockRejectedValue(e)` / `mockRejectedValueOnce(e)`.
- `mockName(name)` / `getMockName()` — used in printed failure messages (`[MockFunction name]`).
- Constructing with `new` against a mock whose implementation is a `class ...` uses `Reflect.construct` so `instanceof`/fields behave correctly; otherwise the implementation is just called as a plain function preserving the calling `this`.

---

## 10. Spies (`jest.spyOn`)

```javascript
const cart = {
  calculateTotal(price, tax) { return price + price * tax; },
};

const spy = jest.spyOn(cart, 'calculateTotal');
cart.calculateTotal(100, 0.1);

expect(spy).toHaveBeenCalledWith(100, 0.1);
expect(spy).toHaveReturnedWith(110);

spy.mockRestore(); // put the original method back on `cart`
```

- `spyOn(obj, method)` wraps the existing method (`obj[method]` must already be a function; throws a usage error otherwise) while preserving the caller's `this` binding.
- By default the spy calls through to the original implementation; use `mockImplementation`/`mockReturnValue`/etc. (same API as `jest.fn()`) to override behavior.
- `spy.mockRestore()` puts `obj[method]` back exactly as it was (deletes the property if it wasn't originally an own property of `obj`).

---

## 11. Mock/spy cleanup semantics

| Call | Effect |
|---|---|
| `mockFn.mockClear()` | Clears `calls`/`results`/`instances`/`contexts`/`returns`. Implementation(s) untouched. |
| `mockFn.mockReset()` | `mockClear()`, plus drops queued `mockImplementationOnce` calls and resets the default implementation — to `undefined` for a plain `jest.fn()`, or back to a pass-through to the *original* method for a spy. |
| `mockFn.mockRestore()` | `mockReset()`, plus (for spies) restores `obj[method]` and removes the spy from the active-spy registry. On a non-spy `jest.fn()` this behaves the same as `mockReset()`. |
| `jest.clearAllMocks()` | `mockClear()` on every mock/spy ever created, plus every mock function found inside registered mock-registry module exports. |
| `jest.resetAllMocks()` | `mockReset()` on every mock/spy ever created, plus every mock function inside mock-registry module exports. |
| `jest.restoreAllMocks()` | `mockRestore()` on every currently-active spy (spies created via `jest.spyOn`; has no effect on plain `jest.fn()` mocks, which have no "original" to restore to). |

**Automatic per-test cleanup:** after every test (regardless of pass/fail), the runner automatically calls the equivalent of `restoreAllMocks()` and, if fake timers were left enabled, reverts them via `useRealTimers()`. It does **not** automatically call `clearAllMocks()`/`resetAllMocks()` — call those yourself (e.g. in a `beforeEach`) if you want call history cleared between tests.

---

## 12. Fake timers

```javascript
it('fast-forwards a 10s debounce instantly', () => {
  jest.useFakeTimers();

  let executed = false;
  setTimeout(() => { executed = true; }, 10000);
  expect(executed).toBe(false);

  jest.advanceTimersByTime(10000);
  expect(executed).toBe(true);

  jest.useRealTimers();
});
```

- `useFakeTimers()` replaces the global `setTimeout`/`clearTimeout`/`setInterval`/`clearInterval` with a virtual scheduler (a synchronous, sequence-ordered virtual clock starting at `0`).
- `advanceTimersByTime(ms)` — runs every due task in order, advancing the virtual clock to `ms` from now.
- `runAllTimers()` — runs every pending (and newly scheduled-by-callbacks) task until none remain; aborts after 100,000 iterations to guard against infinite `setInterval` loops.
- `runOnlyPendingTimers()` — runs a single snapshot of currently-pending tasks; timers scheduled *by those callbacks* are left pending, not run in the same pass.
- `advanceTimersToNextTimer(steps = 1)` — executes the next `steps` due tasks regardless of elapsed virtual time.
- `clearAllTimers()` — drops all pending tasks (does not affect the virtual clock's current time).
- `getTimerCount()` / `getTimerTime()` — number of pending tasks / current virtual clock time.
- `useRealTimers()` restores the native timer functions; the runner also calls this automatically after every test as a safety net.

**Limitation:** only `setTimeout`/`setInterval`/`clearTimeout`/`clearInterval` are virtualized. `Date.now()`, `new Date()`, `performance.now()`, etc. are **not** mocked or advanced — code that reads wall-clock time directly will still see real time even while fake timers are active.

**Interaction with test/hook timeouts:** a test or hook's own `timeout` (see [Per-test timeouts](#per-test-timeouts) and [Lifecycle hooks](#2-lifecycle-hooks)) is always measured against the real, native timer captured when `jest-lite` loads, never against the virtual clock. This means `jest.useFakeTimers()` never has any effect — good or bad — on how long a test/hook is allowed to run in wall-clock time.

---

## 13. Snapshot testing

```javascript
it('verifies UI configuration snapshot', () => {
  const config = { theme: 'dark', sidebar: true, fontSize: 14 };
  expect(config).toMatchSnapshot('ui_theme_config'); // name is optional
});
```

- **Storage:** in Node, snapshots are persisted as JSON to `./__snapshots__/jest-lite.snap` (relative to `process.cwd()`), keyed by snapshot name. In browsers (or when Node's `fs`/`path` aren't reachable), snapshots go to `localStorage`, falling back to an in-memory cache on `globalThis` if `localStorage` is unavailable.
- **Naming:** if you don't pass a name, the key is generated as `` snap__<suite path joined by " > ">__<test name>__<call index> `` — the call index increments per `toMatchSnapshot()` call within the same test, so multiple snapshots in one test don't collide. Passing an explicit string name overrides this (and is your responsibility to keep unique across the whole run).
- **First run / update mode:** if no snapshot is stored yet for a key, it's written and the assertion passes. To force re-recording of existing snapshots, set `globalThis.updateSnapshots = true` (or `window.updateSnapshots` in a browser) before calling `run()`.
- **Serialization:** values are `JSON.stringify`-d (pretty-printed) with functions rendered as `"[Function name]"`, `undefined` as `"[undefined]"`, circular references as `"[Circular]"`, and anything that can't be serialized at all collapses to `"[Unserializable]"`.
- Snapshot mismatches log an `Expected`/`Received`/`Fix` diff via `console.groupCollapsed` (unless `run({ silent: true })`) and throw a normal assertion failure.

---

## Explicit mock registry (not an import interceptor)

`jest.mock`/`jest.requireMock` (aliases: `registerMock`/`getMock`) provide an **explicit, in-memory lookup table** for fake module exports — think of it as a shared `Map<name, fakeExports>`, not module loader hooking.

```javascript
jest.mock('api-client', () => ({
  fetchUsers: jest.fn().mockResolvedValue([{ id: 1, name: 'Bob' }]),
}));

const apiClient = jest.requireMock('api-client');

it('invokes the mocked module service', async () => {
  const users = await apiClient.fetchUsers();
  expect(users).toEqual([{ id: 1, name: 'Bob' }]);
  expect(apiClient.fetchUsers).toHaveBeenCalled();
});
```

- `jest.mock(name, factory?)` — calls `factory()` once (or stores `{}` if omitted) and registers the result under `name`. It also tries to set a same-named global (`globalScope[name] = fakeExports`) purely as a convenience alias; this silently no-ops if the global is frozen/read-only.
- `jest.requireMock(name)` / `jest.getMock(name)` — retrieves the registered exports (throws a usage error if `name` was never registered).
- `jest.hasMock(name)`, `jest.unmock(name)`, `jest.resetModuleRegistry()`.

**Important limitation:** this registry does **not** hook into ECMAScript module resolution or CommonJS `require`. If your code under test does `import api from './api-client.js'`, it still gets the *real* `api-client.js` — `jest.mock()` has no effect on that `import`. This registry is only useful when:
- your code already accepts the dependency as a parameter/injected value (and you pass `jest.requireMock(...)` into it yourself), or
- your test directly calls `jest.requireMock(name)` and exercises the fake object itself, or
- you rely on the best-effort global alias (`globalScope[name]`) and your code under test reads that global instead of importing the real module.

If you need real import-time interception, you'll need a bundler/loader hook (e.g. Node's `--experimental-loader`) outside of `jest-lite` — this library intentionally does not attempt that.

---

## 15. Custom matchers (`expect.extend`)

```javascript
expect.extend({
  toBeValidUUID(actual) {
    const pass = typeof actual === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actual);
    return {
      pass,
      message: () => pass
        ? `Expected "${actual}" not to be a valid UUID`
        : `Expected "${actual}" to be a valid UUID`,
    };
  },
});

expect('123e4567-e89b-12d3-a456-426614174000').toBeValidUUID();
expect('invalid-id').not.toBeValidUUID();
```

- Matcher functions receive `(actual, ...args)` and must return `{ pass: boolean, message?: () => string }`. Anything else throws a usage error.
- Inside the matcher, `this` provides `{ isNot, equals(a, b, strict?), utils: { printReceived, printExpected, stringify } }` (the three `utils` functions are all the same internal value-printer).
- `.not` support is automatic — you never need to branch on `this.isNot` unless you want a different message.
- `jest.extendExpect` (also exported as `extendExpect`) is the exact same function as `expect.extend`; use whichever reads better.

---

## 16. Async polling (`waitFor`)

```javascript
import { waitFor, expect } from '@sc0ttj/jest-lite';

it('polls until a status banner updates', async () => {
  const banner = document.createElement('div');
  document.body.appendChild(banner);

  setTimeout(() => { banner.textContent = 'Ready'; }, 150);

  await waitFor(() => {
    expect(banner.textContent).toBe('Ready');
  }, { timeout: 500, interval: 20 });
});
```

Repeatedly invokes the callback (may be async) until it doesn't throw, or until `timeout` (default `1000`ms) elapses polling every `interval` (default `50`ms), at which point it throws an `Error` describing the last assertion failure it saw.

---

## Global exposure in browsers

For zero-setup console pasting, importing `jest-lite.js` also assigns a subset of the API onto `globalThis`/`window`:

```javascript
Object.assign(globalScope, {
  jest, describe, it, test, expect, run, waitFor,
  beforeAll, afterAll, beforeEach, afterEach,
});
```

Everything else — `fn`, `spyOn`, `mock`/`requireMock`, fake timer functions, `resetSuites`, `getRootSuite`, `extendExpect`, `AssertionError` — is **not** copied onto the global object directly. Use the `jest.` namespace for those in a console/global context (`jest.fn(...)`, `jest.spyOn(...)`, `jest.useFakeTimers()`, `jest.mock(...)`), or use static/dynamic `import` to destructure them directly, e.g. `const { fn, spyOn } = await import(...)`.

---

## 18. Development, packaging & CI

### Project layout

`jest-lite.js` is the entire library (single file, IIFE + ESM exports). `package.json` declares `"type": "module"` and an `exports` map with only an `"import"` condition — there is no `"require"` condition and no CommonJS build, so `require('@sc0ttj/jest-lite')` will fail (`ERR_PACKAGE_PATH_NOT_EXPORTED`/similar). `"engines": { "node": ">=22" }` documents the minimum supported Node version.

### npm scripts

| Script | What it does |
|---|---|
| `npm test` | Runs `jest-lite.test.js` (the library's own test suite) via Node's native `node --test` runner. |
| `npm run test:coverage` | Same, with `node --test --experimental-test-coverage`. |
| `npm run test:package` | `scripts/package-smoke.mjs` — `npm pack`s the repo, installs the resulting tarball into a scratch project, then imports it as a real consumer would (`import jest, { describe, ... } from '@sc0ttj/jest-lite'`) and runs a small suite through `run()`. Verifies the published package actually works once installed. |
| `npm run test:browser` | `scripts/browser-smoke.mjs` — serves `jest-lite.js` over local HTTP, loads it in headless Chromium via Playwright, runs suites (including a `toMatchSnapshot` write to `localStorage`) via a `<script type="module">`, and asserts on the returned stats. Verifies real browser behavior (not just a Node-simulated DOM). |
| `npm run test:all` | Runs all three of the above in sequence. |

### CI matrix (`.github/workflows/test.yml`)

- **`node` job:** runs `npm test` then `npm run test:package` across a matrix of Node **22.x, 24.x, 26.x**.
- **`coverage` job:** runs `npm run test:coverage` on Node 24.x.
- **`browser` job:** installs Chromium via `npx playwright install --with-deps chromium`, then runs `npm run test:browser` on Node 24.x.

### Running this repo's own tests

`jest-lite.test.js` uses Node's built-in `node:test` (`describe`/`it` from `node:test`, assertions from `node:assert`) as the *outer* harness, and inside that imports and exercises `jest-lite.js`'s own `describe`/`it`/`expect`/`run` as the *system under test* — so the library tests itself with a real, independent test runner rather than being self-hosted. It stubs `window`/`document`/`localStorage`/`HTMLElement` at the top of the file so the DOM matchers and browser snapshot path can be exercised in plain Node.

```bash
git clone https://github.com/sc0ttj/jest-lite.git
cd jest-lite
npm install
npm test
```

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
