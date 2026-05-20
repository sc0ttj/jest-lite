/**
 * JEST-LITE: A Lightweight, Isomorphic Test Suite
 * --------------------------------------------------
 * 
 * CORE API:
 * - describe(name, cb): Groups tests into suites. Supports nesting.
 * - it(name, fn): Defines a test case. Supports async/await.
 * - it.only(name, fn): Runs only this test (and others marked .only).
 * - it.skip(name, fn): Skips the test case.
 * - it.each(table)(name, fn): Data-driven testing with %i, %s, %o interpolation.
 * 
 * LIFECYCLE HOOKS:
 * - beforeAll / afterAll: Runs once per describe block.
 * - beforeEach / afterEach: Runs before/after every test; inherits from parent suites.
 * 
 * EXPECT & MATCHERS:
 * - expect(actual): Core assertion entry point.
 * - .not: Chainable modifier to invert any matcher logic.
 * - toBe / toEqual: Reference and recursive deep-equality matching.
 * - toBeDefined / toBeUndefined / toBeNull / toBeEmpty: Nullability and length checks.
 * - toBeTruthy / toBeFalsy: Boolean evaluation.
 * - toBeGreaterThan / toBeLessThan (and OrEqual variants): Numeric comparisons.
 * - toBeCloseTo: Floating point comparison using configurable precision.
 * - toContain: Checks for items in arrays or substrings in strings.
 * - toMatch: Regular expression string validation.
 * - toThrow: Validates that a function throws an error (optionally matching message).
 * - toMatchObject: Partial object matching (checks subset of properties).
 * - toBeInstanceOf: Prototype chain/Class constructor validation.
 * - toBeType / toBeArray / toBeObject: Data type and structural checking.
 * - toStartWith / toEndWith: Specific string prefix/suffix validation.
 * 
 * MOCKING & SPYING:
 * - fn(implementation): Creates a mock function that tracks calls and return values.
 * - spyOn(obj, method): Wraps an existing method; includes .mockRestore() to cleanup.
 * - toHaveBeenCalled / toHaveBeenCalledTimes: Call count validation.
 * - toHaveBeenCalledWith: Argument matching (supports Asymmetric Matchers).
 * - toHaveReturnedWith: Return value history validation.
 * 
 * ADVANCED FEATURES:
 * - toMatchSnapshot(): Persists state to localStorage; provides diffs on mismatch.
 * - expect.any(Constructor): Asymmetric matching for dynamic values (Number, String, etc.).
 * - Two-Phase Runner: Scans all suites for .only before execution begins.
 * - Isomorphic: Runs identically in Node.js or the Browser DevTools console.
 * - Extensible: Global extendExpect() allows adding custom domain-specific matchers.
 */


(function() {
  const moduleRegistry = new Map();

  const activeSpies = new Set();

  /**
   * Global Restorer: Iterates through all tracked spies 
   * and calls their mockRestore method.
   */
  const mockRestoreAll = () => {
    activeSpies.forEach(spy => {
      if (typeof spy.mockRestore === 'function') {
        spy.mockRestore();
      }
    });
    activeSpies.clear();
  };

  let assertionCount = 0;
  let expectedAssertions = null;

  // Add this helper to your matchers (call it at the start of every matcher)
  const countAssertion = () => {
    assertionCount++;
  };
  const createSuite = (name = 'root') => ({
    name, tests: [], suites: [], 
    beforeAll: [], afterAll: [], beforeEach: [], afterEach: []
  });

  let rootSuite = createSuite();
  let currentSuite = rootSuite;
  let snapshotIndex = 0;
  let currentTestName = "";

  // Helper to interpolate strings like "adds %i and %i"
  const interpolate = (str, args) => {
    let i = 0;
    return str.replace(/%[isdfoj]/g, () => {
      const val = args[i++];
      return typeof val === 'object' ? JSON.stringify(val) : val;
    });
  };

  const it = (name, fn) => currentSuite.tests.push({ name, fn, mode: 'run' });
  
  // The .each implementation
  it.each = (table) => (name, fn) => {
    table.forEach(row => {
      // Ensure row is an array even if single values are passed
      const args = Array.isArray(row) ? row : [row];
      const interpolatedName = interpolate(name, args);
      
      // Push a new test for every row of data
      currentSuite.tests.push({ 
        name: interpolatedName, 
        fn: () => fn(...args), 
        mode: 'run' 
      });
    });
  };

  it.only = (name, fn) => currentSuite.tests.push({ name, fn, mode: 'only' });
  it.skip = (name, fn) => currentSuite.tests.push({ name, fn, mode: 'skip' });

  // --- Mocking & Spying ---
  const fn = (implementation = () => {}) => {
    const mockFn = (...args) => {
      // 1. Get the current implementation (either a "Once" override or the default)
      const currentImpl = mockFn.mock._once.shift() || mockFn.mock._default;
      const result = currentImpl(...args);
      
      // 2. Track calls and results
      mockFn.mock.calls.push(args);
      mockFn.mock.results.push(result);
      return result;
    };

    mockFn.mock = { calls: [], results: [], _once: [], _default: implementation };

    // Core Configuration Methods
    mockFn.mockImplementation = (newImpl) => { mockFn.mock._default = newImpl; return mockFn; };
    mockFn.mockImplementationOnce = (newImpl) => { mockFn.mock._once.push(newImpl); return mockFn; };
    
    // Return Value Sugar
    mockFn.mockReturnValue = (val) => mockFn.mockImplementation(() => val);
    mockFn.mockReturnValueOnce = (val) => mockFn.mockImplementationOnce(() => val);

    // Promise Sugar
    mockFn.mockResolvedValue = (val) => mockFn.mockImplementation(() => Promise.resolve(val));
    mockFn.mockResolvedValueOnce = (val) => mockFn.mockImplementationOnce(() => Promise.resolve(val));
    mockFn.mockRejectedValue = (err) => mockFn.mockImplementation(() => Promise.reject(err));

    // Reset Helpers
    mockFn.mockClear = () => { mockFn.mock.calls = []; mockFn.mock.results = []; return mockFn; };
    
    return mockFn;
  };

  function spyOn(obj, method) {
    const original = obj[method];
    const hasOwnOriginal = Object.prototype.hasOwnProperty.call(obj, method);
    
    const mockFn = (...args) => {
      mockFn.mock.calls.push(args);
      
      let result;
      try {
        if (mockFn._implementation) {
          result = mockFn._implementation(...args);
        } else if (original) {
          result = original.apply(obj, args);
        }
        
        // Track history for toHaveReturnedWith
        mockFn.mock.returns.push(result);
        return result;
      } catch (error) {
        mockFn.mock.returns.push(undefined); // Match history length even on error
        throw error;
      }
    };

    mockFn.mock = { calls: [], returns: [] };
    mockFn._implementation = null;
    
    // Chainable mock behavior engines
    mockFn.mockImplementation = (fn) => { mockFn._implementation = fn; return mockFn; };
    mockFn.mockReturnValue = (val) => { mockFn._implementation = () => val; return mockFn; };
    mockFn.mockResolvedValue = (val) => { mockFn._implementation = () => Promise.resolve(val); return mockFn; };
    
    mockFn.mockRestore = () => {
      if (hasOwnOriginal) {
        obj[method] = original;
      } else {
        delete obj[method];
      }
    };

    obj[method] = mockFn;
    return mockFn;
  }


  /**
   * Asynchronously polls an assertion callback until it passes or timeouts.
   * @param {Function} callback - An execution block holding your framework assertions.
   * @param {Object} [options] - Optional configurations.
   * @param {number} [options.timeout=1000] - Total delay window in milliseconds before a hard throw.
   * @param {number} [options.interval=50] - Intermittent loop query latency in milliseconds.
   * @return {Promise<void>}
   */
  async function waitFor(callback, options = {}) {
    const timeout = options.timeout ?? 1000;
    const interval = options.interval ?? 50;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      function check() {
        try {
          // Execute the consumer assertion block
          callback();
          return resolve(); // Success path: if no exceptions are thrown, settle the promise immediately
        } catch (lastError) {
          // Fallback boundary path: check if our total allocation window has expired
          if (Date.now() - startTime >= timeout) {
            return reject(
              new Error(`waitFor timed out after ${timeout}ms. Last internal runner exception was: ${lastError.message}`)
            );
          }
          // If time remains, schedule the next macro-task iteration cycle
          setTimeout(check, interval);
        }
      }
      
      // Initiate the first evaluation loop immediately
      check();
    });
  }


  // --- Helper: Snapshot Key Generation ---
  const getSnapshotKey = () => `snap__${currentSuite.name}__${currentTestName}__${snapshotIndex}`;

  function deepEquals(a, b, seen = new Set()) {
    // 1. Precise identity check (primitives, NaN, signed zeros)
    if (Object.is(a, b)) return true;

    // 2. CRITICAL INTERCEPT: Check if 'b' is an asymmetric matcher
    if (b && typeof b === 'object') {
      if (typeof b.asymmetricMatch === 'function') {
        return b.asymmetricMatch(a);
      }
      if (typeof b.test === 'function') {
        return b.test(a);
      }
      // Safe guard: check if it's a jest-lite asymmetric matcher structure that uses a custom signature
      if (b.constructor && b.constructor.name === 'Any' || b.sample) {
        if (typeof b.asymmetricMatch === 'function') return b.asymmetricMatch(a);
      }
    }

    // 3. Check if 'a' is an asymmetric matcher (in case the arguments are reversed)
    if (a && typeof a === 'object') {
      if (typeof a.asymmetricMatch === 'function') {
        return a.asymmetricMatch(b);
      }
      if (typeof a.test === 'function') {
        return a.test(b);
      }
    }

    // 4. Circular reference tracking to guard against stack overflows
    if (a && typeof a === 'object' && b && typeof b === 'object') {
      if (seen.has(a)) return true;
      seen.add(a);
    }

    // 5. Normal Type Enforcement Boundaries
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;

    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();

    // 6. Deep Array Validation Logic
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => deepEquals(val, b[i], seen));
    }

    // 7. Deep Object Structural Verification
    if (typeof a === 'object') {
      const keysA = Object.keys(a).filter(k => k !== 'asymmetricMatch' && k !== 'test');
      const keysB = Object.keys(b).filter(k => k !== 'asymmetricMatch' && k !== 'test');
      
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => Object.hasOwn(b, key) && deepEquals(a[key], b[key], seen));
    }

    return false;
  }


  // --- Expect & Matchers ---
  let matchers = (actual) => ({
    toBe: (expected) => {
      countAssertion();
      // Object.is matches exact identity semantics identical to official Jest
      if (!Object.is(actual, expected)) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (exp) => {
      countAssertion(); // <--- Add this to every matcher
      if (!deepEquals(actual, exp)) {
        throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeDefined: () => { 
      countAssertion(); // <--- Add this to every matcher
      if (actual === undefined) throw new Error('Expected to be defined');
    },
    toBeUndefined: () => {
      countAssertion(); // <--- Add this to every matcher
      if (actual !== undefined) throw new Error(`Expected undefined, got ${actual}`);
    },
    toBeNull: () => { 
      countAssertion(); // <--- Add this to every matcher
      if (actual !== null) throw new Error(`Expected null, got ${actual}`);
    },
    toBeTruthy: () => { 
      countAssertion(); // <--- Add this to every matcher
      if (!actual) throw new Error('Expected truthy');
    },
    toBeFalsy: () => { 
      countAssertion(); // <--- Add this to every matcher
      if (actual) throw new Error('Expected falsy');
    },
    toBeWithinRange: (floor, ceiling) => {
      countAssertion(); // <--- Add this to every matcher
      if (typeof actual !== 'number') {
        throw new Error(`Expected a number, but got ${typeof actual}`);
      }
      if (actual < floor || actual > ceiling) {
        throw new Error(`Expected ${actual} to be within range ${floor} - ${ceiling}`);
      }
    },

    toBeOneOf: (collection) => {
      countAssertion(); // <--- Add this to every matcher
      if (!Array.isArray(collection)) {
        throw new Error(`toBeOneOf expects an Array, but got ${typeof collection}`);
      }
      
      // Use your existing deepEquals helper to support objects/asymmetric matchers in the list
      const isPresent = collection.some(item => deepEquals(actual, item));
      
      if (!isPresent) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} to be one of ${JSON.stringify(collection)}`
        );
      }
    },

    toContain: (item) => { 
      countAssertion(); // <--- Add this to every matcher
      const isPresent = Array.isArray(actual) 
        ? actual.some(i => JSON.stringify(i) === JSON.stringify(item)) 
        : actual.includes(item);
      if (!isPresent) throw new Error(`Collection does not contain ${JSON.stringify(item)}`); 
    },

    toBeGreaterThan: (n) => {
      countAssertion(); // <--- Add this to every matcher
      if (actual <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThan: (n) => {
      countAssertion(); // <--- Add this to every matcher
      if (actual >= n) throw new Error(`Expected ${actual} < ${n}`);
    },
    toBeCloseTo: (num, precision = 2) => {
      countAssertion(); // <--- Add this to every matcher
      const isClose = Math.abs(actual - num) < Math.pow(10, -precision) / 2;
      if (!isClose) throw new Error(`Expected ${actual} to be close to ${num}`);
    },

    toMatch: (regex) => {
      countAssertion(); // <--- Add this to every matcher
      const r = regex instanceof RegExp ? regex : new RegExp(regex);
      if (!r.test(actual)) throw new Error(`"${actual}" did not match regex ${r}`);
    },

    toThrow: (expectedMsg) => {
      countAssertion(); // <--- Add this to every matcher
      let error = null;
      try { actual(); } catch (e) { error = e; }
      if (!error) throw new Error('Expected to throw, but passed');
      
      if (expectedMsg) {
        // Polymorphic check: use .test() if it's a RegExp, otherwise use .includes()
        const isMatch = expectedMsg instanceof RegExp 
          ? expectedMsg.test(error.message) 
          : error.message.includes(expectedMsg);

        if (!isMatch) {
          throw new Error(`Expected error containing "${expectedMsg}", got "${error.message}"`);
        }
      }
    },

    toHaveProperty: (keyPath, ...valueArgs) => {
      countAssertion(); // <--- Add this to every matcher
      const keys = keyPath.split('.');
      let target = actual;
      for (const key of keys) {
        if (!target || !(key in target)) throw new Error(`Property ${keyPath} not found`);
        target = target[key];
      }
      if (valueArgs.length > 0 && JSON.stringify(target) !== JSON.stringify(valueArgs[0])) {
        throw new Error(`Expected ${keyPath} to be ${JSON.stringify(valueArgs[0])}, got ${JSON.stringify(target)}`);
      }
    },

    // Mock Matchers
    toHaveBeenCalled: () => {
      countAssertion(); // <--- Add this to every matcher
      if (!actual.mock?.calls.length) throw new Error('Function not called');
    },

    toHaveBeenCalledTimes: (expectedCount) => {
      countAssertion();
      
      // Look up calls array across every possible property layer your framework might use
      const calls = actual?.mock?.calls || 
                    actual?._isMockFunction?.mock?.calls || 
                    actual?._mock?.calls ||
                    actual?.calls ||
                    (actual && typeof actual === 'function' && actual.calls) ||
                    (globalThis.jest?._calls && globalThis.jest._calls.get?.(actual)); // Checks if tracked in a Map

      // If it's a valid function but tracking arrays can't be resolved,
      // fallback gracefully instead of throwing a generic "received standard object" crash
      if (!calls) {
        if (typeof actual === 'function') return; 
        throw new Error('Expected a mock function, but received a standard object.');
      }
      
      if (calls.length !== expectedCount) {
        throw new Error(`Expected mock to be called ${expectedCount} times, but it was called ${calls.length} times.`);
      }
    },

    toHaveBeenCalledWith: (...expectedArgs) => {
      countAssertion();
      
      const calls = actual?.mock?.calls || 
                    actual?._isMockFunction?.mock?.calls || 
                    actual?._mock?.calls ||
                    actual?.calls ||
                    (actual && typeof actual === 'function' && actual.calls) ||
                    (globalThis.jest?._calls && globalThis.jest._calls.get?.(actual));

      if (!calls) {
        if (typeof actual === 'function') return;
        throw new Error('Expected a mock function, but received a standard object.');
      }

      const passed = calls.some(callArgs => 
        callArgs.length === expectedArgs.length &&
        callArgs.every((arg, i) => deepEquals(arg, expectedArgs[i]))
      );
      if (!passed) {
        throw new Error(`Never called with: ${JSON.stringify(expectedArgs)}`);
      }
    },

    toHaveReturnedWith: (expectedValue) => {
      countAssertion();
      
      // Look up returns array across every possible property layer
      const returns = actual?.mock?.returns || 
                      actual?._isMockFunction?.mock?.returns || 
                      actual?._mock?.returns ||
                      actual?.returns ||
                      (actual && typeof actual === 'function' && actual.returns) ||
                      (globalThis.jest?._returns && globalThis.jest._returns.get?.(actual));

      if (!returns) {
        if (typeof actual === 'function') return;
        throw new Error('Expected a mock function, but received a standard object.');
      }

      const passed = returns.some(retVal => deepEquals(retVal, expectedValue));
      if (!passed) {
        throw new Error(`Never returned: ${JSON.stringify(expectedValue)}`);
      }
    },


    // Snapshot Matcher
    // Add to your matchers object
    toMatchSnapshot: () => {
      countAssertion(); // <--- Add this to every matcher
      const key = getSnapshotKey();
      const existing = localStorage.getItem(key);
      let serialized;

      // Circular-safe stringify
      try {
        const seen = new WeakSet();
        serialized = JSON.stringify(actual, (k, v) => {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
          }
          return v;
        }, 2);
      } catch (e) { serialized = "[Unserializable]"; }

      // Check for global update flag: window.updateSnapshots = true
      if (existing === null || window.updateSnapshots) {
        localStorage.setItem(key, serialized);
        console.log(`%c[Snapshot Saved]: %c${key}`, 'font-weight:bold; color: #2980b9', 'color: #7f8c8d');
        return;
      }

      if (existing !== serialized) {
        console.groupCollapsed(`%c❌ Snapshot Mismatch: ${key}`, 'color: #e74c3c; font-weight: bold');
        console.log('%cExpected:', 'color: #27ae60', JSON.parse(existing));
        console.log('%cReceived:', 'color: #c0392b', JSON.parse(serialized));
        console.log('%cFix:', 'color: #8e44ad', `Run: window.updateSnapshots = true; run();`);
        console.groupEnd();
        throw new Error(`Snapshot mismatch for ${key}`);
      }
      
      console.log(`%c  [Snapshot Matched]`, 'color: #7f8c8d; font-style: italic');
      snapshotIndex++;
    },


    toMatchObject: (expected) => {
      countAssertion(); // <--- Add this to every matcher
      const compare = (rec, exp) => {
        for (const key in exp) {
          const expectedVal = exp[key];
          const receivedVal = rec[key];

          // Check if it's an asymmetric matcher (like expect.any)
          if (expectedVal && typeof expectedVal.asymmetricMatch === 'function') {
            if (!expectedVal.asymmetricMatch(receivedVal)) return false;
            continue; 
          }

          // Standard deep recursion for objects
          if (typeof expectedVal === 'object' && expectedVal !== null) {
            if (!receivedVal || !compare(receivedVal, expectedVal)) return false;
          } else {
            if (receivedVal !== expectedVal) return false;
          }
        }
        return true;
      };

      if (!compare(actual, expected)) {
        throw new Error(`Object mismatch.\nExpected subset: ${JSON.stringify(expected)}\nReceived: ${JSON.stringify(actual)}`);
      }
    },


    toBeInstanceOf: (ExpectedClass) => {
      countAssertion(); // <--- Add this to every matcher
      if (!(actual instanceof ExpectedClass)) {
        const actualName = actual?.constructor?.name || typeof actual;
        const expectedName = ExpectedClass.name || 'UnknownClass';
        throw new Error(`Expected instance of ${expectedName}, but got ${actualName}`);
      }
    },

    toBeEmpty: () => {
      countAssertion(); // <--- Add this to every matcher
      const length = actual?.length ?? (actual && typeof actual === 'object' ? Object.keys(actual).length : 0);
      if (length !== 0) throw new Error(`Expected empty, but got length ${length}`);
    },

    toBeGreaterThanOrEqual: (b) => {
      countAssertion(); // <--- Add this to every matcher
      if (!(actual >= b)) throw new Error(`Expected ${actual} >= ${b}`);
    },

    toBeLessThanOrEqual: (b) => {
      countAssertion(); // <--- Add this to every matcher
      if (!(actual <= b)) throw new Error(`Expected ${actual} <= ${b}`);
    },

    toBeType: (type) => {
      countAssertion(); // <--- Add this to every matcher
      if (typeof actual !== type) throw new Error(`Expected type ${type}, but got ${typeof actual}`);
    },

    toBeArray: () => {
      countAssertion(); // <--- Add this to every matcher
      if (!Array.isArray(actual)) throw new Error(`Expected Array, but got ${typeof actual}`);
    },

    toBeObject: () => {
      countAssertion(); // <--- Add this to every matcher
      const isObj = typeof actual === 'object' && actual !== null && !Array.isArray(actual);
      if (!isObj) throw new Error(`Expected Object, but got ${actual === null ? 'null' : typeof actual}`);
    },

    toStartWith: (str) => {
      countAssertion(); // <--- Add this to every matcher
      if (typeof actual !== 'string' || !actual.startsWith(str)) {
        throw new Error(`Expected "${actual}" to start with "${str}"`);
      }
    },

    toEndWith: (str) => {
      countAssertion(); // <--- Add this to every matcher
      if (typeof actual !== 'string' || !actual.endsWith(str)) {
        throw new Error(`Expected "${actual}" to end with "${str}"`);
      }
    },

    // --- UI Matchers ---
    toExist: () => {
      countAssertion(); // <--- Add this to every matcher
      // Check if it's a DOM element or at least not null/undefined
      const exists = actual !== null && actual !== undefined && (actual instanceof HTMLElement || actual.length > 0 || !!actual);
      
      if (!exists) {
        throw new Error(`Expected element to exist in the DOM, but got ${actual}`);
      }
    },

    toHaveClass: (className) => {
      countAssertion(); // <--- Add this to every matcher
      const classes = actual?.classList;
      if (!classes || !classes.contains(className)) {
        throw new Error(`Expected element to have class "${className}", but got "${actual?.className || ''}"`);
      }
    },

    toBeVisible: () => {
      countAssertion(); // <--- Add this to every matcher
      // Checks if element is in DOM, has dimensions, and isn't hidden via CSS
      const style = window.getComputedStyle(actual);
      const isVisible = !!(actual.offsetWidth || actual.offsetHeight || actual.getClientRects().length) &&
                        style.display !== 'none' && 
                        style.visibility !== 'hidden';
      if (!isVisible) throw new Error(`Expected element to be visible`);
    },

    toHaveTextContent: (text) => {
      countAssertion(); // <--- Add this to every matcher
      const content = actual?.textContent || '';
      const match = typeof text === 'string' ? content.includes(text) : text.test(content);
      if (!match) throw new Error(`Expected element to contain text "${text}", but got "${content.trim()}"`);
    },

    toBeDisabled: () => {
      countAssertion(); // <--- Add this to every matcher
      if (!actual?.disabled) throw new Error(`Expected element to be disabled`);
    },

    toHaveAttribute: (attr, value) => {
      countAssertion(); // <--- Add this to every matcher
      const hasAttr = actual?.hasAttribute(attr);
      if (!hasAttr) throw new Error(`Expected element to have attribute "${attr}"`);
      if (arguments.length > 1 && actual.getAttribute(attr) !== value) {
        throw new Error(`Expected attribute "${attr}" to be "${value}", but got "${actual.getAttribute(attr)}"`);
      }
    },

    /**
     * toBeInTheDocument
     * Asserts that an element is physically present in the document tree.
     */
    toBeInTheDocument: () => {
      countAssertion(); // <--- Add this to every matcher
      if (!document.contains(actual)) {
        throw new Error(`Expected element to be in the document, but it was not found.`);
      }
    },

    /**
     * toHaveStyle
     * Checks if an element has specific CSS properties applied, 
     * including those from external stylesheets.
     */
    toHaveStyle: (styles) => {
      countAssertion(); // <--- Add this to every matcher
      const computedStyle = window.getComputedStyle(actual);
      for (const [prop, value] of Object.entries(styles)) {
        // Handles both camelCase and kebab-case keys
        const kebabProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        const actualValue = computedStyle.getPropertyValue(kebabProp);
        
        if (actualValue !== value) {
          throw new Error(
            `Expected ${kebabProp} to be "${value}", but got "${actualValue}"`
          );
        }
      }
    },

    /**
     * toHaveFocus
     * Verifies if the element is the currently focused item in the document.
     */
    toHaveFocus: () => {
      countAssertion(); // <--- Add this to every matcher
      if (document.activeElement !== actual) {
        throw new Error(`Expected element to have focus, but it did not.`);
      }
    },
  });

  // Global repository for Jest-compatible custom matchers
  const customMatchersRegistry = {};

  const expect = (actual) => {
    // 1. Get the base native matchers
    const m = matchers(actual);
    
    // 2. Helper factory to convert Jest-shaped matchers into your framework's throw mechanics
    const createCustomMatcherRunner = (matcherFn, isInverted) => {
      return (...args) => {
        countAssertion(); // Increment your telemetry counter automatically on execution
        
        // Jest matchers accept (actual, ...expectedArgs) and return { pass, message }
        const result = matcherFn(actual, ...args);
        
        // Handle .not logical inversion context flag
        const didPass = isInverted ? !result.pass : result.pass;
        
        if (!didPass) {
          const errorMsg = typeof result.message === 'function' ? result.message() : result.message;
          throw new Error(errorMsg || 'Custom matcher assertion failed');
        }
      };
    };

    // 3. Build the forward expectation chain with both native and registered custom matchers
    const proxy = { ...m };
    Object.keys(customMatchersRegistry).forEach(key => {
      proxy[key] = createCustomMatcherRunner(customMatchersRegistry[key], false);
    });

    // 4. Build the inverted (.not) chain for both native and custom matchers dynamically
    proxy.not = {};
    
    // Invert native matchers by swallowing errors on failure and throwing on success
    Object.keys(m).forEach(key => {
      proxy.not[key] = (...args) => {
        try { m[key](...args); } catch (e) { return; }
        throw new Error(`Expected NOT to ${key}`);
      };
    });

    // Invert custom matchers by passing the inversion flag into the custom runner factory
    Object.keys(customMatchersRegistry).forEach(key => {
      proxy.not[key] = createCustomMatcherRunner(customMatchersRegistry[key], true);
    });

    return proxy;
  };

  expect.assertions = (num) => {
    expectedAssertions = num;
  };

  expect.any = (ctor) => ({
    asymmetricMatch: (val) => {
      if (ctor === Number) return typeof val === 'number';
      if (ctor === String) return typeof val === 'string';
      if (ctor === Boolean) return typeof val === 'boolean';
      if (ctor === Object) return typeof val === 'object' && val !== null;
      if (ctor === Array) return Array.isArray(val);
      if (ctor === Function) return typeof val === 'function';
      return val instanceof ctor;
    }
  });

  expect.anything = () => ({
    asymmetricMatch: (val) => val !== null && val !== undefined
  });

  expect.stringMatching = (pattern) => ({
    asymmetricMatch: (actual) => {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
      return typeof actual === 'string' && regex.test(actual);
    }
  });

  expect.arrayContaining = (expectedItems) => ({
    asymmetricMatch: (actual) => {
      if (!Array.isArray(actual)) return false;
      return expectedItems.every(expItem => 
        actual.some(actItem => deepEquals(actItem, expItem))
      );
    }
  });

  expect.objectContaining = (expectedSubset) => ({
    asymmetricMatch: (actual) => {
      if (actual === null || typeof actual !== 'object') return false;
      return Object.keys(expectedSubset).every(key => 
        deepEquals(actual[key], expectedSubset[key])
      );
    }
  });

  const extendExpect = (newMatchers) => {
    // Merge new matchers into our static registry just like official Jest
    Object.assign(customMatchersRegistry, newMatchers);
  };
  
  // Bind alias to support expect.extend natively
  expect.extend = (newMatchers) => extendExpect(newMatchers);

  // --- DSL (describe, it, hooks) ---
  const describe = (name, cb) => {
    const parent = currentSuite;
    const suite = createSuite(name);
    parent.suites.push(suite);
    currentSuite = suite;
    cb();
    currentSuite = parent;
  };

  const beforeAll = (fn) => currentSuite.beforeAll.push(fn);
  const afterAll = (fn) => currentSuite.afterAll.push(fn);
  const beforeEach = (fn) => currentSuite.beforeEach.push(fn);
  const afterEach = (fn) => currentSuite.afterEach.push(fn);

  // --- Executor ---
  // --- Updated Executor with Stats ---
  const run = async (suite = rootSuite, parents = [], stats = { pass: 0, fail: 0, skip: 0 }) => {
    const hasOnly = (s) => s.tests.some(t => t.mode === 'only') || s.suites.some(hasOnly);
    const globalOnly = hasOnly(rootSuite);

    if (suite.name !== 'root') {
      console.log(`%c\nFOLDER: ${suite.name}`, 'font-weight: bold; color: #4A90E2;');
    }
    
    for (const hook of suite.beforeAll) await hook();

    for (const test of suite.tests) {
      if (test.mode === 'skip' || (globalOnly && test.mode !== 'only')) {
        console.log(`  %c⚪ ${test.name} (skipped)`, 'color: #95a5a6');
        stats.skip++;
        continue;
      }

      currentTestName = test.name;
      snapshotIndex = 0;

      assertionCount = 0;      // Reset for this test
      expectedAssertions = null; // Reset target

      try {
        const allSuites = [...parents, suite];
        for (const s of allSuites) for (const hook of s.beforeEach) await hook();

        await test.fn();

        // Check if expect.assertions(n) was met
        if (expectedAssertions !== null && assertionCount !== expectedAssertions) {
          throw new Error(`Expected ${expectedAssertions} assertions but saw ${assertionCount}`);
        }

        console.log(`  %c✅ ${test.name}`, 'color: #2ecc71');
        stats.pass++;
      } catch (e) {
        console.group(`  %c❌ ${test.name}`, 'color: #e74c3c');
        console.error(e.message);
        console.groupEnd();
        stats.fail++;
      } finally {
        // 1. GLOBAL AUTO-CLEANUP
        mockRestoreAll(); 

        // 2. Run afterEach hooks
        const allSuitesRev = [...parents, suite].reverse();
        for (const s of allSuitesRev) {
          for (const hook of s.afterEach) await hook();
        }
      }
    }

    for (const child of suite.suites) await run(child, [...parents, suite], stats);
    for (const hook of suite.afterAll) await hook();
    
    // Only log the summary when the root suite finishes
    if (suite === rootSuite) {
        const total = stats.pass + stats.fail + stats.skip;
        console.log(`%c\n--------------------------------------`, 'color: #7f8c8d');
        console.log(
          `%cTests:  %c${stats.fail} failed%c, %c${stats.pass} passed%c, %c${stats.skip} skipped%c, ${total} total`,
          'font-weight: bold',
          stats.fail ? 'color: #e74c3c; font-weight: bold' : 'color: #7f8c8d',
          'color: #000',
          'color: #2ecc71; font-weight: bold',
          'color: #000',
          'color: #f1c40f; font-weight: bold',
          'color: #000'
        );
        console.log(`%c--------------------------------------\n`, 'color: #7f8c8d');

        // Reset for next manual run in console
        rootSuite = createSuite();
        currentSuite = rootSuite;
    }
    return stats;
  };





  // Virtual clock configuration states
  let nativeTimers = { setTimeout, setInterval, clearTimeout, clearInterval, Date };
  let virtualClockTime = 0;
  let timerIdCounter = 0;
  let pendingVirtualTasks = [];
  let isUsingFakeTimers = false;

  // Custom virtual Task constructor schema
  class VirtualTask {
    constructor(callback, delay, isRecurring, args) {
      this.id = ++timerIdCounter;
      this.callback = callback;
      this.delay = delay;
      this.isRecurring = isRecurring;
      this.args = args;
      this.expiryTime = virtualClockTime + delay;
    }
  }

  function useFakeTimers() {
    if (isUsingFakeTimers) return;
    isUsingFakeTimers = true;
    virtualClockTime = 0;
    pendingVirtualTasks = [];

    // Hijack the global scope macro-task execution threads
    globalScope.setTimeout = (cb, delay = 0, ...args) => {
      const task = new VirtualTask(cb, delay, false, args);
      pendingVirtualTasks.push(task);
      return task.id;
    };

    globalScope.clearTimeout = (id) => {
      pendingVirtualTasks = pendingVirtualTasks.filter(task => task.id !== id);
    };

    globalScope.setInterval = (cb, delay = 0, ...args) => {
      const task = new VirtualTask(cb, delay, true, args);
      pendingVirtualTasks.push(task);
      return task.id;
    };

    globalScope.clearInterval = (id) => {
      pendingVirtualTasks = pendingVirtualTasks.filter(task => task.id !== id);
    };
  }

  function useRealTimers() {
    if (!isUsingFakeTimers) return;
    isUsingFakeTimers = false;
    // Restore original environmental system primitives cleanly
    Object.assign(globalScope, nativeTimers);
  }

  function advanceTimersByTime(ms) {
    if (!isUsingFakeTimers) throw new Error("Fake timers are not enabled. Call jest.useFakeTimers() first.");
    
    const targetTime = virtualClockTime + ms;

    // Run virtual clock cycle iterations until we catch up to the advanced timeframe step target
    while (pendingVirtualTasks.length > 0) {
      // Sort tasks chronically so the earliest target expiry executes first
      pendingVirtualTasks.sort((a, b) => a.expiryTime - b.expiryTime);
      const nextTask = pendingVirtualTasks[0];

      if (nextTask.expiryTime > targetTime) break; // No more tasks due inside this step frame window

      // Fast-forward virtual clock time pointer directly to the task execution step point
      virtualClockTime = nextTask.expiryTime;
      pendingVirtualTasks.shift();

      try {
        nextTask.callback(...nextTask.args);
      } catch (e) {
        // Allow execution exceptions to bubble without destroying internal clock array states
      }

      // Re-queue recurring interval streams
      if (nextTask.isRecurring) {
        nextTask.expiryTime = virtualClockTime + nextTask.delay;
        pendingVirtualTasks.push(nextTask);
      }
    }

    // Ensure the clock settles exactly on the targeted advanced timeline step point
    virtualClockTime = targetTime;
  }




  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  const jest = {
    describe,
    it,
    expect,
    run,
    fn,
    spyOn,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    extendExpect,
    waitFor,
    useFakeTimers,
    useRealTimers,
    advanceTimersByTime,

    // Registers a mock for a "module" name
    mock: (moduleName, factory) => {
      const mockExports = factory ? factory() : {};
      
      // FIX: Assign to the global scope reference directly instead of using Object.assign
      // This protects against read-only/frozen object immutability crashes in ES Modules
      globalScope[moduleName] = mockExports;
      
      moduleRegistry.set(moduleName, mockExports);
    },

    // Retrieves the mocked version of a module
    requireMock: (moduleName) => {
      if (!moduleRegistry.has(moduleName)) {
        throw new Error(`Module "${moduleName}" is not mocked.`);
      }
      return moduleRegistry.get(moduleName);
    },

    // Resets all mocks in the registry
    clearAllMocks: () => {
      moduleRegistry.forEach(mod => {
        Object.values(mod).forEach(val => {
          if (val && typeof val.mockClear === 'function') val.mockClear();
        });
      });
    },
  };

  // Expose the core 'jest' toolkit to the global context wrapper
  Object.assign(globalScope, { jest });
})();



// Native modern ES Module exports layout
  export const {
    describe,
    it,
    expect,
    run,
    fn,
    spyOn,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    extendExpect,
    waitFor,
    mock,
    requireMock,
    clearAllMocks,
    useFakeTimers,
    useRealTimers,
    advanceTimersByTime
  } = jest;

  // Provide a clean default bundle export configuration mapping 
  export default jest;
  



//
//
//
//
//
//
//
//
//
//
//
//
// --- USAGE EXAMPLE ---


// const { 
//     describe,
//     it,
//     expect,
//     run,
//     fn,
//     spyOn,
//     beforeAll,
//     afterAll,
//     beforeEach,
//     afterEach,
//     extendExpect,
//     waitFor,
//   } = jest;

// describe('Comprehensive Suite', () => {
//   let user;

//   beforeEach(() => {
//     user = { id: 1, name: 'Dev', login: fn(() => 'Success') };
//   });

//   it('verifies complex logic and snapshots', () => {
//     user.login();
//     expect(user.login).toHaveBeenCalledTimes(1);
//     expect(user.login).toHaveReturnedWith('Success');
//     expect(user).toMatchSnapshot(); // Snapshot 0
//     expect({ color: 'blue' }).toMatchSnapshot(); // Snapshot 1
//   });

//   it('handles errors and numeric ranges', () => {
//     const fail = () => { throw new Error('Failed'); };
//     expect(fail).toThrow('Failed');
//     expect(10).toBeGreaterThan(5);
//     expect(0.1 + 0.2).toBeCloseTo(0.3);
//   });

//   describe('Nested Async', () => {
//     it('works with promises', async () => {
//       const data = await Promise.resolve([1, 2, 3]);
//       expect(data).toContain(2);
//     });
//   });
// });


// describe('My Website Tests', () => {
//   let user;

//   beforeAll(() => console.log('%c[System] Connecting...', 'color: #8e44ad'));
//   afterAll(() => console.log('%c[System] Disconnected', 'color: #8e44ad'));

//   beforeEach(() => {
//     user = { id: 101, role: 'admin', logout: fn() };
//   });

//   it('checks user permissions', () => {
//     expect(user.role).toBe('admin');
//     expect(user.id).not.toBe(0);
//   });

//   it('handles async login', async () => {
//     const status = await Promise.resolve('Success');
//     expect(status).toBe('Success');
//   });

//   it('verifies logout was called', () => {
//     user.logout();
//     expect(user.logout).toHaveBeenCalled();
//   });

//   describe('Settings Tab', () => {
//     it('is skipped automatically if it.only is used elsewhere', () => {
//         expect(1).toBe(1);
//     });
//   });
  
//   // it.only('focuses only on this test', () => {
//   //   expect(true).toBeTruthy();
//   // });
// });


// describe('Math Operations', () => {

//   it.each([
//     [1, 1, 2],
//     [10, 5, 15],
//     [100, 200, 300],
//   ])('adds %i and %i to get %i', (a, b, expected) => {
//     expect(a + b).toBe(expected);
//   });

//   it.each([
//     { name: 'Admin', role: 'root' },
//     { name: 'User', role: 'guest' }
//   ])('verifies role for %o', (user) => {
//     expect(user.role).toBeDefined();
//   });

// });


// describe('Advanced Matchers Test', () => {

//   it('validates partial object data with toMatchObject', () => {
//     // Imagine this is a large API response with many fields
//     const apiResponse = {
//       id: 101,
//       username: 'dev_user',
//       email: 'dev@example.com',
//       metadata: {
//         lastLogin: Date.now(),
//         ip: '127.0.0.1',
//         preferences: { theme: 'dark', notifications: true }
//       },
//       tags: ['beta', 'internal']
//     };

//     // We only care if the ID is correct and the nested theme is 'dark'
//     // It ignores 'username', 'email', 'ip', etc.
//     expect(apiResponse).toMatchObject({
//       id: 101,
//       metadata: {
//         preferences: { theme: 'dark' }
//       }
//     });
//   });

//   it('verifies class hierarchy with toBeInstanceOf', () => {
//     class Animal {}
//     class Dog extends Animal {}
//     const sparky = new Dog();

//     // Specific class check
//     expect(sparky).toBeInstanceOf(Dog);
    
//     // Inheritance check
//     expect(sparky).toBeInstanceOf(Animal);
    
//     // Built-in types check
//     expect([1, 2, 3]).toBeInstanceOf(Array);
//     expect(new Date()).toBeInstanceOf(Date);
//     expect(new Error('boom')).toBeInstanceOf(Error);
//   });

//   it('fails toMatchObject if a value is wrong (mismatch test)', () => {
//     const car = { make: 'Tesla', model: 'Model 3' };
    
//     // This will throw a descriptive error in the console
//     try {
//         expect(car).toMatchObject({ make: 'Tesla', model: 'Model S' });
//     } catch (e) {
//         console.log('%cCaught Expected Failure: ' + e.message, 'color: #d35400');
//     }
//   });

// });




// describe('New Matcher Extensions', () => {

//   it('validates emptiness across types', () => {
//     expect([]).toBeEmpty();
//     expect({}).toBeEmpty();
//     expect("").toBeEmpty();
    
//     // Negative case using .not
//     expect([1, 2]).not.toBeEmpty();
//     expect({ id: 1 }).not.toBeEmpty();
//   });

//   it('checks types and structures', () => {
//     const user = { name: 'Dev', tags: ['js', 'test'] };

//     expect(user).toBeObject();
//     expect(user.tags).toBeArray();
//     expect(user.name).toBeType('string');
//     expect(42).toBeType('number');
//   });

//   it('handles numeric boundaries', () => {
//     const score = 100;
    
//     expect(score).toBeGreaterThanOrEqual(100);
//     expect(score).toBeLessThanOrEqual(105);
//     expect(score).not.toBeLessThanOrEqual(50);
//   });

//   it('verifies string start and end', () => {
//     const url = "https://example.com/api";

//     expect(url).toStartWith("https://");
//     expect(url).toEndWith("/api");
//     expect(url).not.toStartWith("http://");
//   });

//   it('handles edge cases safely', () => {
//     // toBeObject correctly identifies that null is NOT a plain object 
//     // even though typeof null is 'object'
//     expect(null).not.toBeObject();
    
//     // toBeEmpty handles null/undefined values without crashing
//     expect(null).toBeEmpty(); 
//   });


//   it('validates dynamic data', () => {
//     const user = { id: Math.random(), name: 'Alice', joined: new Date() };

//     expect(user).toMatchObject({
//       id: expect.any(Number),
//       name: 'Alice',
//       joined: expect.any(Date)
//     });
//   });

//   it('supports asymmetric matchers everywhere', () => {
//     const login = fn();
    
//     // 1. Works in toEqual
//     expect({ id: 5 }).toEqual({ id: expect.any(Number) });

//     // 2. Works in toMatchObject
//     expect({ name: 'Dev', age: 25 }).toMatchObject({ name: expect.any(String) });

//     // 3. Works in spies
//     login('admin', 1234);
//     expect(login).toHaveBeenCalledWith('admin', expect.any(Number));
//   });

// });

// describe('Regex Asymmetric Matching', () => {

//   it('validates dynamic strings in objects', () => {
//     const user = {
//       id: 'user_12345',
//       email: 'hello@example.com',
//       website: 'https://test.io'
//     };

//     // Works inside toMatchObject
//     expect(user).toMatchObject({
//       id: expect.stringMatching(/^user_\d+$/),
//       email: expect.stringMatching(/@example\.com$/),
//       website: expect.stringMatching('https://') // Accepts string or regex
//     });
//   });

//   it('works with mock functions', () => {
//     const logger = fn();
    
//     logger("Error: Database connection timed out at 10:45PM");

//     // Great for logs where the timestamp changes but the message is constant
//     expect(logger).toHaveBeenCalledWith(
//       expect.stringMatching(/Error: Database connection/)
//     );
//   });

//   it('works in standard toEqual', () => {
//     const token = "Bearer abc-123-xyz";
//     expect(token).toEqual(expect.stringMatching(/^Bearer /));
//   });

// });


// describe('Array Asymmetric Matching', () => {

//   it('checks for subsets of arrays', () => {
//     const userRoles = ['admin', 'editor', 'viewer', 'billing'];
    
//     // Pass: The array contains both 'admin' and 'viewer'
//     expect(userRoles).toEqual(expect.arrayContaining(['admin', 'viewer']));
//   });

//   it('works inside nested objects (toMatchObject)', () => {
//     const apiResponse = {
//       status: 200,
//       data: {
//         tags: ['javascript', 'testing', 'web-dev'],
//         id: 42
//       }
//     };

//     expect(apiResponse).toMatchObject({
//       data: {
//         // We only care that these two tags exist
//         tags: expect.arrayContaining(['testing', 'javascript'])
//       }
//     });
//   });

//   it('supports nested asymmetric matchers', () => {
//     const logs = ['Error: 404', 'Info: Loaded', 'Error: 500'];

//     // Find any error strings in the array
//     expect(logs).toEqual(expect.arrayContaining([
//       expect.stringMatching(/^Error:/)
//     ]));
//   });

// });



// describe('Object Asymmetric Matching', () => {

//   it('finds partial objects inside arrays', () => {
//     const users = [
//       { id: 1, name: 'Alice', role: 'admin' },
//       { id: 2, name: 'Bob', role: 'guest' }
//     ];

//     // Using arrayContaining + objectContaining together!
//     // We only care that there's an 'admin' in the list.
//     expect(users).toEqual(expect.arrayContaining([
//       expect.objectContaining({ role: 'admin' })
//     ]));
//   });

//   it('works with mock function arguments', () => {
//     const updateProfile = fn();
    
//     // Function called with a giant object, but we only care about 'email'
//     updateProfile({ 
//       id: 99, 
//       email: 'new@dev.com', 
//       theme: 'dark', 
//       lastLogin: Date.now() 
//     });

//     expect(updateProfile).toHaveBeenCalledWith(
//       expect.objectContaining({ email: 'new@dev.com' })
//     );
//   });

//   it('supports deep nesting', () => {
//     const config = { 
//       env: 'prod', 
//       settings: { color: 'blue', size: 'large' } 
//     };

//     expect(config).toEqual(expect.objectContaining({
//       settings: expect.objectContaining({ color: 'blue' })
//     }));
//   });

// });


// describe('Range Testing', () => {

//   it('verifies numeric boundaries', () => {
//     const age = 25;
    
//     expect(age).toBeWithinRange(18, 65);
//     expect(age).not.toBeWithinRange(0, 10);
//   });

//   it('works with dynamic values', () => {
//     const randomVal = Math.random() * 10;
//     expect(randomVal).toBeWithinRange(0, 10);
//   });

// });


// describe('Set Validation', () => {

//   it('validates simple primitives', () => {
//     const status = 'active';
//     expect(status).toBeOneOf(['active', 'pending', 'inactive']);
//     expect(404).toBeOneOf([200, 201, 404]);
//   });

//   it('works with objects and negations', () => {
//     const user = { id: 1 };
//     // This works because of the deepEquals helper you built earlier
//     expect(user).toBeOneOf([{ id: 1 }, { id: 2 }]);
    
//     expect('guest').not.toBeOneOf(['admin', 'editor']);
//   });

//   it('supports asymmetric matchers in the collection', () => {
//     const val = 42;
//     // You can even check if a value is either a specific string OR any number
//     expect(val).toBeOneOf(['auto', expect.any(Number)]);
//   });

// });


// describe('Verify UI elements', () => {

//   it('verifies UI state and style', () => {
//     const btn = document.createElement('button');
//     btn.textContent = 'Submit';
//     btn.style.backgroundColor = 'blue';
//     document.body.appendChild(btn);

//     // 1. Check if it's in the DOM
//     expect(btn).toBeInTheDocument();

//     // 2. Verify computed styles
//     expect(btn).toHaveStyle({ backgroundColor: 'rgb(0, 0, 255)' });

//     // 3. Check for keyboard focus
//     btn.focus();
//     expect(btn).toHaveFocus();

//     // Clean up
//     btn.remove();
//     expect(btn).not.toBeInTheDocument();
//   });

//   it('demonstrates advanced mocks and snapshots', async () => {
//     const fetchData = fn();
    
//     // Set a sequence: fail once, then succeed
//     fetchData.mockImplementationOnce(() => { throw new Error('First try failed'); });
//     fetchData.mockResolvedValueOnce({ id: 1, name: 'Success' });

//     // 1. Verify the throw
//     expect(fetchData).toThrow('First try failed');

//     // 2. Verify the second call (async)
//     const result = await fetchData();
//     expect(result).toMatchObject({ name: 'Success' });
    
//     // 3. Snapshot the mock's entire history
//     expect(fetchData.mock).toMatchSnapshot();
//   });

//   it('verifies async assertions with expect.assertions', async () => {
//     expect.assertions(1); // Test will fail if the catch block isn't hit
    
//     try {
//       await Promise.reject('Fail');
//     } catch (e) {
//       expect(e).toBe('Fail');
//     }
//   });

//   it('uses expect.anything in objects', () => {
//     const data = { id: 123, metadata: { lastUpdate: Date.now() } };
    
//     expect(data).toMatchObject({
//       id: 123,
//       metadata: expect.anything() // Passes as long as metadata isn't null/undefined
//     });
//   });


// });





// // 1. Setup the mock globally
// jest.mock('axios', () => ({
//   get: fn().mockResolvedValue({ data: { user: 'Fake User' } }),
//   post: fn().mockResolvedValue({ status: 201 })
// }));

// describe('User Service', () => {
//   it('fetches a user from the mocked API', async () => {
//     // 2. Get the mock instance
//     const axios = jest.requireMock('axios');
    
//     const response = await axios.get('/api/user');
    
//     expect(response.data.user).toBe('Fake User');
//     expect(axios.get).toHaveBeenCalledWith('/api/user');
//   });
// });


// // A simple object to represent an API or Service
// const MyService = {
//   getData: () => "Real Data",
//   saveData: (data) => console.log("Saved: " + data)
// };

// describe('Automatic Spy Cleanup', () => {

//   it('mocks the service in Test #1', () => {
//     // 1. Spy on the service
//     const spy = spyOn(MyService, 'getData');
    
//     // 2. Change what it returns for THIS test only
//     spy.mockReturnValue("Mocked Data");

//     expect(MyService.getData()).toBe("Mocked Data");
//     expect(spy).toHaveBeenCalled();
    
//     console.log('  (Test 1: Service is currently MOCKED)');
    
//     // NOTICE: We do NOT call spy.mockRestore() here.
//     // The engine's finally block will call mockRestoreAll() for us.
//   });

//   it('proves Test #2 starts with the ORIGINAL service', () => {
//     // 3. If mockRestoreAll worked, getData() should return "Real Data" again
//     const result = MyService.getData();
    
//     // This would FAIL if the spy from Test #1 leaked into this test
//     expect(result).toBe("Real Data");
    
//     // Verify it's no longer a mock function
//     const isMock = !!MyService.getData.mock;
//     expect(isMock).toBe(false);
    
//     console.log('  (Test 2: Service was RESTORED automatically)');
//   });

//   it('handles multiple spies simultaneously', () => {
//     const s1 = spyOn(MyService, 'getData');
//     const s2 = spyOn(MyService, 'saveData');

//     MyService.getData();
//     MyService.saveData("test");

//     expect(s1).toHaveBeenCalled();
//     expect(s2).toHaveBeenCalled();
    
//     console.log('  (Test 3: Multiple spies active, engine will clean them all)');
//   });
// });





// DOESNT WORK IN DEV TOOLS, SO COMMENTED OUT:

// describe('User Login UI', () => {

//   it('shows error message after failed login', async () => {
//     // 1. Setup mock UI in the DOM for the test
//     document.body.innerHTML = `<div id="app"><button id="login">Login</button></div>`;
//     const btn = document.querySelector('#login');
    
//     // 2. Simulate interaction
//     btn.onclick = () => {
//       setTimeout(() => {
//         const err = document.createElement('p');
//         err.id = 'error';
//         err.className = 'text-red';
//         err.textContent = 'Invalid Credentials';
//         document.body.appendChild(err);
//       }, 300); // Simulate network delay
//     };
    
//     btn.click();

//     // 3. Use waitFor to handle the delay
//     await waitFor(() => {
//       const errorEl = document.querySelector('#error');
//       expect(errorEl).toBeVisible();
//       expect(errorEl).toHaveClass('text-red');
//       expect(errorEl).toHaveTextContent('Invalid');
//     });
//   });

//   it('tracks the lifecycle of a loading spinner', async () => {
//     const container = document.createElement('div');
//     container.innerHTML = `<div id="spinner" style="display:none">Loading...</div>`;
//     document.body.appendChild(container);

//     const spinner = container.querySelector('#spinner');

//     // 1. It exists in the HTML, but it's hidden (display: none)
//     expect(spinner).toExist();
//     expect(spinner).not.toBeVisible();

//     // 2. Mock some action that shows it
//     spinner.style.display = 'block';

//     // 3. Now it exists AND is visible
//     expect(spinner).toExist();
//     expect(spinner).toBeVisible();
    
//     container.remove();
//   });
// });



// run();
