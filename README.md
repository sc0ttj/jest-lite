# jest-lite

A lightweight, dependency-free, isomorphic test suite matching the core Jest API. It runs identically in Node.js or directly in modern browser Developer Tools.

[![Node.js CI](https://github.com/sc0ttj/jest-lite/actions/workflows/test.yml/badge.svg)](https://github.com/sc0ttj/jest-lite/actions/workflows/test.yml)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Key Features

- 🚀 **Zero Dependencies:** Pure vanilla ES6+ JavaScript package with zero external runtime dependencies.
- 🌍 **Isomorphic Design:** Runs seamlessly across Node.js runtimes, web workers, or browser Developer Tools without build steps.
- 🧪 **Two-Phase Runner Engine:** Scans and executes suite focus chains (`.only`, `.skip`) precisely.
- ⏱️ **Time-Travel Simulation:** Synchronously fast-forward virtual clock delays via `useFakeTimers()`.
- 📸 **Snapshot Testing:** Isomorphic state persistence (disk files in Node, `localStorage` in browser).
- 🔄 **Jest API Compatibility:** Drop-in compatibility for `describe`, `it`, `expect`, `jest.fn`, `jest.spyOn`, `expect.extend`, and DOM matchers.

---

## Quickstart (1-Minute Setup)

### Option A: Modern Node.js (ES Modules)

Create a test file `math.test.js`:

```javascript
import { jest, expect, describe, it } = await import('./jest-lite.js');

describe('Calculator', () => {
  it('adds numbers correctly', () => {
    expect(2 + 3).toBe(5);
  });

  it('handles object equality', () => {
    expect({ user: 'Alice' }).toEqual({ user: 'Alice' });
  });
});

// Run all suites and print results to the console
jest.run();
```

Run with Node.js:
```bash
node math.test.js
```

### Option B: Browser DevTools Console (Zero Setup)

Open your browser's Developer Tools Console on any webpage and paste:

```javascript
import('https://cdn.jsdelivr.net/gh/sc0ttj/jest-lite/jest-lite.js').then(({ jest, expect }) => {
  const { describe, it } = jest;

  describe('UI Live Check', () => {
    it('verifies document title', () => {
      expect(document.title).not.toBe('');
    });
  });

  jest.run();
});
```

---

## Table of Contents

1. [Suite Structure & Test Organization](#1-suite-structure--test-organization)
2. [Data-Driven Matrix Testing (`it.each`)](#2-data-driven-matrix-testing-iteach)
3. [Lifecycle Hooks & Scope Chain](#3-lifecycle-hooks--scope-chain)
4. [Standard Expectations & Matchers](#4-standard-expectations--matchers)
5. [Asymmetric Engine Matchers](#5-asymmetric-engine-matchers)
6. [UI & DOM Element Matchers](#6-ui--dom-element-matchers)
7. [Mock Functions (`jest.fn`)](#7-mock-functions-jestfn)
8. [Spying & Automatic Cleanup (`jest.spyOn`)](#8-spying--automatic-cleanup-jestspyon)
9. [Asynchronous Testing & Polling (`waitFor`)](#9-asynchronous-testing--polling-waitfor)
10. [Fake Timers & Time Travel](#10-fake-timers--time-travel)
11. [Isomorphic State Snapshots](#11-isomorphic-state-snapshots)
12. [Extending Matchers (`expect.extend`)](#12-extending-matchers-expectextend)
13. [Module System Emulation](#13-module-system-emulation)
14. [Installation & Running Tests](#14-installation--running-tests)

---

## 1. Suite Structure & Test Organization

Group tests into logical suites using `describe`, and write individual assertions using `it`.

```javascript
import { jest, expect } from './jest-lite.js';
const { describe, it } = jest;

describe('User Authentication', () => {
  describe('Login Form', () => {
    it('validates email format', () => {
      const email = 'user@example.com';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('rejects empty passwords', () => {
      const password = '';
      expect(password).toBeEmpty();
    });
  });
});
```

### Isolation & Focus Chains (`.only` and `.skip`)

The two-phase runner engine automatically isolates tests marked with `.only`, ignoring all un-focused tests across the entire suite tree.

```javascript
describe('Feature Suite', () => {
  // Only this test will run
  it.only('focuses exclusively on critical path', () => {
    expect(true).toBe(true);
  });

  // This test will be skipped
  it('is ignored during focused runs', () => {
    expect(1).toBe(2); // Will not throw because it is skipped!
  });

  // Explicitly skipped test
  it.skip('temporarily disabled feature test', () => {
    expect(false).toBe(true);
  });
});
```

---

## 2. Data-Driven Matrix Testing (`it.each`)

Test multiple input/output variations concisely without code repetition using `it.each`.

### Array Matrix Form
Use placeholders like `%i` (integer), `%s` (string), `%o` (object), or `%f` (float) in the test title:

```javascript
describe('Math Utilities', () => {
  it.each([
    [1, 1, 2],
    [5, 5, 10],
    [10, -2, 8]
  ])('adds %i + %i to equal %i', (a, b, expected) => {
    expect(a + b).toBe(expected);
  });
});
```

### Object Parameter Form

```javascript
describe('Discount Calculator', () => {
  it.each([
    { tier: 'gold', price: 100, expected: 80 },
    { tier: 'silver', price: 100, expected: 90 },
    { tier: 'bronze', price: 100, expected: 95 }
  ])('applies discount for %o', ({ tier, price, expected }) => {
    const discountMap = { gold: 0.20, silver: 0.10, bronze: 0.05 };
    const finalPrice = price * (1 - discountMap[tier]);
    expect(finalPrice).toBe(expected);
  });
});
```

---

## 3. Lifecycle Hooks & Scope Chain

Manage setup and teardown routines using `beforeAll`, `beforeEach`, `afterEach`, and `afterAll`. Parent hooks automatically inherit downward into nested `describe` blocks.

```javascript
describe('Database Operations', () => {
  let dbConnection;
  const logs = [];

  beforeAll(() => {
    dbConnection = { status: 'connected', queries: 0 };
  });

  afterAll(() => {
    dbConnection.status = 'disconnected';
  });

  beforeEach(() => {
    logs.length = 0; // Clear logs before every test
  });

  describe('User Records', () => {
    beforeEach(() => {
      logs.push('record_setup');
    });

    it('creates a user record', () => {
      dbConnection.queries++;
      expect(dbConnection.status).toBe('connected');
      expect(logs).toEqual(['record_setup']);
    });
  });
});
```

---

## 4. Standard Expectations & Matchers

### Identity & Equality

- `toBe(value)`: Strict identity matching using `Object.is()` (handles `NaN` and `-0` accurately).
- `toEqual(value)`: Recursive deep-equality checking resilient against circular references.

```javascript
expect(42).toBe(42);
expect(NaN).toBe(NaN); // Object.is identity check
expect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });
```

### Logical Inversion (`.not`)

Chain `.not` before any matcher to invert its evaluation logic.

```javascript
expect(10).not.toBe(20);
expect([1, 2, 3]).not.toContain(99);
```

### Nullability & Truthiness

```javascript
expect(undefined).toBeUndefined();
expect('hello').toBeDefined();
expect(null).toBeNull();
expect('active').toBeTruthy();
expect(0).toBeFalsy();
```

### Numbers & Numeric Ranges

```javascript
expect(15).toBeGreaterThan(10);
expect(15).toBeGreaterThanOrEqual(15);
expect(5).toBeLessThan(20);
expect(5).toBeLessThanOrEqual(5);
expect(7).toBeWithinRange(1, 10);
expect(0.1 + 0.2).toBeCloseTo(0.3, 2); // Handles floating-point precision
```

### Strings, Regex & Collections

```javascript
expect('JavaScript').toContain('Script');
expect(['apple', 'banana']).toContain('apple');
expect('apple').toBeOneOf(['apple', 'banana', 'cherry']);
expect('ORDER-12345').toMatch(/^ORDER-\d+$/);
expect('hello world').toStartWith('hello');
expect('hello world').toEndWith('world');
expect([]).toBeEmpty();
expect({}).toBeEmpty();
```

### Types & Instance Checking

```javascript
expect('text').toBeType('string');
expect([1, 2]).toBeArray();
expect({ key: 'val' }).toBeObject();
expect(new Date()).toBeInstanceOf(Date);
```

### Object Structure & Properties

```javascript
const user = { profile: { name: 'Alex', age: 30 } };

expect(user).toHaveProperty('profile.name', 'Alex');
expect(user).toMatchObject({ profile: { name: 'Alex' } });
```

### Exception Trapping (`toThrow`)

```javascript
const throwError = () => {
  throw new TypeError('Invalid database configuration');
};

expect(throwError).toThrow();
expect(throwError).toThrow('Invalid database');
expect(throwError).toThrow(/configuration/);
```

---

## 5. Asymmetric Engine Matchers

Use asymmetric matchers inside `toEqual` or `toHaveBeenCalledWith` when matching dynamic or partial structure data.

```javascript
const response = {
  id: 101,
  username: 'dev_user',
  createdAt: new Date(),
  tags: ['javascript', 'testing']
};

expect(response).toEqual({
  id: expect.any(Number),
  username: expect.stringMatching(/^dev_/),
  createdAt: expect.anything(),
  tags: expect.arrayContaining(['testing'])
});

expect(response).toEqual(
  expect.objectContaining({ id: 101 })
);
```

---

## 6. UI & DOM Element Matchers

`jest-lite` includes built-in matchers for testing DOM elements directly in the browser or mock DOM environments (like JSDOM/HappyDOM).

```javascript
// Create a sample DOM node
const button = document.createElement('button');
button.className = 'btn btn-primary';
button.textContent = 'Submit Form';
button.setAttribute('data-testid', 'submit-btn');
document.body.appendChild(button);

expect(button).toBeInTheDocument();
expect(button).toExist();
expect(button).toHaveClass('btn-primary');
expect(button).toHaveTextContent('Submit');
expect(button).toHaveAttribute('data-testid', 'submit-btn');
expect(button).not.toBeDisabled();

button.remove();
```

Available UI Matchers:
- `toBeInTheDocument()`: Verifies element is attached to `document`.
- `toExist()`: Checks element is non-null.
- `toHaveClass(className)`: Validates class names.
- `toBeVisible()`: Checks layout dimensions and computed visibility (`display !== 'none'`).
- `toHaveTextContent(textOrRegex)`: Asserts text content.
- `toBeDisabled()`: Verifies `disabled` property.
- `toHaveAttribute(attr, expectedValue?)`: Checks element attributes.
- `toHaveStyle(stylesObject)`: Validates computed CSS properties.
- `toHaveFocus()`: Checks if element is `document.activeElement`.

---

## 7. Mock Functions (`jest.fn`)

Create tracked mock functions to monitor calls, inspect arguments, and control return values.

### Basic Mocking & Inspection

```javascript
import { jest, expect } from './jest-lite.js';

const mockFn = jest.fn((a, b) => a + b);

mockFn(10, 20);
mockFn(5, 5);

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(10, 20);
expect(mockFn).toHaveReturnedWith(30);

// Inspect call history arrays directly
expect(mockFn.mock.calls).toEqual([[10, 20], [5, 5]]);
expect(mockFn.mock.results).toEqual([30, 10]);
```

### Overriding Implementations & Return Values

```javascript
const mockFetch = jest.fn();

// Return values sequentially
mockFetch
  .mockReturnValueOnce({ status: 200, data: 'first' })
  .mockReturnValueOnce({ status: 500, data: 'error' })
  .mockReturnValue({ status: 200, data: 'default' });

expect(mockFetch()).toEqual({ status: 200, data: 'first' });
expect(mockFetch()).toEqual({ status: 500, data: 'error' });
expect(mockFetch()).toEqual({ status: 200, data: 'default' });

// Promise helpers
const asyncMock = jest.fn().mockResolvedValue({ success: true });
const result = await asyncMock();
expect(result).toEqual({ success: true });
```

---

## 8. Spying & Automatic Cleanup (`jest.spyOn`)

Wrap object methods with `jest.spyOn` to intercept calls while preserving or overriding original implementations.

```javascript
const cart = {
  calculateTotal(price, tax) {
    return price + (price * tax);
  }
};

// Wrap method with spy
const spy = jest.spyOn(cart, 'calculateTotal');

cart.calculateTotal(100, 0.1);

expect(spy).toHaveBeenCalledWith(100, 0.1);
expect(spy).toHaveReturnedWith(110);

// Restore original implementation manually
spy.mockRestore();
```

> 💡 **Automatic Cleanup:** When executing suites via `jest.run()`, `jest-lite` automatically invokes `mockRestore()` on all active spies after every test, preventing cross-test state leaks.

---

## 9. Asynchronous Testing & Polling (`waitFor`)

### Standard `async / await`

```javascript
it('fetches remote user data asynchronously', async () => {
  const fetchUser = async (id) => ({ id, name: 'Alice' });
  
  const user = await fetchUser(42);
  expect(user.name).toBe('Alice');
});
```

### Asynchronous Event Polling (`waitFor`)

Use `waitFor` to repeatedly poll an assertion block until it passes or hits a timeout limit (useful for DOM mutations, CSS transitions, or async state changes).

```javascript
import { jest, expect } from './jest-lite.js';
const { it, waitFor } = jest;

it('polls until DOM status banner updates', async () => {
  const banner = document.createElement('div');
  document.body.appendChild(banner);

  // Simulate background network response delay
  setTimeout(() => {
    banner.textContent = 'Ready';
  }, 150);

  // Polls callback every 20ms until assertion passes (or times out after 500ms)
  await waitFor(() => {
    expect(banner.textContent).toBe('Ready');
  }, { timeout: 500, interval: 20 });

  banner.remove();
});
```

---

## 10. Fake Timers & Time Travel

Synchronously fast-forward virtual clock time to test debounced functions, intervals, or long timeouts instantly without waiting.

```javascript
import { jest, expect } from './jest-lite.js';
const { it, useFakeTimers, advanceTimersByTime, useRealTimers } = jest;

it('fast-forwards a 10-second debounce delay instantly', () => {
  useFakeTimers();

  let executed = false;
  setTimeout(() => {
    executed = true;
  }, 10000); // 10 second delay

  expect(executed).toBe(false);

  // Fast-forward virtual clock by 10,000ms
  advanceTimersByTime(10000);

  expect(executed).toBe(true);

  // Restore native clock
  useRealTimers();
});
```

---

## 11. Isomorphic State Snapshots

Save and verify object state snapshots. Snapshots automatically persist to `./__snapshots__/jest-lite.snap` in Node.js or `localStorage` in browser contexts.

```javascript
it('verifies UI configuration snapshot', () => {
  const config = {
    theme: 'dark',
    sidebar: true,
    fontSize: 14
  };

  // Saves snapshot on first run, compares on subsequent runs
  expect(config).toMatchSnapshot('ui_theme_config');
});
```

### Updating Snapshots

When state intentionally changes, update snapshots by setting the global flag before calling `jest.run()`:

```javascript
// Node.js or Browser Console
globalThis.updateSnapshots = true;
jest.run();
```

---

## 12. Extending Matchers (`expect.extend`)

Register custom domain-specific matchers using `expect.extend`. Custom matchers support logical inversion via `.not` automatically.

```javascript
import { jest, expect } from './jest-lite.js';

// Register custom matcher plugin
expect.extend({
  toBeValidUUID(actual) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = typeof actual === 'string' && uuidRegex.test(actual);

    return {
      pass,
      message: () => pass
        ? `Expected "${actual}" not to be a valid UUID`
        : `Expected "${actual}" to be a valid UUID`
    };
  }
});

// Usage
it('validates UUID formatted strings', () => {
  expect('123e4567-e89b-12d3-a456-426614174000').toBeValidUUID();
  expect('invalid-id').not.toBeValidUUID();
});
```

---

## 13. Module System Emulation

Mock module export contracts inside `jest-lite`'s internal module registry.

```javascript
import { jest, expect } from './jest-lite.js';

// Register module mock
jest.mock('api-client', () => ({
  fetchUsers: jest.fn().mockResolvedValue([{ id: 1, name: 'Bob' }])
}));

// Retrieve mock export
const apiClient = jest.requireMock('api-client');

it('invokes mocked module service', async () => {
  const users = await apiClient.fetchUsers();
  expect(users).toEqual([{ id: 1, name: 'Bob' }]);
  expect(apiClient.fetchUsers).toHaveBeenCalled();
});

// Reset call history across mocks
jest.clearAllMocks();
```

---

## 14. Installation & Running Tests

### Development Setup

Clone the repository and install development dependencies:

```bash
git clone https://github.com/sc0ttj/jest-lite.git
cd jest-lite
npm install
```

### Executing the Framework Test Suite

`jest-lite` verifies its own framework engine using Node.js's native test runner (`node:test`):

```bash
npm test
```

### Automated CI/CD

An automated GitHub Actions workflow (`.github/workflows/test.yml`) validates all 80+ test cases across active Node LTS versions (`20.x`, `22.x`, `24.x`) on every push or pull request.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

