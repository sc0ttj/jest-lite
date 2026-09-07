/**
 * JEST-LITE: A Lightweight, Isomorphic Test Suite
 * --------------------------------------------------
 *
 * CORE API:
 * - describe(name, cb): Groups tests into suites. Supports nesting.
 * - describe.only / describe.skip / describe.each: Suite level focus, exclusion and data tables.
 *   Suite modes cascade down to every descendant suite and test.
 * - it(name, fn, timeout) / test(name, fn, timeout): Defines a test case. Supports
 *   async/await. Optional `timeout` (ms, default 5000) fails the test if it does not
 *   settle in time; enforced with a real timer so fake timers can never disable it.
 * - it.only / it.skip / it.todo / it.each (and the identical `test.*` aliases) all
 *   accept the same trailing `timeout` argument (`.each` forwards it per-row).
 * - it.each(table)(name, fn, timeout): Data-driven testing. Accepts an array table
 *   (rows of arrays, or rows of single values/objects) or a tagged template literal.
 *   Names interpolate %s, %i, %d, %f, %j, %o, %p, %# and $property tokens.
 *
 * LIFECYCLE HOOKS:
 * - beforeAll(fn, timeout) / afterAll(fn, timeout): Runs once per describe block.
 * - beforeEach(fn, timeout) / afterEach(fn, timeout): Runs before/after every test;
 *   inherits from parent suites.
 * - Each hook accepts the same optional `timeout` (ms, default 5000) as tests.
 * - Hook failures are reported as test failures; execution continues where sensible.
 *
 * EXPECT & MATCHERS:
 * - expect(actual): Core assertion entry point.
 * - .not: Chainable modifier to invert any matcher logic. Only assertion failures are
 *   inverted; matcher misuse (TypeError etc.) always propagates.
 * - .resolves / .rejects: Await a promise then apply any matcher to its value/reason.
 * - toBe / toEqual / toStrictEqual: Identity, structural and strict structural equality.
 * - toBeDefined / toBeUndefined / toBeNull / toBeEmpty: Nullability and length checks.
 * - toBeTruthy / toBeFalsy: Boolean evaluation.
 * - toBeGreaterThan / toBeLessThan (and OrEqual variants): Numeric comparisons.
 * - toBeCloseTo: Floating point comparison using configurable precision.
 * - toContain / toContainEqual: Identity or deep-equality collection membership.
 * - toHaveLength: Length/size assertions for strings, arrays, Map/Set and array-likes.
 * - toMatch: String/RegExp validation.
 * - toThrow: Validates a thrown error against a string, RegExp, Error class or instance.
 * - toMatchObject: Partial object matching (checks subset of properties).
 * - toBeInstanceOf / toBeType / toBeArray / toBeObject: Type and structure checking.
 * - toStartWith / toEndWith: Specific string prefix/suffix validation.
 * - expect.assertions(n) / expect.hasAssertions(): Assertion count contracts.
 *
 * MOCKING & SPYING:
 * - jest.fn(implementation): Mock function tracking calls, contexts, instances and
 *   Jest-shaped results (`{ type: 'return' | 'throw' | 'incomplete', value }`).
 * - jest.spyOn(obj, method): Wraps an existing method; `.mockRestore()` reverts it.
 * - jest.clearAllMocks / resetAllMocks / restoreAllMocks: Registry wide cleanup.
 * - toHaveBeenCalled / toHaveBeenCalledTimes / toHaveBeenCalledWith /
 *   toHaveBeenLastCalledWith / toHaveBeenNthCalledWith.
 * - toHaveReturned / toHaveReturnedTimes / toHaveReturnedWith /
 *   toHaveLastReturnedWith / toHaveNthReturnedWith.
 *
 * ADVANCED FEATURES:
 * - toMatchSnapshot(): Persists state to disk (Node) or localStorage (browser).
 *   Default keys are namespaced by the full suite path plus test name.
 * - Asymmetric matchers: expect.any, expect.anything, expect.stringMatching,
 *   expect.stringContaining, expect.arrayContaining, expect.objectContaining.
 * - Fake timers: useFakeTimers / advanceTimersByTime / runAllTimers /
 *   runOnlyPendingTimers / advanceTimersToNextTimer / clearAllTimers / getTimerCount.
 * - Module registry: jest.mock/registerMock and jest.requireMock/getMock provide an
 *   explicit in-memory registry. NOTE: this is a registry, NOT an import interceptor:
 *   real `import`/`require` statements are never rewritten.
 * - Two-Phase Runner: Scans all suites for `.only` before execution begins.
 * - Isomorphic: Runs identically in Node.js or the Browser DevTools console.
 * - Extensible: expect.extend()/extendExpect() allows adding custom matchers.
 */


await (async function () {
  const globalScope = (typeof globalThis !== 'undefined')
    ? globalThis
    : (typeof window !== 'undefined' ? window : this);

  // Captured immediately, before anything (including jest.useFakeTimers()) can ever
  // monkey-patch globalScope.setTimeout/clearTimeout. Per-test/hook timeout enforcement
  // always schedules against these, so fake timers can never disable a test's own timeout.
  const REAL_SET_TIMEOUT = globalScope.setTimeout.bind(globalScope);
  const REAL_CLEAR_TIMEOUT = globalScope.clearTimeout.bind(globalScope);

  const isNodeRuntime = typeof process !== 'undefined'
    && !!process.versions
    && !!process.versions.node;

  // Safe isomorphic CommonJS bridge (Node only, loaded dynamically so browsers never see it).
  let esmRequire = null;
  if (isNodeRuntime) {
    try {
      const { createRequire } = await import('module');
      esmRequire = createRequire(import.meta.url);
    } catch (e) {
      esmRequire = null;
    }
  }

  // ==========================================================================
  // 1. ERROR CONTRACTS
  // ==========================================================================

  /**
   * Thrown by every built-in and custom matcher when an expectation fails.
   * `.not` only inverts errors carrying this contract, so genuine matcher bugs
   * (TypeError, ReferenceError, misuse errors, ...) are never silently swallowed.
   */
  class JestLiteAssertionError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = 'JestLiteAssertionError';
      this.isJestLiteAssertionError = true;
      this.matcherName = details.matcherName;
      this.actual = details.actual;
      this.expected = details.expected;
    }
  }

  const assertionError = (message, details) => new JestLiteAssertionError(message, details);
  const isAssertionError = (error) => !!error && error.isJestLiteAssertionError === true;

  /** Misuse of the framework itself (wrong argument types, non-mock received, ...). */
  const usageError = (message) => new TypeError(`[jest-lite] ${message}`);

  // ==========================================================================
  // 2. VALUE FORMATTING
  // ==========================================================================

  const MAX_PRINT_LENGTH = 400;

  const printValue = (value, seen = new WeakSet()) => {
    if (value === null) return 'null';
    const type = typeof value;
    if (type === 'undefined') return 'undefined';
    if (type === 'number' || type === 'boolean') return String(value);
    if (type === 'bigint') return `${value}n`;
    if (type === 'symbol') return value.toString();
    if (type === 'string') return JSON.stringify(value);
    if (type === 'function') {
      if (value._isMockFunction) return `[MockFunction ${value.getMockName()}]`;
      return `[Function ${value.name || 'anonymous'}]`;
    }
    if (isAsymmetricMatcher(value)) return String(value);
    if (value instanceof Error) return `[${value.name}: ${value.message}]`;
    if (value instanceof Date) return `Date(${isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()})`;
    if (value instanceof RegExp) return value.toString();
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        return `[${value.map(item => printValue(item, seen)).join(', ')}]`;
      }
      if (typeof Set !== 'undefined' && value instanceof Set) {
        return `Set {${[...value].map(item => printValue(item, seen)).join(', ')}}`;
      }
      if (typeof Map !== 'undefined' && value instanceof Map) {
        return `Map {${[...value].map(([k, v]) => `${printValue(k, seen)} => ${printValue(v, seen)}`).join(', ')}}`;
      }
      const prefix = value.constructor && value.constructor.name && value.constructor.name !== 'Object'
        ? `${value.constructor.name} `
        : '';
      const body = Object.keys(value)
        .map(key => `${key}: ${printValue(value[key], seen)}`)
        .join(', ');
      return `${prefix}{${body}}`;
    } finally {
      seen.delete(value);
    }
  };

  const truncate = (text) => (text.length > MAX_PRINT_LENGTH
    ? `${text.slice(0, MAX_PRINT_LENGTH)}…`
    : text);

  const print = (value) => truncate(printValue(value));

  // ==========================================================================
  // 3. ASYMMETRIC MATCHERS
  // ==========================================================================

  const ASYMMETRIC_BRAND = 'jest-lite.asymmetricMatcher';

  /**
   * Only objects explicitly created by expect.* helpers (or third parties honouring
   * the `asymmetricMatch` contract) count as asymmetric matchers. Arbitrary objects
   * exposing an unrelated `.test()` method are treated as plain data.
   */
  const isAsymmetricMatcher = (value) => !!value
    && (typeof value === 'object' || typeof value === 'function')
    && typeof value.asymmetricMatch === 'function';

  const createAsymmetricMatcher = (label, asymmetricMatch) => ({
    $$typeof: ASYMMETRIC_BRAND,
    asymmetricMatch,
    toString: () => label,
    toJSON: () => label,
  });

  // ==========================================================================
  // 4. EQUALITY ENGINE
  // ==========================================================================

  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  const comparableKeys = (obj, strict) => {
    const keys = Object.keys(obj);
    return strict ? keys : keys.filter(key => obj[key] !== undefined);
  };

  /**
   * Structural equality.
   * @param {*} a received value
   * @param {*} b expected value (may be an asymmetric matcher)
   * @param {boolean} strict when true, constructors/prototypes and `undefined`
   *        valued keys and array holes are significant (toStrictEqual semantics).
   */
  const equals = (a, b, strict = false) => deepEquals(a, b, strict, []);

  function deepEquals(a, b, strict, pairs) {
    if (isAsymmetricMatcher(b)) return !!b.asymmetricMatch(a);
    if (isAsymmetricMatcher(a)) return !!a.asymmetricMatch(b);

    if (Object.is(a, b)) return true;

    if (a === null || b === null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    // Pair-based cycle tracking: only the *same* (a, b) combination short-circuits.
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === a && pairs[i][1] === b) return true;
    }
    pairs.push([a, b]);

    try {
      if (a instanceof Date || b instanceof Date) {
        return a instanceof Date && b instanceof Date && Object.is(a.getTime(), b.getTime());
      }
      if (a instanceof RegExp || b instanceof RegExp) {
        return a instanceof RegExp && b instanceof RegExp
          && a.source === b.source && a.flags === b.flags;
      }
      if (a instanceof Error || b instanceof Error) {
        if (!(a instanceof Error && b instanceof Error)) return false;
        if (strict && a.constructor !== b.constructor) return false;
        return a.name === b.name && a.message === b.message;
      }

      const aIsArray = Array.isArray(a);
      const bIsArray = Array.isArray(b);
      if (aIsArray !== bIsArray) return false;
      if (aIsArray) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (strict && hasOwn(a, i) !== hasOwn(b, i)) return false;
          if (!deepEquals(a[i], b[i], strict, pairs)) return false;
        }
        return true;
      }

      if (typeof Set !== 'undefined' && (a instanceof Set || b instanceof Set)) {
        if (!(a instanceof Set && b instanceof Set)) return false;
        if (a.size !== b.size) return false;
        const remaining = [...b];
        for (const itemA of a) {
          const index = remaining.findIndex(itemB => deepEquals(itemA, itemB, strict, pairs));
          if (index === -1) return false;
          remaining.splice(index, 1);
        }
        return true;
      }

      if (typeof Map !== 'undefined' && (a instanceof Map || b instanceof Map)) {
        if (!(a instanceof Map && b instanceof Map)) return false;
        if (a.size !== b.size) return false;
        const remaining = [...b];
        for (const [keyA, valueA] of a) {
          const index = remaining.findIndex(([keyB, valueB]) =>
            deepEquals(keyA, keyB, strict, pairs) && deepEquals(valueA, valueB, strict, pairs));
          if (index === -1) return false;
          remaining.splice(index, 1);
        }
        return true;
      }

      if (strict) {
        if (a.constructor !== b.constructor) return false;
        if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
      }

      const keysA = comparableKeys(a, strict);
      const keysB = comparableKeys(b, strict);
      if (keysA.length !== keysB.length) return false;

      return keysA.every(key =>
        (hasOwn(b, key) || b[key] !== undefined) && deepEquals(a[key], b[key], strict, pairs));
    } finally {
      pairs.pop();
    }
  }

  /** Partial (subset) matching used by toMatchObject and objectContaining. */
  const matchesSubset = (received, expected) => {
    if (isAsymmetricMatcher(expected)) return !!expected.asymmetricMatch(received);
    if (Array.isArray(expected)) {
      if (!Array.isArray(received) || received.length !== expected.length) return false;
      return expected.every((item, index) => matchesSubset(received[index], item));
    }
    if (expected && typeof expected === 'object' && !(expected instanceof Date)
      && !(expected instanceof RegExp) && !(expected instanceof Error)) {
      if (!received || typeof received !== 'object') return false;
      return Object.keys(expected).every(key => matchesSubset(received[key], expected[key]));
    }
    return equals(received, expected, false);
  };

  // ==========================================================================
  // 5. MOCK & SPY ENGINE
  // ==========================================================================

  /** Single registry for every spy created by jest.spyOn (restored after each test). */
  const activeSpies = new Set();
  /** Registry of every mock function created by jest.fn / jest.spyOn. */
  const allMocks = new Set();

  const isClassImplementation = (impl) => typeof impl === 'function'
    && /^\s*class[\s{]/.test(Function.prototype.toString.call(impl));

  const createMockFunction = (implementation, config = {}) => {
    const {
      mockName = 'jest.fn()',
      onRestore = null,
      originalImplementation = null,
      isSpy = false,
    } = config;

    const mockFn = function (...args) {
      const state = mockFn.mock;
      const impl = state._once.length > 0 ? state._once.shift() : state._default;
      const resultEntry = { type: 'incomplete', value: undefined };
      const constructing = new.target !== undefined;

      state.calls.push(args);
      state.results.push(resultEntry);
      state.contexts.push(this);

      try {
        let value;
        if (typeof impl !== 'function') {
          value = undefined;
        } else if (constructing && isClassImplementation(impl)) {
          value = Reflect.construct(impl, args, new.target);
        } else {
          // `apply` preserves the runtime `this` (method calls, .call/.apply, new).
          value = impl.apply(this, args);
        }
        resultEntry.type = 'return';
        resultEntry.value = value;
        state.returns.push(value);
        if (constructing) {
          state.instances.push(value && typeof value === 'object' ? value : this);
        }
        return value;
      } catch (error) {
        resultEntry.type = 'throw';
        resultEntry.value = error;
        state.returns.push(undefined);
        if (constructing) state.instances.push(this);
        throw error;
      }
    };

    mockFn.mock = {
      calls: [],
      results: [],
      instances: [],
      contexts: [],
      // Legacy convenience view: the raw returned values (undefined for throwing calls).
      returns: [],
      _once: [],
      _default: implementation,
    };

    Object.defineProperty(mockFn.mock, 'lastCall', {
      configurable: true,
      enumerable: false,
      get() { return mockFn.mock.calls[mockFn.mock.calls.length - 1]; },
    });

    mockFn._isMockFunction = true;
    mockFn._isSpy = isSpy;
    mockFn._mockName = mockName;

    mockFn.mockImplementation = (newImpl) => { mockFn.mock._default = newImpl; return mockFn; };
    mockFn.mockImplementationOnce = (newImpl) => { mockFn.mock._once.push(newImpl); return mockFn; };
    mockFn.getMockImplementation = () => mockFn.mock._default;

    mockFn.mockReturnValue = (value) => mockFn.mockImplementation(() => value);
    mockFn.mockReturnValueOnce = (value) => mockFn.mockImplementationOnce(() => value);
    mockFn.mockReturnThis = () => mockFn.mockImplementation(function () { return this; });

    mockFn.mockResolvedValue = (value) => mockFn.mockImplementation(() => Promise.resolve(value));
    mockFn.mockResolvedValueOnce = (value) => mockFn.mockImplementationOnce(() => Promise.resolve(value));
    mockFn.mockRejectedValue = (error) => mockFn.mockImplementation(() => Promise.reject(error));
    mockFn.mockRejectedValueOnce = (error) => mockFn.mockImplementationOnce(() => Promise.reject(error));

    mockFn.mockName = (name) => { mockFn._mockName = String(name); return mockFn; };
    mockFn.getMockName = () => mockFn._mockName;

    mockFn.mockClear = () => {
      mockFn.mock.calls.length = 0;
      mockFn.mock.results.length = 0;
      mockFn.mock.instances.length = 0;
      mockFn.mock.contexts.length = 0;
      mockFn.mock.returns.length = 0;
      return mockFn;
    };

    mockFn.mockReset = () => {
      mockFn.mockClear();
      mockFn.mock._once.length = 0;
      // Spies fall back to the original method, plain mocks become no-ops.
      mockFn.mock._default = isSpy ? originalImplementation : undefined;
      return mockFn;
    };

    mockFn.mockRestore = () => {
      mockFn.mockReset();
      if (typeof onRestore === 'function') onRestore();
      return mockFn;
    };

    allMocks.add(mockFn);
    return mockFn;
  };

  const fn = (implementation) => createMockFunction(implementation);

  function spyOn(obj, method) {
    if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
      throw usageError(`spyOn expects an object or function to spy on, but received ${print(obj)}`);
    }
    if (typeof method !== 'string' && typeof method !== 'symbol') {
      throw usageError(`spyOn expects a property name, but received ${print(method)}`);
    }

    const original = obj[method];
    if (typeof original !== 'function') {
      throw usageError(
        `Cannot spy on property "${String(method)}" because it is not a function (received ${typeof original})`
      );
    }

    const hasOwnOriginal = hasOwn(obj, method);
    // Preserve the runtime `this`: calling obj.method() still binds `this` to obj.
    const originalImplementation = function (...args) { return original.apply(this, args); };

    const spy = createMockFunction(originalImplementation, {
      mockName: String(method),
      isSpy: true,
      originalImplementation,
      onRestore: () => {
        if (hasOwnOriginal) {
          obj[method] = original;
        } else {
          delete obj[method];
        }
        activeSpies.delete(spy);
      },
    });

    spy._originalMethod = original;
    activeSpies.add(spy);
    obj[method] = spy;
    return spy;
  }

  /** Restores every spy created via jest.spyOn (also invoked automatically per test). */
  const restoreAllMocks = () => {
    [...activeSpies].forEach((spy) => {
      if (typeof spy.mockRestore === 'function') spy.mockRestore();
    });
    activeSpies.clear();
  };

  const clearAllMocks = () => {
    allMocks.forEach(mock => mock.mockClear());
    moduleRegistry.forEach((moduleExports) => {
      if (!moduleExports || typeof moduleExports !== 'object') return;
      Object.values(moduleExports).forEach((value) => {
        if (value && typeof value.mockClear === 'function') value.mockClear();
      });
    });
  };

  const resetAllMocks = () => {
    allMocks.forEach(mock => mock.mockReset());
    moduleRegistry.forEach((moduleExports) => {
      if (!moduleExports || typeof moduleExports !== 'object') return;
      Object.values(moduleExports).forEach((value) => {
        if (value && typeof value.mockReset === 'function') value.mockReset();
      });
    });
  };

  const getMockState = (received, matcherName) => {
    const state = typeof received === 'function' ? received.mock : undefined;
    if (!state || !Array.isArray(state.calls)) {
      throw usageError(
        `${matcherName}: received value must be a mock or spy function, but received ${print(received)}`
      );
    }
    return state;
  };

  const returnedValues = (state) => state.results
    .filter(result => result.type === 'return')
    .map(result => result.value);

  // ==========================================================================
  // 6. ASSERTION BOOKKEEPING
  // ==========================================================================

  let assertionCount = 0;
  let expectedAssertions = null;
  let requiresAssertions = false;

  const countAssertion = () => { assertionCount++; };

  const resetAssertionState = () => {
    assertionCount = 0;
    expectedAssertions = null;
    requiresAssertions = false;
  };

  // ==========================================================================
  // 7. SNAPSHOT STATE
  // ==========================================================================

  let snapshotIndex = 0;
  let currentTestName = '';
  let currentSuitePath = [];

  const getSnapshotKey = () => {
    const suitePath = currentSuitePath.length > 0 ? currentSuitePath.join(' > ') : 'root';
    return `snap__${suitePath}__${currentTestName}__${snapshotIndex}`;
  };

  const SNAPSHOT_FILE = 'jest-lite.snap';

  const useNodeSnapshotStorage = () => isNodeRuntime && !!esmRequire && !globalScope._forceBrowserStorage;

  const readSnapshot = (key) => {
    if (useNodeSnapshotStorage()) {
      try {
        const fs = esmRequire('fs');
        const path = esmRequire('path');
        const snapPath = path.join(process.cwd(), '__snapshots__', SNAPSHOT_FILE);
        if (fs.existsSync(snapPath)) {
          const stored = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
          return stored[key] !== undefined ? stored[key] : null;
        }
        return null;
      } catch (e) {
        return null;
      }
    }
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return globalScope._fallbackSnapCache ? (globalScope._fallbackSnapCache[key] ?? null) : null;
  };

  const writeSnapshot = (key, value) => {
    if (useNodeSnapshotStorage()) {
      try {
        const fs = esmRequire('fs');
        const path = esmRequire('path');
        const snapDir = path.join(process.cwd(), '__snapshots__');
        if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
        const snapPath = path.join(snapDir, SNAPSHOT_FILE);
        let stored = {};
        if (fs.existsSync(snapPath)) {
          try { stored = JSON.parse(fs.readFileSync(snapPath, 'utf8')); } catch (e) { stored = {}; }
        }
        stored[key] = value;
        fs.writeFileSync(snapPath, JSON.stringify(stored, null, 2), 'utf8');
        return;
      } catch (e) { /* fall through to web storage */ }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    if (!globalScope._fallbackSnapCache) globalScope._fallbackSnapCache = {};
    globalScope._fallbackSnapCache[key] = value;
  };

  const serializeSnapshot = (value) => {
    try {
      const seen = new WeakSet();
      const json = JSON.stringify(value, (key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        if (typeof val === 'function') return `[Function ${val.name || 'anonymous'}]`;
        if (typeof val === 'undefined') return '[undefined]';
        return val;
      }, 2);
      return json === undefined ? '[Unserializable]' : json;
    } catch (e) {
      return '[Unserializable]';
    }
  };

  // ==========================================================================
  // 8. MATCHERS
  // ==========================================================================

  const createMatchers = (actual) => {
    const matchers = {
    toBe: (expected) => {
      countAssertion();
      if (!Object.is(actual, expected)) {
        throw assertionError(
          `Expected ${print(expected)}, got ${print(actual)}`,
          { matcherName: 'toBe', actual, expected }
        );
      }
    },

    toEqual: (expected) => {
      countAssertion();
      if (!equals(actual, expected, false)) {
        throw assertionError(
          `Expected ${print(expected)}, got ${print(actual)}`,
          { matcherName: 'toEqual', actual, expected }
        );
      }
    },

    toStrictEqual: (expected) => {
      countAssertion();
      if (!equals(actual, expected, true)) {
        throw assertionError(
          `Expected (strict) ${print(expected)}, got ${print(actual)}`,
          { matcherName: 'toStrictEqual', actual, expected }
        );
      }
    },

    toBeDefined: () => {
      countAssertion();
      if (actual === undefined) throw assertionError('Expected to be defined');
    },

    toBeUndefined: () => {
      countAssertion();
      if (actual !== undefined) throw assertionError(`Expected undefined, got ${print(actual)}`);
    },

    toBeNull: () => {
      countAssertion();
      if (actual !== null) throw assertionError(`Expected null, got ${print(actual)}`);
    },

    toBeNaN: () => {
      countAssertion();
      if (!Number.isNaN(actual)) throw assertionError(`Expected NaN, got ${print(actual)}`);
    },

    toBeTruthy: () => {
      countAssertion();
      if (!actual) throw assertionError(`Expected truthy, got ${print(actual)}`);
    },

    toBeFalsy: () => {
      countAssertion();
      if (actual) throw assertionError(`Expected falsy, got ${print(actual)}`);
    },

    toBeWithinRange: (floor, ceiling) => {
      countAssertion();
      if (typeof actual !== 'number') {
        throw assertionError(`Expected a number, but got ${typeof actual}`);
      }
      if (actual < floor || actual > ceiling) {
        throw assertionError(`Expected ${actual} to be within range ${floor} - ${ceiling}`);
      }
    },

    toBeOneOf: (collection) => {
      countAssertion();
      if (!Array.isArray(collection)) {
        throw usageError(`toBeOneOf expects an Array, but got ${typeof collection}`);
      }
      if (!collection.some(item => equals(actual, item, false))) {
        throw assertionError(`Expected ${print(actual)} to be one of ${print(collection)}`);
      }
    },

    toContain: (item) => {
      countAssertion();
      if (typeof actual === 'string') {
        if (typeof item !== 'string') {
          throw usageError(`toContain: expected a string needle for a string haystack, got ${print(item)}`);
        }
        if (!actual.includes(item)) {
          throw assertionError(`String ${print(actual)} does not contain ${print(item)}`);
        }
        return;
      }
      if (typeof Set !== 'undefined' && actual instanceof Set) {
        if (!actual.has(item)) throw assertionError(`Set does not contain ${print(item)}`);
        return;
      }
      if (!actual || typeof actual.length !== 'number') {
        throw usageError(`toContain expects a string, array, Set or array-like, but received ${print(actual)}`);
      }
      const found = Array.prototype.some.call(actual, entry => Object.is(entry, item));
      if (!found) throw assertionError(`Collection does not contain ${print(item)}`);
    },

    toContainEqual: (item) => {
      countAssertion();
      const iterable = (typeof Set !== 'undefined' && actual instanceof Set) ? [...actual] : actual;
      if (!iterable || typeof iterable.length !== 'number') {
        throw usageError(`toContainEqual expects an array, Set or array-like, but received ${print(actual)}`);
      }
      const found = Array.prototype.some.call(iterable, entry => equals(entry, item, false));
      if (!found) throw assertionError(`Collection does not contain an item equal to ${print(item)}`);
    },

    toHaveLength: (expectedLength) => {
      countAssertion();
      if (typeof expectedLength !== 'number') {
        throw usageError(`toHaveLength expects a number, but received ${print(expectedLength)}`);
      }
      let length;
      if (actual && typeof actual.length === 'number') length = actual.length;
      else if (actual && typeof actual.size === 'number') length = actual.size;
      else {
        throw usageError(`toHaveLength expects a value with a length or size, but received ${print(actual)}`);
      }
      if (length !== expectedLength) {
        throw assertionError(`Expected length ${expectedLength}, got ${length}`);
      }
    },

    toBeGreaterThan: (n) => {
      countAssertion();
      if (!(actual > n)) throw assertionError(`Expected ${print(actual)} > ${print(n)}`);
    },

    toBeLessThan: (n) => {
      countAssertion();
      if (!(actual < n)) throw assertionError(`Expected ${print(actual)} < ${print(n)}`);
    },

    toBeGreaterThanOrEqual: (n) => {
      countAssertion();
      if (!(actual >= n)) throw assertionError(`Expected ${print(actual)} >= ${print(n)}`);
    },

    toBeLessThanOrEqual: (n) => {
      countAssertion();
      if (!(actual <= n)) throw assertionError(`Expected ${print(actual)} <= ${print(n)}`);
    },

    toBeCloseTo: (num, precision = 2) => {
      countAssertion();
      if (typeof actual !== 'number' || typeof num !== 'number') {
        throw usageError(`toBeCloseTo expects numbers, but received ${print(actual)} and ${print(num)}`);
      }
      if (!(Math.abs(actual - num) < Math.pow(10, -precision) / 2)) {
        throw assertionError(`Expected ${actual} to be close to ${num} (precision ${precision})`);
      }
    },

    toMatch: (pattern) => {
      countAssertion();
      if (typeof actual !== 'string') {
        throw usageError(`toMatch expects a string, but received ${print(actual)}`);
      }
      if (typeof pattern === 'string') {
        if (!actual.includes(pattern)) {
          throw assertionError(`${print(actual)} did not contain ${print(pattern)}`);
        }
        return;
      }
      if (!(pattern instanceof RegExp)) {
        throw usageError(`toMatch expects a string or RegExp, but received ${print(pattern)}`);
      }
      if (!pattern.test(actual)) {
        throw assertionError(`${print(actual)} did not match regex ${pattern}`);
      }
    },

    toThrow: (expected) => {
      countAssertion();
      if (typeof actual !== 'function') {
        throw usageError(`toThrow expects a function, but received ${print(actual)}`);
      }

      let thrown = null;
      let didThrow = false;
      try {
        actual();
      } catch (error) {
        didThrow = true;
        thrown = error;
      }

      if (!didThrow) throw assertionError('Expected to throw, but passed');
      if (expected === undefined || expected === null) return;

      const message = (thrown && typeof thrown.message === 'string') ? thrown.message : String(thrown);

      if (typeof expected === 'string') {
        if (!message.includes(expected)) {
          throw assertionError(`Expected error containing "${expected}", got "${message}"`);
        }
        return;
      }
      if (expected instanceof RegExp) {
        if (!expected.test(message)) {
          throw assertionError(`Expected error matching ${expected}, got "${message}"`);
        }
        return;
      }
      if (expected instanceof Error) {
        if (message !== expected.message) {
          throw assertionError(`Expected error message "${expected.message}", got "${message}"`);
        }
        return;
      }
      if (typeof expected === 'function') {
        if (!(thrown instanceof expected)) {
          const actualName = (thrown && thrown.constructor && thrown.constructor.name) || typeof thrown;
          throw assertionError(`Expected error of type ${expected.name || 'UnknownError'}, got ${actualName}`);
        }
        return;
      }
      throw usageError(
        `toThrow expects a string, RegExp, Error class or Error instance, but received ${print(expected)}`
      );
    },

    toHaveProperty: (keyPath, ...valueArgs) => {
      countAssertion();
      if (typeof keyPath !== 'string' && !Array.isArray(keyPath)) {
        throw usageError(`toHaveProperty expects a string path or array of keys, got ${print(keyPath)}`);
      }
      const keys = Array.isArray(keyPath) ? keyPath : keyPath.split('.');
      let target = actual;
      for (const key of keys) {
        if (target === null || target === undefined || !(key in Object(target))) {
          throw assertionError(`Property ${keys.join('.')} not found`);
        }
        target = target[key];
      }
      if (valueArgs.length > 0 && !equals(target, valueArgs[0], false)) {
        throw assertionError(
          `Expected ${keys.join('.')} to be ${print(valueArgs[0])}, got ${print(target)}`
        );
      }
    },

    // ---------- Mock matchers ----------
    toHaveBeenCalled: () => {
      countAssertion();
      const state = getMockState(actual, 'toHaveBeenCalled');
      if (state.calls.length === 0) throw assertionError('Function not called');
    },

    toHaveBeenCalledTimes: (expectedCount) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveBeenCalledTimes');
      if (typeof expectedCount !== 'number') {
        throw usageError(`toHaveBeenCalledTimes expects a number, got ${print(expectedCount)}`);
      }
      if (state.calls.length !== expectedCount) {
        throw assertionError(
          `Expected mock to be called ${expectedCount} times, but it was called ${state.calls.length} times.`
        );
      }
    },

    toHaveBeenCalledWith: (...expectedArgs) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveBeenCalledWith');
      const passed = state.calls.some(callArgs => equals(callArgs, expectedArgs, false));
      if (!passed) throw assertionError(`Never called with: ${print(expectedArgs)}`);
    },

    toHaveBeenLastCalledWith: (...expectedArgs) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveBeenLastCalledWith');
      if (state.calls.length === 0) throw assertionError('Function not called');
      const lastCall = state.calls[state.calls.length - 1];
      if (!equals(lastCall, expectedArgs, false)) {
        throw assertionError(`Last call was ${print(lastCall)}, expected ${print(expectedArgs)}`);
      }
    },

    toHaveBeenNthCalledWith: (nth, ...expectedArgs) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveBeenNthCalledWith');
      if (!Number.isInteger(nth) || nth < 1) {
        throw usageError(`toHaveBeenNthCalledWith expects a positive integer, got ${print(nth)}`);
      }
      const call = state.calls[nth - 1];
      if (!call) {
        throw assertionError(`Mock was called ${state.calls.length} times, no call number ${nth}`);
      }
      if (!equals(call, expectedArgs, false)) {
        throw assertionError(`Call ${nth} was ${print(call)}, expected ${print(expectedArgs)}`);
      }
    },

    toHaveReturned: () => {
      countAssertion();
      const state = getMockState(actual, 'toHaveReturned');
      if (returnedValues(state).length === 0) {
        throw assertionError('Expected mock to have returned at least once without throwing');
      }
    },

    toHaveReturnedTimes: (expectedCount) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveReturnedTimes');
      if (typeof expectedCount !== 'number') {
        throw usageError(`toHaveReturnedTimes expects a number, got ${print(expectedCount)}`);
      }
      const count = returnedValues(state).length;
      if (count !== expectedCount) {
        throw assertionError(`Expected mock to return ${expectedCount} times, but it returned ${count} times.`);
      }
    },

    toHaveReturnedWith: (expectedValue) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveReturnedWith');
      const values = returnedValues(state);
      if (!values.some(value => equals(value, expectedValue, false))) {
        throw assertionError(`Never returned: ${print(expectedValue)}`);
      }
    },

    toHaveLastReturnedWith: (expectedValue) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveLastReturnedWith');
      if (state.results.length === 0) throw assertionError('Function not called');
      const last = state.results[state.results.length - 1];
      if (last.type !== 'return' || !equals(last.value, expectedValue, false)) {
        throw assertionError(
          `Last result was ${last.type === 'throw' ? `a thrown ${print(last.value)}` : print(last.value)}, ` +
          `expected ${print(expectedValue)}`
        );
      }
    },

    toHaveNthReturnedWith: (nth, expectedValue) => {
      countAssertion();
      const state = getMockState(actual, 'toHaveNthReturnedWith');
      if (!Number.isInteger(nth) || nth < 1) {
        throw usageError(`toHaveNthReturnedWith expects a positive integer, got ${print(nth)}`);
      }
      const result = state.results[nth - 1];
      if (!result) {
        throw assertionError(`Mock was called ${state.results.length} times, no result number ${nth}`);
      }
      if (result.type !== 'return' || !equals(result.value, expectedValue, false)) {
        throw assertionError(
          `Result ${nth} was ${result.type === 'throw' ? `a thrown ${print(result.value)}` : print(result.value)}, ` +
          `expected ${print(expectedValue)}`
        );
      }
    },

    // ---------- Snapshots ----------
    toMatchSnapshot: (customSnapName) => {
      countAssertion();
      if (customSnapName !== undefined && typeof customSnapName !== 'string') {
        throw usageError(`toMatchSnapshot expects an optional string name, got ${print(customSnapName)}`);
      }
      const key = customSnapName || getSnapshotKey();
      const serialized = serializeSnapshot(actual);
      snapshotIndex++;

      const existing = readSnapshot(key);
      const shouldUpdate = typeof window !== 'undefined' && window.updateSnapshots !== undefined
        ? window.updateSnapshots
        : globalScope.updateSnapshots;

      if (existing === null || existing === undefined || shouldUpdate) {
        writeSnapshot(key, serialized);
        console.log(`%c[Snapshot Saved]: %c${key}`, 'font-weight:bold; color: #2980b9', 'color: #7f8c8d');
        return;
      }

      if (existing !== serialized) {
        console.groupCollapsed(`%c❌ Snapshot Mismatch: ${key}`, 'color: #e74c3c; font-weight: bold');
        console.log('%cExpected:', 'color: #27ae60', existing);
        console.log('%cReceived:', 'color: #c0392b', serialized);
        console.log('%cFix:', 'color: #8e44ad', 'Set globalThis.updateSnapshots = true; then re-run.');
        console.groupEnd();
        throw assertionError(`Snapshot Mismatch for ${key}`);
      }
    },

    toMatchObject: (expected) => {
      countAssertion();
      if (expected === null || typeof expected !== 'object') {
        throw usageError(`toMatchObject expects an object or array, but received ${print(expected)}`);
      }
      if (actual === null || typeof actual !== 'object') {
        throw assertionError(`Object mismatch.\nExpected subset: ${print(expected)}\nReceived: ${print(actual)}`);
      }
      if (!matchesSubset(actual, expected)) {
        throw assertionError(`Object mismatch.\nExpected subset: ${print(expected)}\nReceived: ${print(actual)}`);
      }
    },

    toBeInstanceOf: (ExpectedClass) => {
      countAssertion();
      if (typeof ExpectedClass !== 'function') {
        throw usageError(`toBeInstanceOf expects a constructor, but received ${print(ExpectedClass)}`);
      }
      if (!(actual instanceof ExpectedClass)) {
        const actualName = (actual && actual.constructor && actual.constructor.name) || typeof actual;
        throw assertionError(
          `Expected instance of ${ExpectedClass.name || 'UnknownClass'}, but got ${actualName}`
        );
      }
    },

    toBeEmpty: () => {
      countAssertion();
      const length = actual?.length
        ?? actual?.size
        ?? (actual && typeof actual === 'object' ? Object.keys(actual).length : 0);
      if (length !== 0) throw assertionError(`Expected empty, but got length ${length}`);
    },

    toBeType: (type) => {
      countAssertion();
      if (typeof type !== 'string') {
        throw usageError(`toBeType expects a type name string, got ${print(type)}`);
      }
      if (typeof actual !== type) throw assertionError(`Expected type ${type}, but got ${typeof actual}`);
    },

    toBeArray: () => {
      countAssertion();
      if (!Array.isArray(actual)) throw assertionError(`Expected Array, but got ${typeof actual}`);
    },

    toBeObject: () => {
      countAssertion();
      const isObject = typeof actual === 'object' && actual !== null && !Array.isArray(actual);
      if (!isObject) {
        throw assertionError(`Expected Object, but got ${actual === null ? 'null' : typeof actual}`);
      }
    },

    toStartWith: (str) => {
      countAssertion();
      if (typeof actual !== 'string' || !actual.startsWith(str)) {
        throw assertionError(`Expected ${print(actual)} to start with ${print(str)}`);
      }
    },

    toEndWith: (str) => {
      countAssertion();
      if (typeof actual !== 'string' || !actual.endsWith(str)) {
        throw assertionError(`Expected ${print(actual)} to end with ${print(str)}`);
      }
    },

    // ---------- UI / DOM matchers ----------
    toExist: () => {
      countAssertion();
      // Guarded so environments without a DOM never hit a ReferenceError.
      const isElement = typeof HTMLElement !== 'undefined' && actual instanceof HTMLElement;
      let exists;
      if (actual === null || actual === undefined) exists = false;
      else if (isElement) exists = true;
      else if (typeof actual.length === 'number') exists = actual.length > 0;
      else exists = !!actual;
      if (!exists) {
        throw assertionError(`Expected element to exist in the DOM, but got ${print(actual)}`);
      }
    },

    toHaveClass: (className) => {
      countAssertion();
      if (!actual || typeof actual !== 'object') {
        throw usageError(`toHaveClass expects a DOM element, but received ${print(actual)}`);
      }
      const classList = actual.classList;
      const hasClass = classList && typeof classList.contains === 'function'
        ? classList.contains(className)
        : String(actual.className || '').split(/\s+/).includes(className);
      if (!hasClass) {
        throw assertionError(
          `Expected element to have class "${className}", but got "${actual.className || ''}"`
        );
      }
    },

    toBeVisible: () => {
      countAssertion();
      if (!actual || typeof actual !== 'object') {
        throw usageError(`toBeVisible expects a DOM element, but received ${print(actual)}`);
      }
      if (typeof globalScope.getComputedStyle !== 'function') {
        throw usageError('toBeVisible requires a DOM environment exposing getComputedStyle');
      }
      const style = globalScope.getComputedStyle(actual) || {};
      const rects = typeof actual.getClientRects === 'function' ? actual.getClientRects() : [];
      const hasBox = !!(actual.offsetWidth || actual.offsetHeight || (rects && rects.length));
      const isVisible = hasBox && style.display !== 'none' && style.visibility !== 'hidden';
      if (!isVisible) throw assertionError('Expected element to be visible');
    },

    toHaveTextContent: (text) => {
      countAssertion();
      if (!actual || typeof actual !== 'object') {
        throw usageError(`toHaveTextContent expects a DOM element, but received ${print(actual)}`);
      }
      const content = actual.textContent || '';
      const match = typeof text === 'string' ? content.includes(text) : text.test(content);
      if (!match) {
        throw assertionError(`Expected element to contain text "${text}", but got "${content.trim()}"`);
      }
    },

    toBeDisabled: () => {
      countAssertion();
      if (!actual || typeof actual !== 'object') {
        throw usageError(`toBeDisabled expects a DOM element, but received ${print(actual)}`);
      }
      if (!actual.disabled) throw assertionError('Expected element to be disabled');
    },

    toHaveAttribute: (attr, ...expectedValue) => {
      countAssertion();
      if (!actual || typeof actual.hasAttribute !== 'function') {
        throw usageError(`toHaveAttribute expects a DOM element, but received ${print(actual)}`);
      }
      if (typeof attr !== 'string') {
        throw usageError(`toHaveAttribute expects an attribute name string, got ${print(attr)}`);
      }
      if (!actual.hasAttribute(attr)) {
        throw assertionError(`Expected element to have attribute "${attr}"`);
      }
      // Only compare values when a second argument was actually supplied.
      if (expectedValue.length > 0) {
        const received = actual.getAttribute(attr);
        if (received !== expectedValue[0]) {
          throw assertionError(
            `Expected attribute "${attr}" to be "${expectedValue[0]}", but got "${received}"`
          );
        }
      }
    },

    toBeInTheDocument: () => {
      countAssertion();
      if (typeof document === 'undefined' || typeof document.contains !== 'function') {
        throw usageError('toBeInTheDocument requires a DOM environment exposing document.contains');
      }
      if (!document.contains(actual)) {
        throw assertionError('Expected element to be in the document, but it was not found.');
      }
    },

    toHaveStyle: (styles) => {
      countAssertion();
      if (!styles || typeof styles !== 'object') {
        throw usageError(`toHaveStyle expects an object of CSS properties, got ${print(styles)}`);
      }
      if (typeof globalScope.getComputedStyle !== 'function') {
        throw usageError('toHaveStyle requires a DOM environment exposing getComputedStyle');
      }
      const computedStyle = globalScope.getComputedStyle(actual);
      if (!computedStyle || typeof computedStyle.getPropertyValue !== 'function') {
        throw usageError('toHaveStyle could not read a computed style from the received element');
      }
      for (const [prop, value] of Object.entries(styles)) {
        const kebabProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        const actualValue = computedStyle.getPropertyValue(kebabProp);
        if (actualValue !== value) {
          throw assertionError(`Expected ${kebabProp} to be "${value}", but got "${actualValue}"`);
        }
      }
    },

    toHaveFocus: () => {
      countAssertion();
      if (typeof document === 'undefined') {
        throw usageError('toHaveFocus requires a DOM environment exposing document.activeElement');
      }
      if (document.activeElement !== actual) {
        throw assertionError('Expected element to have focus, but it did not.');
      }
    },
    };

    // Jest compatibility alias
    matchers.toThrowError = matchers.toThrow;
    return matchers;
  };

  // ==========================================================================
  // 9. EXPECT
  // ==========================================================================

  const customMatchersRegistry = {};
  const BUILT_IN_MATCHER_NAMES = Object.keys(createMatchers(undefined));

  const matcherContext = (isNot) => ({
    isNot,
    equals: (a, b, strict = false) => equals(a, b, strict),
    utils: {
      printReceived: print,
      printExpected: print,
      stringify: print,
    },
  });

  const createCustomMatcherRunner = (matcherFn, actual, isInverted) => (...args) => {
    countAssertion();
    const result = matcherFn.call(matcherContext(isInverted), actual, ...args);
    if (!result || typeof result.pass !== 'boolean') {
      throw usageError('Custom matchers must return an object shaped like { pass: boolean, message?: Function }');
    }
    const didPass = isInverted ? !result.pass : result.pass;
    if (!didPass) {
      const message = typeof result.message === 'function' ? result.message() : result.message;
      throw assertionError(message || 'Custom matcher assertion failed');
    }
  };

  const invertMatcher = (matcherFn, name) => (...args) => {
    try {
      matcherFn(...args);
    } catch (error) {
      // Only genuine assertion failures satisfy `.not`; real errors keep propagating.
      if (isAssertionError(error)) return;
      throw error;
    }
    throw assertionError(`Expected NOT to ${name}`, { matcherName: name });
  };

  const settlePromise = async (received, mode) => {
    if (!received || (typeof received.then !== 'function')) {
      throw usageError(`.${mode} expects a promise or thenable, but received ${print(received)}`);
    }
    if (mode === 'resolves') {
      try {
        return await received;
      } catch (error) {
        throw assertionError(`Expected promise to resolve, but it rejected with ${print(error)}`);
      }
    }
    let resolvedValue;
    try {
      resolvedValue = await received;
    } catch (error) {
      return error;
    }
    throw assertionError(`Expected promise to reject, but it resolved with ${print(resolvedValue)}`);
  };

  const createAsyncChain = (received, mode) => {
    const names = BUILT_IN_MATCHER_NAMES.concat(Object.keys(customMatchersRegistry));
    const chain = { not: {} };
    // `.rejects.toThrow(...)` reads naturally when the rejection reason is re-thrown.
    const adapt = (name, value) => (
      (mode === 'rejects' && (name === 'toThrow' || name === 'toThrowError'))
        ? () => { throw value; }
        : value
    );
    names.forEach((name) => {
      chain[name] = async (...args) => {
        const value = await settlePromise(received, mode);
        return expect(adapt(name, value))[name](...args);
      };
      chain.not[name] = async (...args) => {
        const value = await settlePromise(received, mode);
        return expect(adapt(name, value)).not[name](...args);
      };
    });
    return chain;
  };

  const expect = (actual) => {
    const builtIns = createMatchers(actual);
    const api = { ...builtIns, not: {} };

    Object.keys(builtIns).forEach((name) => {
      api.not[name] = invertMatcher(builtIns[name], name);
    });

    Object.keys(customMatchersRegistry).forEach((name) => {
      api[name] = createCustomMatcherRunner(customMatchersRegistry[name], actual, false);
      api.not[name] = createCustomMatcherRunner(customMatchersRegistry[name], actual, true);
    });

    // Async chains are built lazily so the common synchronous path stays cheap.
    Object.defineProperty(api, 'resolves', {
      configurable: true,
      enumerable: true,
      get: () => createAsyncChain(actual, 'resolves'),
    });
    Object.defineProperty(api, 'rejects', {
      configurable: true,
      enumerable: true,
      get: () => createAsyncChain(actual, 'rejects'),
    });

    return api;
  };

  expect.assertions = (num) => {
    if (!Number.isInteger(num) || num < 0) {
      throw usageError(`expect.assertions expects a non-negative integer, got ${print(num)}`);
    }
    expectedAssertions = num;
  };

  expect.hasAssertions = () => { requiresAssertions = true; };

  expect.getState = () => ({
    assertionCount,
    expectedAssertions,
    requiresAssertions,
    currentTestName,
    currentSuitePath: [...currentSuitePath],
  });

  expect.AssertionError = JestLiteAssertionError;

  expect.any = (ctor) => {
    if (typeof ctor !== 'function') {
      throw usageError(`expect.any expects a constructor, but received ${print(ctor)}`);
    }
    return createAsymmetricMatcher(`Any<${ctor.name || 'anonymous'}>`, (val) => {
      if (ctor === Number) return typeof val === 'number' || val instanceof Number;
      if (ctor === String) return typeof val === 'string' || val instanceof String;
      if (ctor === Boolean) return typeof val === 'boolean' || val instanceof Boolean;
      if (ctor === BigInt) return typeof val === 'bigint';
      if (ctor === Symbol) return typeof val === 'symbol';
      if (ctor === Object) return typeof val === 'object' && val !== null;
      if (ctor === Array) return Array.isArray(val);
      if (ctor === Function) return typeof val === 'function';
      return val instanceof ctor;
    });
  };

  expect.anything = () => createAsymmetricMatcher(
    'Anything',
    (val) => val !== null && val !== undefined
  );

  expect.stringMatching = (pattern) => {
    if (typeof pattern !== 'string' && !(pattern instanceof RegExp)) {
      throw usageError(`expect.stringMatching expects a string or RegExp, got ${print(pattern)}`);
    }
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return createAsymmetricMatcher(
      `StringMatching<${regex}>`,
      (val) => typeof val === 'string' && regex.test(val)
    );
  };

  expect.stringContaining = (substring) => {
    if (typeof substring !== 'string') {
      throw usageError(`expect.stringContaining expects a string, got ${print(substring)}`);
    }
    return createAsymmetricMatcher(
      `StringContaining<${JSON.stringify(substring)}>`,
      (val) => typeof val === 'string' && val.includes(substring)
    );
  };

  expect.arrayContaining = (expectedItems) => {
    if (!Array.isArray(expectedItems)) {
      throw usageError(`expect.arrayContaining expects an array, got ${print(expectedItems)}`);
    }
    return createAsymmetricMatcher(
      `ArrayContaining<${print(expectedItems)}>`,
      (val) => Array.isArray(val)
        && expectedItems.every(expected => val.some(item => equals(item, expected, false)))
    );
  };

  expect.objectContaining = (expectedSubset) => {
    if (expectedSubset === null || typeof expectedSubset !== 'object') {
      throw usageError(`expect.objectContaining expects an object, got ${print(expectedSubset)}`);
    }
    return createAsymmetricMatcher(
      `ObjectContaining<${print(expectedSubset)}>`,
      (val) => val !== null && typeof val === 'object'
        && Object.keys(expectedSubset).every(key => equals(val[key], expectedSubset[key], false))
    );
  };

  expect.closeTo = (expectedNumber, precision = 2) => {
    if (typeof expectedNumber !== 'number') {
      throw usageError(`expect.closeTo expects a number, got ${print(expectedNumber)}`);
    }
    return createAsymmetricMatcher(
      `CloseTo<${expectedNumber}>`,
      (val) => typeof val === 'number'
        && Math.abs(val - expectedNumber) < Math.pow(10, -precision) / 2
    );
  };

  const extendExpect = (newMatchers) => {
    if (!newMatchers || typeof newMatchers !== 'object') {
      throw usageError(`expect.extend expects an object of matcher functions, got ${print(newMatchers)}`);
    }
    Object.entries(newMatchers).forEach(([name, matcher]) => {
      if (typeof matcher !== 'function') {
        throw usageError(`expect.extend: matcher "${name}" must be a function`);
      }
      customMatchersRegistry[name] = matcher;
    });
  };

  expect.extend = extendExpect;

  // ==========================================================================
  // 10. TEST / HOOK TIMEOUTS
  // ==========================================================================

  const DEFAULT_TEST_TIMEOUT = 5000;

  /** Validates a Jest-style timeout argument; `undefined` falls back to the default. */
  const validateTimeout = (timeout, label) => {
    if (timeout === undefined) return DEFAULT_TEST_TIMEOUT;
    if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 0) {
      throw usageError(`${label} timeout must be a non-negative finite number, got ${print(timeout)}`);
    }
    return timeout;
  };

  /**
   * Races `fn()` against a real (native) timer identified by `label`, so timeout
   * enforcement can never be disabled by `jest.useFakeTimers()`. The timer is always
   * cleared as soon as either side settles, leaving nothing pending afterwards.
   */
  const withTimeout = (fn, timeout, label) => new Promise((resolve, reject) => {
    let settled = false;
    const timerId = REAL_SET_TIMEOUT(() => {
      if (settled) return;
      settled = true;
      reject(new Error(
        `${label} timed out after ${timeout}ms. Increase the timeout value to allow more time, `
        + 'if this is expected to take longer (see the final `timeout` argument of test/it/hooks).'
      ));
    }, timeout);

    Promise.resolve().then(fn).then(
      (value) => {
        if (settled) return;
        settled = true;
        REAL_CLEAR_TIMEOUT(timerId);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        REAL_CLEAR_TIMEOUT(timerId);
        reject(error);
      }
    );
  });

  // ==========================================================================
  // 11. SUITE / TEST DSL
  // ==========================================================================

  const createSuite = (name = 'root', mode = 'run') => ({
    name,
    mode,
    tests: [],
    suites: [],
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  });

  let rootSuite = createSuite();
  let currentSuite = rootSuite;

  const registerTest = (name, testFn, mode, timeout) => {
    if (mode !== 'todo' && typeof testFn !== 'function') {
      throw usageError(`Test "${name}" requires an implementation function`);
    }
    const resolvedTimeout = mode === 'todo' ? DEFAULT_TEST_TIMEOUT : validateTimeout(timeout, `Test "${name}"`);
    const test = { name: String(name), fn: testFn, mode, timeout: resolvedTimeout };
    currentSuite.tests.push(test);
    return test;
  };

  const registerSuite = (name, cb, mode) => {
    if (typeof cb !== 'function') {
      throw usageError(`describe("${name}") requires a callback function`);
    }
    const parent = currentSuite;
    const suite = createSuite(String(name), mode);
    parent.suites.push(suite);
    currentSuite = suite;
    try {
      cb();
    } finally {
      currentSuite = parent;
    }
    return suite;
  };

  /** Parses a tagged-template table into an array of row objects. */
  const parseTemplateTable = (strings, expressions) => {
    const headings = strings[0].trim().split('|').map(part => part.trim()).filter(Boolean);
    if (headings.length === 0) {
      throw usageError('each`` template tables require a header row, e.g. `a | b | expected`');
    }
    if (expressions.length % headings.length !== 0) {
      throw usageError(
        `each\`\` table has ${expressions.length} values which is not divisible by ${headings.length} headings`
      );
    }
    const rows = [];
    for (let i = 0; i < expressions.length; i += headings.length) {
      const row = {};
      headings.forEach((heading, index) => { row[heading] = expressions[i + index]; });
      rows.push(row);
    }
    return rows;
  };

  const resolvePath = (obj, path) => path.split('.').reduce(
    (acc, key) => (acc === null || acc === undefined ? undefined : acc[key]),
    obj
  );

  const formatValue = (token, value) => {
    switch (token) {
      case '%d':
      case '%i': return String(Number(value));
      case '%f': return String(Number(value));
      case '%j': {
        try { return JSON.stringify(value); } catch (e) { return print(value); }
      }
      case '%o':
      case '%p': return print(value);
      default:
        return (value !== null && typeof value === 'object') ? print(value) : String(value);
    }
  };

  const interpolate = (title, args, index) => {
    let cursor = 0;
    let result = String(title).replace(/%[%sdifjop#]/g, (token) => {
      if (token === '%%') return '%';
      if (token === '%#') return String(index);
      if (cursor >= args.length) return token;
      return formatValue(token, args[cursor++]);
    });

    const row = args.length === 1 ? args[0] : undefined;
    if (row !== null && typeof row === 'object') {
      result = result.replace(/\$([A-Za-z_$][\w]*(?:\.[A-Za-z_$][\w]*)*)/g, (match, path) => {
        if (path === '#') return String(index);
        const value = resolvePath(row, path);
        return value === undefined ? match : formatValue('%s', value);
      });
    }
    return result.replace(/\$#/g, String(index));
  };

  /**
   * Builds an `.each` implementation for a registration function.
   * Supports `each([[1, 2]])(...)` and tagged templates: each`a|b\n${1}|${2}`(...)
   */
  const createEach = (register) => (...tableArgs) => {
    const [first, ...rest] = tableArgs;
    const isTemplate = Array.isArray(first) && Array.isArray(first.raw);
    if (!isTemplate && !Array.isArray(first)) {
      throw usageError(`.each expects an array table or a tagged template literal, got ${print(first)}`);
    }
    const rows = isTemplate ? parseTemplateTable(first, rest) : first;

    return (name, callback, timeout) => {
      rows.forEach((row, index) => {
        const args = isTemplate ? [row] : (Array.isArray(row) ? row : [row]);
        register(interpolate(name, args, index), callback, args, timeout);
      });
    };
  };

  const it = (name, testFn, timeout) => registerTest(name, testFn, 'run', timeout);
  it.only = (name, testFn, timeout) => registerTest(name, testFn, 'only', timeout);
  it.skip = (name, testFn, timeout) => registerTest(name, testFn, 'skip', timeout);
  it.todo = (name) => registerTest(name, undefined, 'todo');

  const makeItEach = (mode) => createEach((title, callback, args, timeout) => {
    if (typeof callback !== 'function') {
      throw usageError(`it.each("${title}") requires a callback function`);
    }
    registerTest(title, () => callback(...args), mode, timeout);
  });

  it.each = makeItEach('run');
  it.only.each = makeItEach('only');
  it.skip.each = makeItEach('skip');

  const describe = (name, cb) => registerSuite(name, cb, 'run');
  describe.only = (name, cb) => registerSuite(name, cb, 'only');
  describe.skip = (name, cb) => registerSuite(name, cb, 'skip');

  const makeDescribeEach = (mode) => createEach((title, callback, args) => {
    if (typeof callback !== 'function') {
      throw usageError(`describe.each("${title}") requires a callback function`);
    }
    registerSuite(title, () => callback(...args), mode);
  });

  describe.each = makeDescribeEach('run');
  describe.only.each = makeDescribeEach('only');
  describe.skip.each = makeDescribeEach('skip');

  // `test` is a complete alias of `it`, including every sub-API.
  const test = (name, testFn, timeout) => it(name, testFn, timeout);
  test.only = it.only;
  test.skip = it.skip;
  test.todo = it.todo;
  test.each = it.each;

  const registerHook = (bucket) => (hookFn, timeout) => {
    if (typeof hookFn !== 'function') {
      throw usageError(`${bucket} expects a function, got ${print(hookFn)}`);
    }
    const resolvedTimeout = validateTimeout(timeout, bucket);
    currentSuite[bucket].push({ fn: hookFn, timeout: resolvedTimeout });
  };

  const beforeAll = registerHook('beforeAll');
  const afterAll = registerHook('afterAll');
  const beforeEach = registerHook('beforeEach');
  const afterEach = registerHook('afterEach');

  // ==========================================================================
  // 12. RUNNER
  // ==========================================================================

  const suiteHasOnly = (suite) => suite.tests.some(test => test.mode === 'only')
    || suite.suites.some(child => child.mode === 'only' || suiteHasOnly(child));

  const describeError = (error) => {
    if (error instanceof Error) return error.stack || `${error.name}: ${error.message}`;
    return `Non-error thrown: ${print(error)}`;
  };

  const errorMessage = (error) => (error instanceof Error ? error.message : `Non-error thrown: ${print(error)}`);

  const normalizeRunOptions = (options) => {
    let config = options;
    // Backwards compatibility: run(suiteObject) used to be the recursive entry point.
    if (config && Array.isArray(config.tests) && Array.isArray(config.suites)) {
      config = { suite: config };
    }
    config = config || {};
    return {
      suite: config.suite || rootSuite,
      silent: config.silent === true,
      reset: config.reset !== false,
      setExitCode: config.setExitCode !== false,
      exitOnFail: config.exitOnFail === true,
      throwOnFail: config.throwOnFail === true,
    };
  };

  const runHooks = async (hooks, phase, suiteName, onError) => {
    for (const hook of hooks) {
      try {
        const label = `${phase} hook${hook.fn.name ? ` "${hook.fn.name}"` : ''} in "${suiteName}"`;
        await withTimeout(() => hook.fn(), hook.timeout, label);
      } catch (error) {
        onError(error);
      }
    }
  };

  const runSuite = async (suite, context) => {
    const { parents, stats, options, inheritedError } = context;
    const log = options.silent ? () => {} : (...args) => console.log(...args);

    const suitePath = suite === context.rootRef ? [] : [...parents.map(p => p.name), suite.name];
    const skipped = context.skipped || suite.mode === 'skip';
    const focused = context.focused || suite.mode === 'only';

    if (suite !== context.rootRef) {
      log(`%c\nFOLDER: ${suite.name}`, 'font-weight: bold; color: #4A90E2;');
    }

    let suiteError = inheritedError;

    if (!skipped && !suiteError) {
      await runHooks(suite.beforeAll, 'beforeAll', suite.name, (error) => {
        if (!suiteError) suiteError = { phase: 'beforeAll', error, suite: suite.name };
      });
    }

    for (const test of suite.tests) {
      const testPath = [...suitePath, test.name].join(' > ');

      if (test.mode === 'todo') {
        log(`  %c📝 ${test.name} (todo)`, 'color: #9b59b6');
        stats.todo++;
        continue;
      }

      const isSkipped = skipped
        || test.mode === 'skip'
        || (context.globalOnly && !(focused || test.mode === 'only'));

      if (isSkipped) {
        log(`  %c⚪ ${test.name} (skipped)`, 'color: #95a5a6');
        stats.skip++;
        continue;
      }

      if (suiteError) {
        // A failed beforeAll invalidates every test in this block (and nested blocks).
        stats.fail++;
        stats.failures.push({
          test: testPath,
          phase: suiteError.phase,
          error: suiteError.error,
          message: errorMessage(suiteError.error),
        });
        if (!options.silent) {
          console.group(`  %c❌ ${test.name}`, 'color: #e74c3c');
          console.error(`Failed in ${suiteError.phase} hook of "${suiteError.suite}": ${errorMessage(suiteError.error)}`);
          console.groupEnd();
        }
        continue;
      }

      currentTestName = test.name;
      currentSuitePath = suitePath;
      snapshotIndex = 0;
      resetAssertionState();

      let failure = null;
      const recordFailure = (phase, error) => {
        if (!failure) failure = { phase, error };
      };

      const chain = [...parents, suite];

      try {
        for (const parentSuite of chain) {
          for (const hook of parentSuite.beforeEach) {
            if (failure) break;
            try {
              const label = `beforeEach hook${hook.fn.name ? ` "${hook.fn.name}"` : ''} for test "${testPath}"`;
              await withTimeout(() => hook.fn(), hook.timeout, label);
            } catch (error) {
              recordFailure('beforeEach', error);
            }
          }
          if (failure) break;
        }

        if (!failure) {
          try {
            await withTimeout(() => test.fn(), test.timeout, `Test "${testPath}"`);
          } catch (error) {
            recordFailure('test', error);
          }
        }

        // afterEach always runs (all of them), even after earlier failures.
        for (const parentSuite of [...chain].reverse()) {
          for (const hook of parentSuite.afterEach) {
            try {
              const label = `afterEach hook${hook.fn.name ? ` "${hook.fn.name}"` : ''} for test "${testPath}"`;
              await withTimeout(() => hook.fn(), hook.timeout, label);
            } catch (error) {
              recordFailure('afterEach', error);
            }
          }
        }

        // Assertion contracts are validated *after* afterEach so hook assertions count.
        if (!failure) {
          if (expectedAssertions !== null && assertionCount !== expectedAssertions) {
            recordFailure('test', new Error(
              `Expected ${expectedAssertions} assertions but saw ${assertionCount}`
            ));
          } else if (requiresAssertions && assertionCount === 0) {
            recordFailure('test', new Error('Expected at least one assertion to be called but received none'));
          }
        }
      } finally {
        // Automatic cleanup: spies restored, fake timers reverted.
        restoreAllMocks();
        if (isUsingFakeTimers) useRealTimers();
        currentTestName = '';
        currentSuitePath = [];
      }

      if (failure) {
        stats.fail++;
        stats.failures.push({
          test: testPath,
          phase: failure.phase,
          error: failure.error,
          message: errorMessage(failure.error),
        });
        if (!options.silent) {
          console.group(`  %c❌ ${test.name}`, 'color: #e74c3c');
          console.error(failure.phase === 'test'
            ? describeError(failure.error)
            : `Failed in ${failure.phase} hook: ${describeError(failure.error)}`);
          console.groupEnd();
        }
      } else {
        stats.pass++;
        log(`  %c✅ ${test.name}`, 'color: #2ecc71');
      }
    }

    for (const child of suite.suites) {
      await runSuite(child, {
        ...context,
        parents: suite === context.rootRef ? [] : [...parents, suite],
        skipped,
        focused,
        inheritedError: suiteError,
      });
    }

    if (!skipped) {
      await runHooks(suite.afterAll, 'afterAll', suite.name, (error) => {
        stats.fail++;
        stats.failures.push({
          test: `${suitePath.join(' > ') || 'root'} > afterAll hook`,
          phase: 'afterAll',
          error,
          message: errorMessage(error),
        });
        if (!options.silent) {
          console.error(`  ❌ afterAll hook failed in "${suite.name}": ${errorMessage(error)}`);
        }
      });
    }
  };

  /**
   * Executes the registered suite tree.
   * @param {Object} [options]
   * @param {Object}  [options.suite]        Suite to execute (defaults to the root suite).
   * @param {boolean} [options.silent]       Suppress console reporting.
   * @param {boolean} [options.reset]        Reset the root suite afterwards (default true).
   * @param {boolean} [options.setExitCode]  In Node, set process.exitCode = 1 on failure (default true).
   * @param {boolean} [options.exitOnFail]   In Node, hard-exit the process on failure (default false).
   * @param {boolean} [options.throwOnFail]  Throw an aggregated error on failure (default false).
   * @returns {Promise<Object>} stats { pass, fail, skip, todo, total, failures }
   */
  const run = async (options = {}) => {
    const config = normalizeRunOptions(options);
    const stats = { pass: 0, fail: 0, skip: 0, todo: 0, total: 0, failures: [] };
    const target = config.suite;

    await runSuite(target, {
      parents: [],
      stats,
      options: config,
      rootRef: target,
      skipped: false,
      focused: false,
      globalOnly: suiteHasOnly(target),
      inheritedError: null,
    });

    stats.total = stats.pass + stats.fail + stats.skip + stats.todo;

    if (!config.silent) {
      console.log('%c\n--------------------------------------', 'color: #7f8c8d');
      console.log(
        `%cTests:  %c${stats.fail} failed%c, %c${stats.pass} passed%c, %c${stats.skip} skipped%c, %c${stats.todo} todo%c, ${stats.total} total`,
        'font-weight: bold',
        stats.fail ? 'color: #e74c3c; font-weight: bold' : 'color: #7f8c8d',
        'color: #000',
        'color: #2ecc71; font-weight: bold',
        'color: #000',
        'color: #f1c40f; font-weight: bold',
        'color: #000',
        'color: #9b59b6; font-weight: bold',
        'color: #000'
      );
      console.log('%c--------------------------------------\n', 'color: #7f8c8d');
    }

    if (config.reset && target === rootSuite) {
      rootSuite = createSuite();
      currentSuite = rootSuite;
    }

    if (stats.fail > 0) {
      // Signal failure in a way CI can act on, without breaking browser usage.
      if (isNodeRuntime && config.setExitCode) process.exitCode = 1;
      if (isNodeRuntime && config.exitOnFail) process.exit(1);
      if (config.throwOnFail) {
        const summary = stats.failures.map(f => `  • ${f.test} (${f.phase}): ${f.message}`).join('\n');
        const error = new Error(`${stats.fail} test(s) failed:\n${summary}`);
        error.stats = stats;
        throw error;
      }
    }

    return stats;
  };

  /** Clears every registered suite/test without executing anything. */
  const resetSuites = () => {
    rootSuite = createSuite();
    currentSuite = rootSuite;
    return rootSuite;
  };

  const getRootSuite = () => rootSuite;

  // ==========================================================================
  // 13. WAIT-FOR
  // ==========================================================================

  /**
   * Asynchronously polls an assertion callback until it passes or times out.
   * @param {Function} callback - Assertion block; may be async.
   * @param {Object} [options]
   * @param {number} [options.timeout=1000]
   * @param {number} [options.interval=50]
   * @return {Promise<void>}
   */
  async function waitFor(callback, options = {}) {
    if (typeof callback !== 'function') {
      throw usageError(`waitFor expects a callback function, got ${print(callback)}`);
    }
    const timeout = options.timeout ?? 1000;
    const interval = options.interval ?? 50;
    const startTime = Date.now();
    const scheduler = nativeTimers ? nativeTimers.setTimeout : globalScope.setTimeout;

    let lastError = null;
    for (;;) {
      try {
        await callback();
        return;
      } catch (error) {
        lastError = error;
      }
      if (Date.now() - startTime >= timeout) {
        throw new Error(
          `waitFor timed out after ${timeout}ms. Last internal runner exception was: ${errorMessage(lastError)}`
        );
      }
      await new Promise(resolve => scheduler(resolve, interval));
    }
  }

  // ==========================================================================
  // 14. FAKE TIMERS
  // ==========================================================================

  const MAX_TIMER_ITERATIONS = 100000;

  let nativeTimers = null;
  let virtualClockTime = 0;
  let timerIdCounter = 0;
  let taskSequence = 0;
  let pendingVirtualTasks = new Map();
  let isUsingFakeTimers = false;

  class VirtualTask {
    constructor(callback, delay, isRecurring, args) {
      const numericDelay = Number(delay);
      const safeDelay = Number.isFinite(numericDelay) && numericDelay > 0 ? numericDelay : 0;
      this.id = ++timerIdCounter;
      this.sequence = ++taskSequence;
      this.callback = callback;
      // Recurring tasks are clamped to >= 1ms so zero-delay intervals cannot spin forever.
      this.delay = isRecurring ? Math.max(1, safeDelay) : safeDelay;
      this.isRecurring = isRecurring;
      this.args = args;
      this.cancelled = false;
      this.expiryTime = virtualClockTime + this.delay;
    }
  }

  const sortedTasks = () => [...pendingVirtualTasks.values()]
    .filter(task => !task.cancelled)
    .sort((a, b) => (a.expiryTime - b.expiryTime) || (a.sequence - b.sequence));

  const cancelTask = (id) => {
    const task = pendingVirtualTasks.get(id);
    if (task) {
      task.cancelled = true;
      pendingVirtualTasks.delete(id);
    }
  };

  const scheduleTask = (callback, delay, isRecurring, args) => {
    if (typeof callback !== 'function') {
      throw usageError(`Fake timers require a callback function, got ${print(callback)}`);
    }
    const task = new VirtualTask(callback, delay, isRecurring, args);
    pendingVirtualTasks.set(task.id, task);
    return task.id;
  };

  function useFakeTimers() {
    if (isUsingFakeTimers) return;
    nativeTimers = {
      setTimeout: globalScope.setTimeout,
      clearTimeout: globalScope.clearTimeout,
      setInterval: globalScope.setInterval,
      clearInterval: globalScope.clearInterval,
    };
    isUsingFakeTimers = true;
    virtualClockTime = 0;
    pendingVirtualTasks = new Map();

    globalScope.setTimeout = (cb, delay = 0, ...args) => scheduleTask(cb, delay, false, args);
    globalScope.setInterval = (cb, delay = 0, ...args) => scheduleTask(cb, delay, true, args);
    globalScope.clearTimeout = (id) => cancelTask(id);
    globalScope.clearInterval = (id) => cancelTask(id);
  }

  function useRealTimers() {
    if (!isUsingFakeTimers) return;
    isUsingFakeTimers = false;
    if (nativeTimers) {
      globalScope.setTimeout = nativeTimers.setTimeout;
      globalScope.clearTimeout = nativeTimers.clearTimeout;
      globalScope.setInterval = nativeTimers.setInterval;
      globalScope.clearInterval = nativeTimers.clearInterval;
    }
    pendingVirtualTasks = new Map();
  }

  const assertFakeTimers = (apiName) => {
    if (!isUsingFakeTimers) {
      throw usageError(`Fake timers are not enabled. Call jest.useFakeTimers() before ${apiName}().`);
    }
  };

  /** Executes a single task, handling re-queueing of intervals and cancellation. */
  const executeTask = (task) => {
    virtualClockTime = task.expiryTime;
    if (task.isRecurring) {
      task.expiryTime = virtualClockTime + task.delay;
    } else {
      pendingVirtualTasks.delete(task.id);
    }
    // Exceptions propagate to the caller (Jest-like); clock state stays consistent.
    task.callback(...task.args);
  };

  function advanceTimersByTime(ms) {
    assertFakeTimers('advanceTimersByTime');
    const step = Number(ms);
    const targetTime = virtualClockTime + (Number.isFinite(step) && step > 0 ? step : 0);
    let iterations = 0;

    for (;;) {
      const [next] = sortedTasks();
      if (!next || next.expiryTime > targetTime) break;
      if (++iterations > MAX_TIMER_ITERATIONS) {
        throw new Error(
          `Aborting after running ${MAX_TIMER_ITERATIONS} timers, assuming an infinite loop.`
        );
      }
      executeTask(next);
    }

    virtualClockTime = targetTime;
  }

  function runAllTimers() {
    assertFakeTimers('runAllTimers');
    let iterations = 0;
    for (;;) {
      const [next] = sortedTasks();
      if (!next) break;
      if (++iterations > MAX_TIMER_ITERATIONS) {
        throw new Error(
          `Aborting after running ${MAX_TIMER_ITERATIONS} timers, assuming an infinite loop.`
        );
      }
      executeTask(next);
    }
  }

  function runOnlyPendingTimers() {
    assertFakeTimers('runOnlyPendingTimers');
    // Snapshot: timers scheduled by these callbacks are not executed in this pass.
    const snapshot = sortedTasks();
    for (const task of snapshot) {
      if (task.cancelled || !pendingVirtualTasks.has(task.id)) continue;
      executeTask(task);
    }
  }

  function advanceTimersToNextTimer(steps = 1) {
    assertFakeTimers('advanceTimersToNextTimer');
    for (let i = 0; i < steps; i++) {
      const [next] = sortedTasks();
      if (!next) break;
      executeTask(next);
    }
  }

  function clearAllTimers() {
    pendingVirtualTasks = new Map();
  }

  function getTimerCount() {
    return sortedTasks().length;
  }

  const getTimerTime = () => virtualClockTime;

  // ==========================================================================
  // 15. MODULE REGISTRY (explicit registry — NOT an import interceptor)
  // ==========================================================================

  const moduleRegistry = new Map();

  /**
   * Registers mock exports under a module name. Real `import`/`require` calls are
   * NOT intercepted; consumers must fetch the mock via jest.requireMock/getMock
   * (or read the global alias when the name is a valid identifier).
   */
  const registerMock = (moduleName, factory) => {
    if (typeof moduleName !== 'string' || moduleName.length === 0) {
      throw usageError(`jest.mock expects a module name string, got ${print(moduleName)}`);
    }
    if (factory !== undefined && typeof factory !== 'function') {
      throw usageError(`jest.mock expects a factory function, got ${print(factory)}`);
    }
    const mockExports = factory ? factory() : {};
    moduleRegistry.set(moduleName, mockExports);
    try {
      // Convenience global alias (kept for backwards compatibility).
      globalScope[moduleName] = mockExports;
    } catch (e) { /* frozen/readonly globals are simply skipped */ }
    return mockExports;
  };

  const getMock = (moduleName) => {
    if (!moduleRegistry.has(moduleName)) {
      throw usageError(
        `Module "${moduleName}" is not mocked. Register it first with jest.mock("${moduleName}", factory).`
      );
    }
    return moduleRegistry.get(moduleName);
  };

  const hasMock = (moduleName) => moduleRegistry.has(moduleName);

  const unmock = (moduleName) => moduleRegistry.delete(moduleName);

  const resetModuleRegistry = () => moduleRegistry.clear();

  // ==========================================================================
  // 16. PUBLIC SURFACE
  // ==========================================================================

  const jest = {
    // DSL
    describe,
    it,
    test,
    expect,
    run,
    resetSuites,
    getRootSuite,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,

    // Mocking
    fn,
    spyOn,
    clearAllMocks,
    resetAllMocks,
    restoreAllMocks,

    // Matchers
    extendExpect,
    AssertionError: JestLiteAssertionError,

    // Async helpers
    waitFor,

    // Timers
    useFakeTimers,
    useRealTimers,
    advanceTimersByTime,
    advanceTimersToNextTimer,
    runAllTimers,
    runOnlyPendingTimers,
    clearAllTimers,
    getTimerCount,
    getTimerTime,

    // Module registry
    mock: registerMock,
    registerMock,
    requireMock: getMock,
    getMock,
    hasMock,
    unmock,
    resetModuleRegistry,
  };

  Object.assign(globalScope, {
    jest,
    describe,
    it,
    test,
    expect,
    run,
    waitFor,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
  });
})();

// Native modern ES Module exports layout
export const {
  describe,
  it,
  test,
  expect,
  run,
  resetSuites,
  getRootSuite,
  fn,
  spyOn,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  extendExpect,
  AssertionError,
  waitFor,
  mock,
  registerMock,
  requireMock,
  getMock,
  hasMock,
  unmock,
  resetModuleRegistry,
  clearAllMocks,
  resetAllMocks,
  restoreAllMocks,
  useFakeTimers,
  useRealTimers,
  advanceTimersByTime,
  advanceTimersToNextTimer,
  runAllTimers,
  runOnlyPendingTimers,
  clearAllTimers,
  getTimerCount,
  getTimerTime,
} = jest;

// Provide a clean default bundle export configuration mapping
export default jest;
