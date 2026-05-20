# jest-lite

A lightweight, dependency-free, isomorphic test suite matching the core Jest API. It runs identically in Node.js or directly in modern browser Developer Tools.

## Features

- 🚀 **Zero Dependencies:** Pure vanilla ES6 JavaScript package with a tiny footprint.
- 🌍 **Isomorphic Design:** Runs seamlessly across Node.js runtimes or browser environments without modifications.
- 🧪 **Two-Phase Runner Engine:** Scans and executes suite focus chains (`.only`, `.skip`) precisely.
- ⏱️ **Time-Travel Simulation:** Synchronously control virtual clock delays via `useFakeTimers()`.
- 🔄 **Jest-Compatible Extensibility:** Drop in third-party plugins natively using `expect.extend`.
- 📸 **State Snapshot Integration:** Local storage persistence and automatic value state mapping tracking.

---

## Architecture Overview

`jest-lite` exposes its core suite primitives flatly on the global environment context (`window` or `globalThis`) depending on the execution runtime. 

Unlike standard testing runners that pollute global namespaces aggressively upon execution, `jest-lite` wraps its evaluation engines so it can be independently regression-tested using external tools like Node.js's native `--test` module without self-referential environment leaks.

---

## Core API Reference

### 1. Suite Lifecycle & Orchestration
- `describe(name, cb)`: Groups tests into sequential suites. Supports deep nesting out-of-the-box.
- `it(name, fn)`: Definable test case execution vector. Fully supports `async / await`.
- `it.only(name, fn)`: Isolates execution so the framework runs only focused test states.
- `it.skip(name, fn)`: Bypasses designated blocks cleanly during the compilation phase.
- `it.each(table)(name, fn)`: Data-driven matrix testing supporting string, primitive, and object interpolations.

### 2. Lifecycle Hooks
- `beforeAll(cb)` / `afterAll(cb)`: Executes exactly once per current suite context.
- `beforeEach(cb)` / `afterEach(cb)`: Runs sequentially before and after every single test. Supports downward prototype scope inheritance.

### 3. Expectations & Standard Matchers
- `expect(actual)`: Core assertion entry block supporting chainable logic inversion modifiers.
- `.not`: Inverts any subsequent native or custom registered matcher logic seamlessly.
- `toBe(value)`: Exact identity matching utilizing strict `Object.is()` boundaries (handles `NaN` and `-0` correctly).
- `toEqual(value)`: Recursive deep-equality evaluator resilient against infinite graph circular references.
- `toBeDefined()` / `toBeUndefined()` / `toBeNull()` / `toBeEmpty()`: Strict typing structure diagnostics.
- `toBeTruthy()` / `toBeFalsy()`: Truth evaluation.
- `toBeGreaterThan()` / `toBeLessThan()` (including `OrEqual` boundaries): Numeric parameter ranges.
- `toBeCloseTo(value, precision)`: Confined floating-point precision evaluation boundaries.
- `toContain(item)` / `toMatch(pattern)` / `toThrow(error)`: Content, regex and exception trapping evaluation.

### 4. Asymmetric Engine Matchers
- `expect.any(Constructor)`: Generates matching constraints against runtime datatypes (`Number`, `String`, `Date`, etc.).
- `expect.anything()`: Rejects only if properties evaluate strictly to `null` or `undefined`.
- `expect.stringMatching(pattern)`: Matches variable string strings using regular expressions.
- `expect.arrayContaining([items])` / `expect.objectContaining({subset})`: Evaluates complex, nested partial structural tree data validations.

### 5. Mocking & Spying
- `fn(implementation)`: Generates tracking functions recording argument timelines and structural inputs.
- `spyOn(object, method)`: Wraps existing object prototype methods safely, protecting original blueprints upon manual execution of `.mockRestore()`.
- `toHaveBeenCalled()` / `toHaveBeenCalledTimes(count)`: Verifies call counts.
- `toHaveBeenCalledWith(...args)` / `toHaveReturnedWith(val)`: Direct call timeline analysis using deep recursive argument verification.

### 6. Advanced Controls
- `waitFor(callback, options)`: Asynchronous macro-task polling helper loops to test delayed DOM mutations or network states.
- `useFakeTimers()` / `useRealTimers()`: Intercepts environmental clock primitives.
- `advanceTimersByTime(ms)`: Fast-forwards synchronous virtual timers.

---

## Installation & Environment Setup

Clone the repository and install development dependencies (used solely for the native isolation test suite):

```bash
npm install
```

### Script Execution Configuration
The `package.json` specifies `"type": "module"`, enabling standard ES6 `import/export` operations.

To run the complete isolated test framework coverage grid:
```bash
npm test
```

### GitHub Actions CI Workflow
An automated GitHub Action workflow file resides at `.github/workflows/test.yml`. It ensures any submitted pull request automatically compiles and verifies all 50+ rigorous adversarial data validation checks across multiple active Node LTS targets (`20.x`, `22.x`, `24.x`) before merging.

---

## Quickstart & Usage Examples

### 1. Modern Node.js Usage (ES Modules)

Create a test file (e.g., `math.test.js`) and import the isolated primitives from `jest-lite.js`:

```javascript
import { jest, expect } from './jest-lite.js';

const { describe, it } = jest;

// 1. Core Testing and Matchers
describe('Math Operations', () => {
  it('handles basic addition and strict identity anomalies', () => {
    expect(1 + 1).toBe(2);
    expect(NaN).toBe(NaN); // Protected Object.is identity check
  });

  it('handles data-driven tables using it.each', () => {
    it.each([
      [2, 2, 4],
      [5, 5, 10]
    ])('adds %i and %i to get %i', (a, b, expected) => {
      expect(a + b).toBe(expected);
    });
  });
});

// 2. Mocking and Time-Travel Clock Accelerator
describe('Asynchronous Operations', () => {
  it('synchronously fast-forwards extreme delays instantly', () => {
    jest.useFakeTimers();
    let taskRan = false;

    setTimeout(() => {
      taskRan = true;
    }, 5000); // 5 second debounce delay

    jest.advanceTimersByTime(5000);
    expect(taskRan).toBe(true); // Executed instantly without waiting!
    
    jest.useRealTimers(); // Restore system clock
  });
});
```

### 2. Browser DevTools Usage (Zero Setup)

Because `jest-lite` is isomorphic, you can load it directly onto your website's frontend or paste it into your browser's inspect console to run live client-side assertions:

```html
<!-- Load jest-lite as an ES Module in your HTML template -->
<script type="module">
  import { jest, expect } from './jest-lite.js';
  
  const { describe, it, waitFor } = jest;

  describe('UI Interaction Suite', () => {
    it('verifies asynchronous DOM updates safely using polling', async () => {
      const statusBanner = document.createElement('div');
      document.body.appendChild(statusBanner);

      // Simulate a background network poll delay
      setTimeout(() => {
        statusBanner.textContent = 'Connection Secured';
      }, 150);

      // waitFor will dynamically loop until the assertion passes
      await waitFor(() => {
        expect(statusBanner.textContent).toBe('Connection Secured');
      }, { timeout: 300, interval: 20 });

      statusBanner.remove();
    });
  });

  // Execute the internal framework compiler runner loop manually
  jest.run();
</script>
```

### 3. Jest-Compatible Extensions

You can extend `jest-lite` using the familiar `expect.extend` signature to write reusable custom matchers:

```javascript
import { jest, expect } from './jest-lite.js';

expect.extend({
  toBePositiveInteger(actual) {
    const pass = Number.isInteger(actual) && actual > 0;
    return {
      pass,
      message: () => pass 
        ? `Expected ${actual} not to be a positive integer` 
        : `Expected ${actual} to be a positive integer`
    };
  }
});

// Usage supports both normal paths and chainable logical inversions (.not)
describe('Custom Plugins', () => {
  it('evaluates registered extensions seamlessly', () => {
    expect(10).toBePositiveInteger();
    expect(-5).not.toBePositiveInteger();
  });
});
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.
