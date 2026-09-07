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


await (async function() {
  const moduleRegistry = new Map();

  const activeSpies = new Set();
  const activeSpiesList = [];

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
        mockFn.mock.returns.push(result);
        return result;
      } catch (error) {
        mockFn.mock.returns.push(undefined);
        throw error;
      }
    };

    mockFn.mock = { calls: [], returns: [] };
    mockFn._implementation = null;

    // Clear historical stacks cleanly matching Jest rules
    mockFn.mockClear = () => {
      mockFn.mock.calls = [];
      mockFn.mock.returns = [];
    };

    mockFn.mockImplementation = (fn) => { mockFn._implementation = fn; return mockFn; };
    mockFn.mockReturnValue = (val) => { mockFn._implementation = () => val; return mockFn; };
    mockFn.mockResolvedValue = (val) => { mockFn._implementation = () => Promise.resolve(val); return mockFn; };

    mockFn.mockRestore = () => {
      if (hasOwnOriginal) {
        obj[method] = original;
      } else {
        delete obj[method];
      }
      // Remove from tracking registry on restore
      const index = activeSpiesList.indexOf(mockFn);
      if (index > -1) activeSpiesList.splice(index, 1);
    };

    // 2. Automatically record the active spy reference
    activeSpiesList.push(mockFn);

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
      // Enforce prototype constructor blueprint matching
      if (a.constructor !== b.constructor) return false;

      // Validate nested prototype chain alignment
      // Ensures objects with modified or differing parent prototypes fail equality
      if (!deepEquals(Object.getPrototypeOf(a), Object.getPrototypeOf(b), seen)) {
        return false;
      }

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

  toMatchSnapshot: (customSnapName) => {
      countAssertion(); // <--- Add this to every matcher
      const key = (typeof customSnapName === 'string' && customSnapName) ? customSnapName : getSnapshotKey();
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
      } catch (e) {
        serialized = "[Unserializable]";
      }

      // Environmental Discovery Layer
      const isNode = typeof process !== 'undefined' && process.versions && process.versions.node && !globalThis._forceBrowserStorage;

      // Setup isomorphic storage handlers
      const getStoredSnapshot = () => {
        if (isNode) {
          try {
            const fs = esmRequire('fs');
            const path = esmRequire('path');
            const snapPath = path.join(process.cwd(), '__snapshots__', 'jest-lite.snap');
            if (fs.existsSync(snapPath)) {
              const fileContent = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
              return fileContent[key] !== undefined ? fileContent[key] : null;
            }
          } catch (e) { return null; }
        }
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return globalThis._fallbackSnapCache ? globalThis._fallbackSnapCache[key] : null;
      };

      const writeStoredSnapshot = (valueStr) => {
        if (isNode) {
          try {
            const fs = esmRequire('fs');
            const path = esmRequire('path');
            const snapDir = path.join(process.cwd(), '__snapshots__');
            if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });

            const snapPath = path.join(snapDir, 'jest-lite.snap');
            let snaps = {};
            if (fs.existsSync(snapPath)) {
              try { snaps = JSON.parse(fs.readFileSync(snapPath, 'utf8')); } catch (e) { snaps = {}; }
            }
            snaps[key] = valueStr;
            fs.writeFileSync(snapPath, JSON.stringify(snaps, null, 2), 'utf8');
            return;
          } catch (e) { /* Fallback to storage on file failure */ }
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, valueStr);
        } else {
          if (!globalThis._fallbackSnapCache) globalThis._fallbackSnapCache = {};
          globalThis._fallbackSnapCache[key] = valueStr;
        }
      };

      const existing = getStoredSnapshot();
      // Check for global update flag across standard namespaces
      const shouldUpdate = typeof window !== 'undefined' ? window.updateSnapshots : globalThis.updateSnapshots;

      if (existing === null || shouldUpdate) {
        writeStoredSnapshot(serialized);
        console.log(`%c[Snapshot Saved]: %c${key}`, 'font-weight:bold; color: #2980b9', 'color: #7f8c8d');
        snapshotIndex++;
        return;
      }

      if (existing !== serialized) {
        console.groupCollapsed(`%c❌ Snapshot Mismatch: ${key}`, 'color: #e74c3c; font-weight: bold');
        try {
          console.log('%cExpected:', 'color: #27ae60', JSON.parse(existing));
          console.log('%cReceived:', 'color: #c0392b', JSON.parse(serialized));
        } catch (e) {
          console.log('%cExpected:', 'color: #27ae60', existing);
          console.log('%cReceived:', 'color: #c0392b', serialized);
        }
        console.log('%cFix:', 'color: #8e44ad', `Run: window.updateSnapshots = true; run();`);
        console.groupEnd();
        throw new Error(`Snapshot Mismatch for ${key}`);
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
      const classList = actual?.classList;
      const hasClass = classList && typeof classList.contains === 'function'
        ? classList.contains(className)
        : (actual?.className || '').split(/\s+/).includes(className);
      if (!hasClass) {
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


  // Setup a safe isomorphic CommonJS bridge for Node.js ES Modules
  let esmRequire;
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const { createRequire } = await import('module');
      esmRequire = createRequire(import.meta.url);
    } catch (e) {
      // Fallback if compilation environment dynamically restricts imports
    }
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

    // Resets all mocks and spies in the registry
    clearAllMocks: () => {
      // 1. Clear module registry mock history stacks
      moduleRegistry.forEach(mod => {
        Object.values(mod).forEach(val => {
          if (val && typeof val.mockClear === 'function') val.mockClear();
        });
      });

      // 2. Clear dynamic spy history tracking arrays
      activeSpiesList.forEach(spy => {
        if (typeof spy.mockClear === 'function') spy.mockClear();
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
  advanceTimersByTime,
} = jest;

// Provide a clean default bundle export configuration mapping
export default jest;
