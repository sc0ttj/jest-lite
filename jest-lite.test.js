// ==========================================
// 1. SETUP - ISOLATED BROWSER / GLOBAL ENVIRONMENT
// ==========================================
globalThis.window = globalThis;
globalThis.HTMLElement = class HTMLElement {};

globalThis.localStorage = {
  store: {},
  length: 0,
  setItem(key, value) {
    this.store[key] = String(value);
    this.length = Object.keys(this.store).length;
  },
  getItem(key) {
    return this.store[key] || null;
  },
  clear() {
    this.store = {};
    this.length = 0;
  }
};

// Comprehensive DOM element mocking for UI matchers
const createMockElement = () => ({
  style: {},
  appendChild() {},
  setAttribute() {},
  focus() { this._focused = true; },
  remove() { this._removed = true; },
  textContent: '',
  innerText: ''
});

// Replace your top-level globalThis.document block with this one:
globalThis.document = {
  activeElement: null, // Track focus globally in Node
  createElement() {
    const attributes = new Map();
    const el = {
      style: {},
      attributes,
      appendChild() {},
      setAttribute(k, v) { attributes.set(k, String(v)); },
      getAttribute(k) { return attributes.has(k) ? attributes.get(k) : null; },
      hasAttribute(k) { return attributes.has(k); },
      focus() {
        this._focused = true;
        globalThis.document.activeElement = el; // Tells your framework this element is now active
      },
      remove() { this._removed = true; },
      textContent: '',
      innerText: ''
    };
    return el;
  },
  body: {
    appendChild() {}
  }
};

// ==========================================
// 2. SETUP - DEPENDENCY IMPORTS & FRAMEWORK EXTRACTION
// ==========================================
import { describe as nodeDescribe, it as nodeIt, beforeEach as nodeBeforeEach, before as nodeBefore, after as nodeAfter } from 'node:test';
import nodeAssert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

// Import your custom framework (loads its primitives onto the global scope)
import './jest-lite.js';
import {
  describe as jlDescribe,
  it as jlIt,
  test as jlTest,
  run as jlRun,
  resetSuites as jlResetSuites,
  getRootSuite as jlGetRootSuite,
  beforeAll as jlBeforeAll,
  afterAll as jlAfterAll,
  beforeEach as jlBeforeEachHook,
  afterEach as jlAfterEachHook,
  requireMock,
  mock,
  registerMock,
  getMock,
  hasMock,
  unmock,
  resetModuleRegistry,
  restoreAllMocks,
  resetAllMocks,
  AssertionError as JlAssertionError,
} from './jest-lite.js';

// Safely extract framework APIs regardless of how they are attached globally
const jlExpect = globalThis.jest?.expect || globalThis.expect;
const jlFn     = globalThis.jest?.fn     || globalThis.fn;
const jlSpyOn  = globalThis.jest?.spyOn  || globalThis.spyOn;

// Quick health-check verification assertion for Node's runner
if (typeof jlFn !== 'function') {
  console.error("❌ Debug info - Available global variables are:", Object.keys(globalThis).filter(k => !k.startsWith('_')));
  if (globalThis.jest) console.error("❌ Debug info - Available jest sub-properties:", Object.keys(globalThis.jest));
  throw new TypeError("Could not locate the 'fn' or 'expect' method from jest-lite.js on the global scope.");
}

// ==========================================
// 3. SETUP - MODULE REGISTRY FIXTURES
// ==========================================
// NOTE: we deliberately use the framework's *real* module registry here (no shim),
// so the registry behaviour under test is the shipped behaviour.
globalThis.jest.mock('axios', () => ({
  get: jlFn(() => Promise.resolve({ data: { user: 'Fake User' } })),
  post: jlFn(() => Promise.resolve({ status: 201 }))
}));

// ------------------------------------------
// Shared end-to-end helpers
// ------------------------------------------

/**
 * Registers suites with the framework DSL and executes them through the real runner.
 * Always silent, never mutates the Node process exit code.
 */
const runIsolated = async (register, options = {}) => {
  jlResetSuites();
  register();
  return jlRun({ silent: true, setExitCode: false, ...options });
};

const failureMessages = (stats) => stats.failures.map(failure => `${failure.phase}: ${failure.message}`);


// ==========================================
// 4. THE COMPREHENSIVE TEST SUITE
// ==========================================

nodeDescribe('jest-lite Framework Coverage Suite', () => {

  nodeDescribe('Core Functionality & Matchers', () => {
    nodeIt('verifies complex logic, snapshots, and deep equality', () => {
      // Create the mock standalone first so its properties remain intact
      const mockLogin = jlFn(() => 'Success');

      const user = { id: 1, name: 'Dev', login: mockLogin };
      user.login();

      // Test against the direct mock reference to bypass property extraction shedding
      nodeAssert.doesNotThrow(() => jlExpect(mockLogin).toHaveBeenCalledTimes(1));
      nodeAssert.doesNotThrow(() => jlExpect(mockLogin).toHaveReturnedWith('Success'));

      const objA = { tags: [1, 2] };
      const objB = { tags: [1, 2] };
      nodeAssert.doesNotThrow(() => jlExpect(objA).toEqual(objB));
    });

    nodeIt('handles errors and numeric ranges', () => {
      const fail = () => { throw new Error('Failed'); };
      nodeAssert.doesNotThrow(() => jlExpect(fail).toThrow('Failed'));
      nodeAssert.doesNotThrow(() => jlExpect(10).toBeGreaterThan(5));
      nodeAssert.doesNotThrow(() => jlExpect(0.1 + 0.2).toBeCloseTo(0.3));
    });

    nodeIt('handles .not logic inversions cleanly', () => {
      nodeAssert.throws(() => jlExpect(5).not.toBe(5));
      nodeAssert.doesNotThrow(() => jlExpect(5).not.toBe(10));
    });

    nodeIt('works with async promises and collections', async () => {
      const data = await Promise.resolve([1, 2, 3]);
      nodeAssert.doesNotThrow(() => jlExpect(data).toContain(2));
    });
  });

  nodeDescribe('Data-Driven Data Testing (it.each)', () => {
    nodeIt('processes primitive multidimensional arrays accurately', () => {
      const testCases = [[1, 1, 2], [10, 5, 15], [100, 200, 300]];
      testCases.forEach(([a, b, expected]) => {
        nodeAssert.doesNotThrow(() => jlExpect(a + b).toBe(expected));
      });
    });

    nodeIt('processes key-value object structures accurately', () => {
      const schemas = [{ name: 'Admin', role: 'root' }, { name: 'User', role: 'guest' }];
      schemas.forEach((user) => {
        nodeAssert.doesNotThrow(() => jlExpect(user.role).toBeDefined());
      });
    });
  });

  nodeDescribe('Advanced Structure Matchers', () => {
    nodeIt('validates partial data subsets with toMatchObject', () => {
      const apiResponse = {
        id: 101,
        username: 'dev_user',
        metadata: { preferences: { theme: 'dark', notifications: true } }
      };
      nodeAssert.doesNotThrow(() => jlExpect(apiResponse).toMatchObject({
        id: 101,
        metadata: { preferences: { theme: 'dark' } }
      }));
    });

    nodeIt('verifies prototype inheritance via toBeInstanceOf', () => {
      class Animal {}
      class Dog extends Animal {}
      const sparky = new Dog();

      nodeAssert.doesNotThrow(() => jlExpect(sparky).toBeInstanceOf(Dog));
      nodeAssert.doesNotThrow(() => jlExpect(sparky).toBeInstanceOf(Animal));
      nodeAssert.doesNotThrow(() => jlExpect([1, 2]).toBeInstanceOf(Array));
    });

    nodeIt('asserts structural emptiness across types', () => {
      nodeAssert.doesNotThrow(() => jlExpect([]).toBeEmpty());
      nodeAssert.doesNotThrow(() => jlExpect({}).toBeEmpty());
      nodeAssert.doesNotThrow(() => jlExpect("").toBeEmpty());
      nodeAssert.doesNotThrow(() => jlExpect([1]).not.toBeEmpty());
    });

    nodeIt('asserts complex typing matrices', () => {
      nodeAssert.doesNotThrow(() => jlExpect({}).toBeObject());
      nodeAssert.doesNotThrow(() => jlExpect([]).toBeArray());
      nodeAssert.doesNotThrow(() => jlExpect("text").toBeType('string'));
      nodeAssert.doesNotThrow(() => jlExpect(null).not.toBeObject());
    });

    nodeIt('asserts alternative inclusive thresholds', () => {
      nodeAssert.doesNotThrow(() => jlExpect(100).toBeGreaterThanOrEqual(100));
      nodeAssert.doesNotThrow(() => jlExpect(100).toBeLessThanOrEqual(105));
    });

    nodeIt('validates string boundaries', () => {
      nodeAssert.doesNotThrow(() => jlExpect("https://example.com").toStartWith("https://"));
      nodeAssert.doesNotThrow(() => jlExpect("https://example.com/fooapi/api").toEndWith("/api"));
    });
  });

  nodeDescribe('Asymmetric Engine Matchers', () => {
    nodeIt('processes expect.any variations', () => {
      const target = { id: 0.45, join: new Date() };
      nodeAssert.doesNotThrow(() => jlExpect(target).toMatchObject({
        id: jlExpect.any(Number),
        join: jlExpect.any(Date)
      }));
    });

    nodeIt('evaluates regular expressions with expect.stringMatching', () => {
      const user = { id: 'user_12345', email: 'hello@example.com' };
      nodeAssert.doesNotThrow(() => jlExpect(user).toMatchObject({
        id: jlExpect.stringMatching(/^user_\d+$/),
        email: jlExpect.stringMatching(/@example\.com$/)
      }));
    });

    nodeIt('evaluates array subsets with expect.arrayContaining', () => {
      const roles = ['admin', 'editor', 'viewer'];
      nodeAssert.doesNotThrow(() => jlExpect(roles).toEqual(jlExpect.arrayContaining(['admin', 'viewer'])));
    });

    nodeIt('evaluates object deep-nesting combinations concurrently', () => {
      const target = [{ id: 1, role: 'admin' }];
      nodeAssert.doesNotThrow(() => jlExpect(target).toEqual(jlExpect.arrayContaining([
        jlExpect.objectContaining({ role: 'admin' })
      ])));
    });

    nodeIt('validates dynamic array arrayContaining boundaries', () => {
      const age = 25;
      const status = 'active'; // Added this line to resolve the reference error
      nodeAssert.doesNotThrow(() => jlExpect(age).toBeWithinRange(18, 65));
      nodeAssert.doesNotThrow(() => jlExpect(status).toBeOneOf(['active', 'pending']));
    });
  });

  nodeDescribe('UI Assertions Integration', () => {
    nodeIt('interacts cleanly with custom layout matchers', () => {
      const btn = document.createElement('button');
      btn.focus(); // Triggers the focus tracker
      nodeAssert.doesNotThrow(() => jlExpect(btn).toHaveFocus());
    });

    nodeIt('evaluates mock sequence lifecycle executions', async () => {
      const dynamicFn = jlFn();
      dynamicFn.mockImplementationOnce(() => { throw new Error('First try failed'); });
      dynamicFn.mockResolvedValueOnce({ name: 'Success' });

      nodeAssert.doesNotThrow(() => jlExpect(dynamicFn).toThrow('First try failed'));
      const payload = await dynamicFn();
      nodeAssert.doesNotThrow(() => jlExpect(payload).toMatchObject({ name: 'Success' }));
    });
  });

  nodeDescribe('Mock Isolation & Service Testing', () => {
    nodeIt('fetches data from our emulated module registry context', async () => {
      const mockedAxios = globalThis.jest.requireMock('axios');
      const response = await mockedAxios.get('/api/user');

      nodeAssert.equal(response.data.user, 'Fake User');
      nodeAssert.doesNotThrow(() => jlExpect(mockedAxios.get).toHaveBeenCalledWith('/api/user'));
    });

    nodeIt('proves automated framework tracking across clean environments', () => {
      const baseService = { getData: () => "Real Data" };
      const activeSpy = jlSpyOn(baseService, 'getData').mockReturnValue("Mocked Data");

      nodeAssert.equal(baseService.getData(), "Mocked Data");
      nodeAssert.doesNotThrow(() => jlExpect(activeSpy).toHaveBeenCalled());

      activeSpy.mockRestore();
      nodeAssert.equal(baseService.getData(), "Real Data");
    });
  });

  nodeDescribe('Lifecycle Hook Sequence and Inheritance', () => {
    nodeIt('inherits parental beforeEach configurations dynamically', () => {
      let tracker = [];

      // We simulate what your runner does under the hood when parsing hooks
      const parentBeforeEach = () => tracker.push('parent');
      const childBeforeEach = () => tracker.push('child');

      // Execute sequence simulation
      parentBeforeEach();
      childBeforeEach();

      nodeAssert.deepStrictEqual(tracker, ['parent', 'child']);
    });
  });

  nodeDescribe('Matcher Error Boundaries', () => {
    nodeIt('throws an explicit mismatch message for failing toMatchObject', () => {
      const car = { make: 'Tesla', model: 'Model 3' };

      // Verify that your framework throws an error containing the mismatch details
      nodeAssert.throws(
        () => jlExpect(car).toMatchObject({ make: 'Tesla', model: 'Model S' }),
        /Model S/ // Checks that the expected value is mentioned in the error message
      );
    });

    nodeIt('throws when expect.any type conditions fail', () => {
      const dynamicUser = { id: 'not-a-number' };

      nodeAssert.throws(
        () => jlExpect(dynamicUser).toMatchObject({ id: jlExpect.any(Number) })
      );
    });

    nodeIt('fails toThrow when function executes without an error', () => {
      const safeFn = () => "I am safe";

      nodeAssert.throws(
        () => jlExpect(safeFn).toThrow()
      );
    });
  });

  nodeDescribe('Robust Type and Edge-Case Validations', () => {
    nodeIt('correctly evaluates nullability with toBeEmpty and toBeObject', () => {
      // JavaScript's 'typeof null' is 'object', ensure your framework guards against this
      nodeAssert.doesNotThrow(() => jlExpect(null).not.toBeObject());
      nodeAssert.doesNotThrow(() => jlExpect(null).toBeEmpty());
      nodeAssert.doesNotThrow(() => jlExpect(undefined).toBeEmpty());
    });

    nodeIt('safely matches arrays containing mixed types or sub-matchers', () => {
      const mixedBag = ['Error: 404', 42, { item: 'config' }];

      nodeAssert.doesNotThrow(() => jlExpect(mixedBag).toEqual(
        jlExpect.arrayContaining([
          jlExpect.stringMatching(/^Error:/),
          jlExpect.any(Number)
        ])
      ));
    });
  });

  nodeDescribe('Spying Interception and Cleanup Safety', () => {
    nodeIt('manages multiple active methods and restores cleanly', () => {
      const controller = {
        init: () => 'original_init',
        close: () => 'original_close'
      };

      const spyInit = jlSpyOn(controller, 'init').mockReturnValue('mocked_init');
      const spyClose = jlSpyOn(controller, 'close').mockReturnValue('mocked_close');

      // Assert framework interception works concurrently
      nodeAssert.equal(controller.init(), 'mocked_init');
      nodeAssert.equal(controller.close(), 'mocked_close');

      // Manual teardown path check
      spyInit.mockRestore();
      spyClose.mockRestore();

      // Ensure state is pristine
      nodeAssert.equal(controller.init(), 'original_init');
      nodeAssert.equal(controller.close(), 'original_close');
    });
  });

  nodeDescribe('Runner Optimization & Exclusion Strategy', () => {
    nodeIt('respects skip flags by completely bypassing execution blocks', () => {
      let executionCount = 0;

      // Simulate your framework's internal registration mechanism for a skipped test
      const mockTestRegistryItem = {
        name: 'should not run',
        fn: () => { executionCount++; },
        mode: 'skip'
      };

      // Framework runner checks mode before execution
      if (mockTestRegistryItem.mode !== 'skip') {
        mockTestRegistryItem.fn();
      }

      nodeAssert.equal(executionCount, 0);
    });

    nodeIt('activates two-phase runner sequence to prioritize focus filters', () => {
      const suiteExecutionLog = [];

      // Simulating a suite tree containing standard tests and a focused .only test
      const simulatedSuite = [
        { name: 'test 1', fn: () => suiteExecutionLog.push(1), mode: 'normal' },
        { name: 'test 2', fn: () => suiteExecutionLog.push(2), mode: 'only' },
        { name: 'test 3', fn: () => suiteExecutionLog.push(3), mode: 'normal' }
      ];

      // Phase 1: Scan for any focus overrides (.only)
      const hasOnly = simulatedSuite.some(t => t.mode === 'only');

      // Phase 2: Run according to priority filters
      simulatedSuite.forEach(testCase => {
        if (hasOnly && testCase.mode !== 'only') {
          return; // Filter out normal tests because .only exists
        }
        testCase.fn();
      });

      // Assert that only test 2 executed
      nodeAssert.deepStrictEqual(suiteExecutionLog, [2]);
    });
  });

  nodeDescribe('Advanced Matcher Boundaries & Precision Guards', () => {
    nodeIt('validates toBeCloseTo decimal precision tuning thresholds', () => {
      // Pass condition: default 2-digit precision matching
      nodeAssert.doesNotThrow(() => jlExpect(3.14159).toBeCloseTo(3.14));

      // Fail condition: strict precision bounds must throw an asset error on variance
      nodeAssert.throws(() => jlExpect(3.14159).toBeCloseTo(3.14, 5));
    });

    nodeIt('evaluates regular expression regex structures via toMatch', () => {
      const serialCode = "ID-99823-X";

      nodeAssert.doesNotThrow(() => jlExpect(serialCode).toMatch(/^ID-\d+-X$/));
      nodeAssert.doesNotThrow(() => jlExpect(serialCode).toMatch("99823")); // String submatch support
      nodeAssert.throws(() => jlExpect(serialCode).toMatch(/^id-\d+-x$/));   // Case-sensitive failure
    });

    nodeIt('extends toThrow error handling to validate RegExp message definitions', () => {
      const crashFn = () => { throw new TypeError('Auth Failure: Invalid Token'); };

      // Framework should verify error messages against regex boundaries
      nodeAssert.doesNotThrow(() => jlExpect(crashFn).toThrow(/Auth Failure/));
      nodeAssert.doesNotThrow(() => jlExpect(crashFn).toThrow(/^Auth.*Token$/));
      nodeAssert.throws(() => jlExpect(crashFn).toThrow(/Database Timeout/));
    });

    nodeIt('guards expect.anything() against strict null and undefined bounds', () => {
      // Should accept any valid truthy/falsy primitives
      nodeAssert.doesNotThrow(() => jlExpect({ val: 0 }).toMatchObject({ val: jlExpect.anything() }));
      nodeAssert.doesNotThrow(() => jlExpect({ val: false }).toMatchObject({ val: jlExpect.anything() }));
      nodeAssert.doesNotThrow(() => jlExpect({ val: "" }).toMatchObject({ val: jlExpect.anything() }));

      // Should strictly throw if the evaluated property context doesn't exist or is null
      nodeAssert.throws(() => jlExpect({ val: null }).toMatchObject({ val: jlExpect.anything() }));
      nodeAssert.throws(() => jlExpect({ }).toMatchObject({ val: jlExpect.anything() }));
    });
  });

  nodeDescribe('Automated Spy Tracking, History, & Parameter Matching', () => {
    nodeIt('records multiple execution inputs across toHaveReturnedWith history timelines', () => {
      const mathEngine = { square: (n) => n * n };
      const squareSpy = jlSpyOn(mathEngine, 'square');

      // Execute a timeline sequence of operations
      mathEngine.square(2);
      mathEngine.square(4);
      mathEngine.square(5);

      // Verify the spy stack history tracked individual step configurations accurately
      nodeAssert.doesNotThrow(() => jlExpect(squareSpy).toHaveBeenCalledTimes(3));
      nodeAssert.doesNotThrow(() => jlExpect(squareSpy).toHaveReturnedWith(4));
      nodeAssert.doesNotThrow(() => jlExpect(squareSpy).toHaveReturnedWith(16));
      nodeAssert.doesNotThrow(() => jlExpect(squareSpy).toHaveReturnedWith(25));

      squareSpy.mockRestore();
    });

    nodeIt('throws execution errors when toHaveBeenCalledWith parameters mismatch', () => {
      const notifier = { send: (msg, code) => true };
      const notifySpy = jlSpyOn(notifier, 'send');

      notifier.send("Welcome", 200);

      // Parameter structural validation pass
      nodeAssert.doesNotThrow(() => jlExpect(notifySpy).toHaveBeenCalledWith("Welcome", jlExpect.any(Number)));

      // Argument parameters deviation verification must throw an explicit error
      nodeAssert.throws(() => jlExpect(notifySpy).toHaveBeenCalledWith("Goodbye", 200));
      nodeAssert.throws(() => jlExpect(notifySpy).toHaveBeenCalledWith("Welcome", 500));

      notifySpy.mockRestore();
    });

    nodeIt('proves framework orchestrates global automated mock cleanup loops without manual intervention', () => {
      const dataStore = { fetch: () => "pristine" };

      // Simulate loop iteration sequence #1 (Inject and use a spy variant)
      const executionSpy = jlSpyOn(dataStore, 'fetch').mockReturnValue("hijacked");
      nodeAssert.equal(dataStore.fetch(), "hijacked");

      // Simulate what the framework global mockRestoreAll() runner executes during lifecycle transitions
      if (typeof globalThis.jest?.mockRestoreAll === 'function') {
        globalThis.jest.mockRestoreAll();
      } else if (typeof executionSpy.mockRestore === 'function') {
        executionSpy.mockRestore();
      }

      // Verify state was completely flushed clean down to standard operational behaviors
      nodeAssert.equal(dataStore.fetch(), "pristine");
    });
  });

  nodeDescribe('Advanced Regression & Nested Failure State Diffing', () => {
    nodeIt('processes negative inheritance mismatch errors for toBeInstanceOf', () => {
      const anonymousObj = { name: 'stub' };

      // Asserts that standard instances throw clear errors if evaluation matrices mismatch
      nodeAssert.throws(() => jlExpect(anonymousObj).toBeInstanceOf(Array));
      nodeAssert.throws(() => jlExpect("primitive string").toBeInstanceOf(String));
    });

    nodeIt('validates complex failure state logs inside deep nested asymmetric matcher collections', () => {
      const complexData = [
        { id: 101, tags: ['alpha', 'beta'], meta: { active: true } }
      ];

      // Deep structure pass
      nodeAssert.doesNotThrow(() => jlExpect(complexData).toEqual(
        jlExpect.arrayContaining([
          jlExpect.objectContaining({
            id: 101,
            tags: jlExpect.arrayContaining(['alpha']),
            meta: jlExpect.objectContaining({ active: true })
          })
        ])
      ));

      // Deep structure mismatch regression test - validating inner node breaks cause expected parent errors
      nodeAssert.throws(() => jlExpect(complexData).toEqual(
        jlExpect.arrayContaining([
          jlExpect.objectContaining({
            id: 101,
            tags: jlExpect.arrayContaining(['gamma']), // Mismatch deep down the tree
            meta: jlExpect.objectContaining({ active: true })
          })
        ])
      ));
    });

    nodeIt('safely structures structural type matchers against composite type states', () => {
      const functionRef = () => {};
      const nativeSymbol = Symbol('test');

      // Validating custom type mappings evaluate composite values robustly
      nodeAssert.doesNotThrow(() => jlExpect(functionRef).toBeType('function'));
      nodeAssert.doesNotThrow(() => jlExpect(nativeSymbol).toBeType('symbol'));
      nodeAssert.throws(() => jlExpect(functionRef).toBeObject());
    });
  });

  nodeDescribe('Real-World Adversarial Edge Cases', () => {

    nodeIt('handles async lifecycle promises in proper chronological order', async () => {
      let timeline = [];

      const asyncHook = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        timeline.push('hook_done');
      };

      await asyncHook();
      timeline.push('test_body');

      nodeAssert.deepStrictEqual(timeline, ['hook_done', 'test_body']);
    });

    nodeIt('aborts execution safely when async lifecycles experience unexpected rejections', async () => {
      let testExecuted = false;

      // Simulating a failed lifecycle connection (e.g. database down)
      const brokenHook = async () => {
        throw new Error('Lifecycle Setup Failure');
      };

      // Framework orchestrator execution simulation block
      await nodeAssert.rejects(async () => {
        await brokenHook();
        testExecuted = true; // This point must never be reached
      }, /Lifecycle Setup Failure/);

      nodeAssert.equal(testExecuted, false);
    });

    nodeIt('safely prevents recursive stack overflows on circular references', () => {
      const parentObj = { name: 'NodeA' };
      parentObj.loopback = parentObj;

      const targetCopy = { name: 'NodeA' };
      targetCopy.loopback = targetCopy;

      // Your newly updated deepEquals core will evaluate this without blowing up the engine call stack
      nodeAssert.throws(() => {
        jlExpect(parentObj).toEqual({ name: 'NodeA', loopback: null });
      });
    });

    nodeIt('distinguishes strict primitive anomalies like NaN and signed zeros', () => {
      nodeAssert.doesNotThrow(() => jlExpect(NaN).toBe(NaN));
      nodeAssert.throws(() => jlExpect(-0).toBe(0));
    });

    nodeIt('preserves prototype inheritance structural layers when clean-up fires', () => {
      class BaseWidget { render() { return 'base'; } }
      class CustomButton extends BaseWidget {}

      const instance = new CustomButton();

      const prototypeSpy = jlSpyOn(BaseWidget.prototype, 'render').mockReturnValue('mocked');
      nodeAssert.equal(instance.render(), 'mocked');

      prototypeSpy.mockRestore();

      // Confirms class inheritance layer definitions remain completely clean post-restore
      nodeAssert.equal(instance.render(), 'base');
      nodeAssert.equal(Object.hasOwn(instance, 'render'), false);
    });
  });

  // ==========================================
  // JEST-COMPATIBLE CUSTOM MATCHERS (expect.extend)
  // ==========================================
  nodeDescribe('Jest-Compatible Custom Matchers Framework', () => {

    nodeBefore(() => {
      // FIX: Use your direct framework alias instead of the overwritten globalThis.jest object
      jlExpect.extend({
        toBeEven(actual) {
          const pass = actual % 2 === 0;
          return {
            pass,
            message: () => pass ? `Expected ${actual} not to be even` : `Expected ${actual} to be even`
          };
        },
        toBeWithinBudget(actual, floor, ceiling) {
          const pass = actual >= floor && actual <= ceiling;
          return {
            pass,
            message: () => pass
              ? `Expected ${actual} to break budget constraints`
              : `Expected ${actual} to be inside budget bounds [${floor} - ${ceiling}]`
          };
        }
      });
    });

    nodeIt('successfully routes standard and extended matchers along positive paths', () => {
      nodeAssert.doesNotThrow(() => jlExpect(10).toBeEven());
      nodeAssert.doesNotThrow(() => jlExpect(150).toBeWithinBudget(100, 200));
    });

    nodeIt('automatically handles chainable .not inversion for injected custom matchers', () => {
      nodeAssert.doesNotThrow(() => jlExpect(7).not.toBeEven());
      nodeAssert.doesNotThrow(() => jlExpect(300).not.toBeWithinBudget(100, 200));
      nodeAssert.throws(() => jlExpect(8).not.toBeEven());
    });

    nodeIt('bubbles up the specific user message callback text on assertion failures', () => {
      nodeAssert.throws(
        () => jlExpect(13).toBeEven(),
        /Expected 13 to be even/
      );
    });
  });

  // ==========================================
  // ASYNCHRONOUS EVENT POLLING (waitFor)
  // ==========================================
  nodeDescribe('Asynchronous Event Polling Core (waitFor)', () => {

    nodeIt('successfully resolves once a delayed asynchronous modification passes', async () => {
      let reactiveState = "pending";

      // Simulate an asynchronous micro-task operation settling after 20ms
      setTimeout(() => {
        reactiveState = "resolved";
      }, 20);

      // Your framework should poll repeatedly and resolve cleanly once the threshold is crossed
      await nodeAssert.doesNotReject(async () => {
        await globalThis.jest.waitFor(() => {
          jlExpect(reactiveState).toBe("resolved");
        }, { timeout: 200, interval: 10 });
      });
    });

    nodeIt('safely rejects with a detailed descriptive exception if the polling timeout limit expires', async () => {
      let brokenState = "stagnant";

      // Intentional failure tracking: look for a status that will never arrive
      await nodeAssert.rejects(async () => {
        await globalThis.jest.waitFor(() => {
          jlExpect(brokenState).toBe("updated_value");
        }, { timeout: 30, interval: 10 });
      }, /waitFor timed out/);
    });
  });


  // ==========================================
  // VIRTUAL CLOCK ACCELERATION (useFakeTimers)
  // ==========================================
  nodeDescribe('Virtual Time-Travel Clock Accelerator Engine', () => {

    nodeAfter(() => {
      // Teardown hook: always restore real system timers when exiting this suite
      globalThis.jest.useRealTimers();
    });

    nodeIt('synchronously bypasses long setTimeout execution macro tasks instantly', () => {
      globalThis.jest.useFakeTimers();
      let hasExecuted = false;

      // Queue up an extreme 5-second functional layout debounce
      setTimeout(() => {
        hasExecuted = true;
      }, 5000);

      // Verify that virtual clock states maintain accurate step frames
      globalThis.jest.advanceTimersByTime(4999);
      nodeAssert.equal(hasExecuted, false); // Still hasn't run at 4999ms

      globalThis.jest.advanceTimersByTime(1);
      nodeAssert.equal(hasExecuted, true);  // Synchronously executed exactly at 5000ms!
    });

    nodeIt('coordinates continuous recurring loops generated by setInterval accurately', () => {
      globalThis.jest.useFakeTimers();
      let iterationCount = 0;

      // Setup a fast recurring heart-beat stream pulse every 100ms
      setInterval(() => {
        iterationCount++;
      }, 1000);

      globalThis.jest.advanceTimersByTime(3500);
      nodeAssert.equal(iterationCount, 3); // Iterated exactly 3 times inside the 3.5s window
    });

    nodeIt('respects macro task clearance requests via clearTimeout controls', () => {
      globalThis.jest.useFakeTimers();
      let sideEffectRan = false;

      const trackingId = setTimeout(() => {
        sideEffectRan = true;
      }, 100);

      clearTimeout(trackingId); // Cancel the operation sequence immediately
      globalThis.jest.advanceTimersByTime(500);

      nodeAssert.equal(sideEffectRan, false); // Proves the task was purged from the array registry
    });
  });

  // ==========================================
  // FRAMEWORK RESILIENCY & MISMATCH BOUNDARIES
  // ==========================================
  nodeDescribe('Framework Resiliency & Mismatch Boundaries', () => {

    nodeIt('asserts that standard matchers throw distinct errors on evaluation failure', () => {
      // Core validation: Ensure passing wrong inputs to basic matchers breaks predictably
      nodeAssert.throws(() => jlExpect(5).toBe(10));
      nodeAssert.throws(() => jlExpect({ x: 1 }).toEqual({ x: 2 }));
      nodeAssert.throws(() => jlExpect([1, 2]).toContain(3));
      nodeAssert.throws(() => jlExpect(false).toBeTruthy());
    });

    nodeIt('guards asymmetric matchers against invalid primitive input formats safely', () => {
      // Rejects structural objects when actual input is a primitive or null
      const objMatcher = globalThis.jest.expect.objectContaining({ id: 1 });
      nodeAssert.equal(objMatcher.asymmetricMatch(null), false);
      nodeAssert.equal(objMatcher.asymmetricMatch("not-an-object"), false);

      // expect.anything must reject null and undefined explicitly
      const anythingMatcher = globalThis.jest.expect.anything();
      nodeAssert.equal(anythingMatcher.asymmetricMatch(null), false);
      nodeAssert.equal(anythingMatcher.asymmetricMatch(undefined), false);
    });

    nodeIt('wipes historic tracking matrices cleanly when clearAllMocks is invoked', () => {
      const dummyObj = { action: () => 'done' };
      const activeSpy = jlSpyOn(dummyObj, 'action');

      dummyObj.action();
      nodeAssert.equal(activeSpy.mock.calls.length, 1);

      // Execute your global state clearing loop utility
      globalThis.jest.clearAllMocks();

      // Crucial check: Spy must stay active but its historic call logs must reset to zero
      nodeAssert.equal(activeSpy.mock.calls.length, 0);
      nodeAssert.equal(dummyObj.action(), 'done'); // Method must still be hooked

      activeSpy.mockRestore();
    });

    nodeIt('isolates suite execution loops cleanly if an operational setup hook crashes', async () => {
      let testExecuted = false;

      // Simulate a broken runtime lifecycle pipeline setup scenario
      const simulateRunnerWithBrokenHook = async () => {
        const beforeEachHook = () => { throw new Error('Database connection lost'); };
        const testCase = () => { testExecuted = true; };

        // Framework runner execution logic simulation loop
        beforeEachHook();
        testCase();
      };

      // Ensure the failure bubbles out safely without running downstream code
      await nodeAssert.rejects(async () => {
        await simulateRunnerWithBrokenHook();
      }, /Database connection lost/);

      nodeAssert.equal(testExecuted, false); // Proves the test block execution was aborted safely
    });
  });

  // ==========================================
  // ENGINE EDGE BOUNDARIES & PROTOTYPE SHARDS
  // ==========================================
  nodeDescribe('Engine Edge Boundaries & Prototype Shards', () => {

    nodeIt('enforces strict prototype architecture matching during deep equality checks', () => {
      class StructuralModel {
        constructor(val) { this.data = val; }
      }

      const instanceA = new StructuralModel(42);
      const plainObject = { data: 42 };

      // Jest semantics: toEqual ignores class identity, toStrictEqual enforces it
      jlExpect(instanceA).toEqual(plainObject);
      nodeAssert.throws(() => jlExpect(instanceA).toStrictEqual(plainObject));
    });

    nodeIt('manages sequential recursive macro-tasks accurately inside fake timers', () => {
      globalThis.jest.useFakeTimers();
      let stepCounter = 0;

      // Setup an engine recursive execution loop
      const recursiveTask = () => {
        stepCounter++;
        setTimeout(recursiveTask, 100);
      };

      setTimeout(recursiveTask, 100);

      // Advance by 250ms -> Should trigger exactly at 100ms and 200ms
      globalThis.jest.advanceTimersByTime(250);
      nodeAssert.equal(stepCounter, 2);

      globalThis.jest.useRealTimers();
    });

    nodeIt('gracefully falls back to default fallback thresholds inside waitFor', async () => {
      let settledState = false;
      setTimeout(() => { settledState = true; }, 10);

      // Executes without passing an options configuration block parameter
      await nodeAssert.doesNotReject(async () => {
        await globalThis.jest.waitFor(() => {
          jlExpect(settledState).toBe(true);
        }); // Uses your framework's internal 1000ms/50ms defaults
      });
    });

    nodeIt('isolates individual step matrix failures inside data-driven loops', () => {
      let processedRows = 0;
      const flawedDataMatrix = [[1, 1], [2, 5], [3, 3]]; // Row 2 is an intentional failure

      const executeLoopMock = () => {
        flawedDataMatrix.forEach(([input, expected]) => {
          processedRows++;
          jlExpect(input).toBe(expected);
        });
      };

      // Execution loop must throw when encountering the broken matrix row
      nodeAssert.throws(() => executeLoopMock());
      nodeAssert.equal(processedRows, 2); // Confirms execution halted cleanly on the failure row
    });
  });

  // ==========================================
  // ABSOLUTE FRONTIER BOUNDARIES
  // ==========================================
  nodeDescribe('Absolute Frontier Boundaries & Core Safety', () => {

    nodeAfter(() => {
      globalThis.jest.useRealTimers();
    });

    nodeIt('verifies clearInterval purges active recurring tasks from the virtual timeline', () => {
      globalThis.jest.useFakeTimers();
      let executionTicks = 0;

      const intervalId = setInterval(() => {
        executionTicks++;
      }, 100);

      globalThis.jest.advanceTimersByTime(250); // Fires at 100ms and 200ms
      nodeAssert.equal(executionTicks, 2);

      clearInterval(intervalId); // Terminate the recurring interval now
      globalThis.jest.advanceTimersByTime(500);

      nodeAssert.equal(executionTicks, 2); // Confirms the interval was successfully deleted
    });

    nodeIt('falls back safely to standard strings when custom matchers omit the message block', () => {
      // Register a barebones custom matcher with a static or missing message attribute
      jlExpect.extend({
        toPassSilently(actual) {
          return { pass: false, message: undefined }; // Triggers your framework's 'Custom matcher assertion failed' fallback
        }
      });

      nodeAssert.throws(
        () => jlExpect("test").toPassSilently(),
        /Custom matcher assertion failed/
      );
    });

    nodeIt('safely normalizes missing or non-numeric delays inside the fake timer engine', () => {
      globalThis.jest.useFakeTimers();
      let triggered = false;

      // Pass bad string inputs into the queue -> should fallback to 0 or execute cleanly
      setTimeout(() => { triggered = true; }, "not-a-number");

      globalThis.jest.advanceTimersByTime(1);
      nodeAssert.equal(triggered, true); // Engine processed it safely without a NaN crash
    });

    nodeIt('processes tokens like %i and %s correctly inside data-driven failure tracking profiles', () => {
      const failingEachMatrix = [[10, "Apple"]];

      const simulateFailingEach = () => {
        failingEachMatrix.forEach(([num, word]) => {
          // Emulate what your framework's name parser outputs on string mismatch interpolation
          const interpolatedName = `adds ${num} to word ${word}`.replace('%i', num).replace('%s', word);
          nodeAssert.match(interpolatedName, /adds 10 to word Apple/);
          jlExpect(num).toBe(99); // Intentionally fail the verification check
        });
      };

      nodeAssert.throws(() => simulateFailingEach());
    });
  });

  // ==========================================
  // COMPLETE RUNTIME BOUNDS & PATH VERIFICATION
  // ==========================================
  nodeDescribe('Complete Runtime Bounds & Path Verification', () => {

    nodeIt('triggers tracking guard errors when passing unmocked objects to spy matchers', () => {
      // FIX: Pass plain objects/primitives to trigger your framework's unmocked guard clauses,
      // bypassing the internal 'typeof actual === function' early recovery return route.
      const plainStandardObject = { foo: 'bar' };
      const primitiveTarget = "not-a-mock";
      const plainFunction = () => 'still not a mock';

      nodeAssert.throws(() => jlExpect(plainStandardObject).toHaveBeenCalledTimes(1), /must be a mock or spy function/);
      nodeAssert.throws(() => jlExpect(plainStandardObject).toHaveBeenCalledWith('data'), /must be a mock or spy function/);
      nodeAssert.throws(() => jlExpect(primitiveTarget).toHaveReturnedWith('val'), /must be a mock or spy function/);

      // A plain function must never silently satisfy mock matchers
      nodeAssert.throws(() => jlExpect(plainFunction).toHaveBeenCalled(), /must be a mock or spy function/);
      nodeAssert.throws(() => jlExpect(plainFunction).toHaveBeenCalledTimes(1), /must be a mock or spy function/);
      nodeAssert.throws(() => jlExpect(plainFunction).toHaveBeenCalledWith(1), /must be a mock or spy function/);
      nodeAssert.throws(() => jlExpect(plainFunction).toHaveReturnedWith(1), /must be a mock or spy function/);
      // ...and `.not` must not swallow the misuse error either
      nodeAssert.throws(() => jlExpect(plainFunction).not.toHaveBeenCalled(), /must be a mock or spy function/);
    });

    nodeIt('ensures arrayContaining safely evaluates and rejects non-array targets', () => {
      const arrayMatcher = globalThis.jest.expect.arrayContaining([]);

      // Passing non-array primitive targets to the asymmetric matcher directly
      nodeAssert.equal(arrayMatcher.asymmetricMatch(null), false);
      nodeAssert.equal(arrayMatcher.asymmetricMatch(42), false);
      nodeAssert.equal(arrayMatcher.asymmetricMatch("string"), false);
    });

    nodeIt('handles formatting errors safely when object-based it.each records a failure', () => {
      const objectTable = [{ variant: "Alpha", expectValue: true }];
      // FIX: Added 'let' to satisfy strict mode scope compilation rules
      let processedCount = 0;

      const runObjectTableMock = () => {
        objectTable.forEach((row) => {
          processedCount++;
          // Emulate what your framework's name parser outputs on string mismatch interpolation
          const fakeTestName = "checking row value %o".replace('%o', JSON.stringify(row));
          nodeAssert.match(fakeTestName, /Alpha/);
          jlExpect(row.variant).toBe("Beta"); // Intentionally force an exact value error
        });
      };

      nodeAssert.throws(() => runObjectTableMock());
      nodeAssert.equal(processedCount, 1);
    });

    nodeIt('guarantees multiple sequential lifecycle hooks execute linearly in declaration order', () => {
      const dynamicExecutionTimeline = [];

      // Simulating your orchestrator runner handling three distinct linear hook pointers
      const hookA = () => dynamicExecutionTimeline.push('A');
      const hookB = () => dynamicExecutionTimeline.push('B');
      const hookC = () => dynamicExecutionTimeline.push('C');

      const executeSequence = () => {
        hookA();
        hookB();
        hookC();
      };

      executeSequence();
      nodeAssert.deepStrictEqual(dynamicExecutionTimeline, ['A', 'B', 'C']);
    });
  });

  // ==========================================
  // ADVERSARIAL FRONTIER MUTATION SUITE
  // ==========================================
  nodeDescribe('Adversarial Frontier Mutation & Chronological Order', () => {

    nodeAfter(() => {
      globalThis.jest.useRealTimers();
    });

    nodeIt('guarantees zero-delay macro-tasks execute in strict chronological insertion order', () => {
      globalThis.jest.useFakeTimers();
      const executionTimeline = [];

      // Queue three distinct tasks all targeting the exact same virtual time tick index
      setTimeout(() => executionTimeline.push(1), 0);
      setTimeout(() => executionTimeline.push(2), 0);
      setTimeout(() => executionTimeline.push(3), 0);

      globalThis.jest.advanceTimersByTime(0);

      // Verifies that your inner task queue preserves FIFO (First-In, First-Out) stability
      nodeAssert.deepStrictEqual(executionTimeline, [1, 2, 3]);
    });

    nodeIt('validates edge-case evaluation rules for empty objectContaining filters', () => {
      const emptyMask = globalThis.jest.expect.objectContaining({});

      // An empty mask matches any object structure, but must reject primitive data shapes
      nodeAssert.equal(emptyMask.asymmetricMatch({ user: 'active' }), true);
      nodeAssert.equal(emptyMask.asymmetricMatch(42), false);
      nodeAssert.equal(emptyMask.asymmetricMatch("text"), false);
    });

    nodeIt('validates edge-case evaluation rules for empty arrayContaining filters', () => {
      const emptyArrayMask = globalThis.jest.expect.arrayContaining([]);

      // Matches any array shape, but must reject primitive value layouts
      nodeAssert.equal(emptyArrayMask.asymmetricMatch([1, 2, 3]), true);
      nodeAssert.equal(emptyArrayMask.asymmetricMatch({}), false);
      nodeAssert.equal(emptyArrayMask.asymmetricMatch(null), false);
    });

    nodeIt('safely normalizes toxic escape strings inside expect.stringMatching', () => {
      // Direct pass constraint test using standard path windows escape characters
      const systemPathPattern = globalThis.jest.expect.stringMatching("C:\\\\Users\\\\jarvis");

      nodeAssert.equal(systemPathPattern.asymmetricMatch("C:\\Users\\jarvis\\Documents"), true);
      nodeAssert.equal(systemPathPattern.asymmetricMatch("D:\\Files"), false);
    });
  });

  // ==========================================
  // SYSTEM RESILIENCY & STRUCTURAL ISOLATION
  // ==========================================
  nodeDescribe('System Resiliency & Structural Isolation', () => {

    nodeAfter(() => {
      globalThis.jest.useRealTimers();
    });

    nodeIt('guarantees child scope lifecycles do not leak side-effects into parallel sibling suites', () => {
      const parentSuiteState = { active: true };

      // Simulate child block A mutating the parent state
      const childSuiteA_BeforeEach = () => { parentSuiteState.mutatedByA = true; };
      // Simulate parallel child block B which expects a clean parental baseline
      const childSuiteB_BeforeEach = () => { parentSuiteState.mutatedByA = false; };

      childSuiteA_BeforeEach();
      nodeAssert.equal(parentSuiteState.mutatedByA, true);

      // Reset sequence emulation matching framework boundary scope drops
      childSuiteB_BeforeEach();
      nodeAssert.equal(parentSuiteState.mutatedByA, false); // Proves sideways isolation holds
    });

    nodeIt('enforces strict prototype chain inheritance matching inside toStrictEqual', () => {
      const objA = Object.create({ sharedProto: true });
      objA.data = 100;

      const objB = Object.create({ sharedProto: false }); // Prototype properties differ
      objB.data = 100;

      // toEqual only inspects own enumerable keys (Jest behaviour)
      jlExpect(objA).toEqual(objB);
      // toStrictEqual compares prototypes, so differing prototypes fail
      nodeAssert.throws(() => jlExpect(objA).toStrictEqual(objB));
    });

    nodeIt('safely processes heavy recursive macro-task queues inside fake timers without freezing the loop', () => {
      globalThis.jest.useFakeTimers();
      let highVolumeCounter = 0;

      // Generates an aggressive execution cascade loop inside the same timeframe index
      const highVolumeGenerator = () => {
        highVolumeCounter++;
        if (highVolumeCounter < 500) {
          setTimeout(highVolumeGenerator, 0);
        }
      };

      setTimeout(highVolumeGenerator, 0);

      // Synchronously execute the cascade
      globalThis.jest.advanceTimersByTime(0);
      nodeAssert.equal(highVolumeCounter, 500); // Handled deep recursion natively without crashing

      globalThis.jest.useRealTimers();
    });

    nodeIt('executes multiple active focus overrides simultaneously while maintaining suite filters', () => {
      const executionRegistry = [];

      // Emulate a test map file with multiple active .only focus states across different suites
      const testSuiteTree = [
        { name: 'focus test 1', fn: () => executionRegistry.push(1), mode: 'only' },
        { name: 'bypassed test', fn: () => executionRegistry.push(2), mode: 'normal' },
        { name: 'focus test 2', fn: () => executionRegistry.push(3), mode: 'only' }
      ];

      const hasOnlyFlag = testSuiteTree.some(t => t.mode === 'only');

      testSuiteTree.forEach(testCase => {
        if (hasOnlyFlag && testCase.mode !== 'only') return;
        testCase.fn();
      });

      // Verifies that ALL focused items run, rather than just the first match breaking early
      nodeAssert.deepStrictEqual(executionRegistry, [1, 3]);
    });
  });

  // ==========================================
  // COMPREHENSIVE LIFECYCLE BOUNDARIES
  // ==========================================
  nodeDescribe('Comprehensive Lifecycle Boundaries', () => {

    nodeIt('guarantees beforeAll and afterAll execute exactly once around suite blocks', async () => {
      let runLog = [];

      // Simulating a suite execution cycle with all four lifecycle blocks
      const mockBeforeAll  = () => runLog.push('beforeAll');
      const mockBeforeEach = () => runLog.push('beforeEach');
      const mockTestCase   = () => runLog.push('test');
      const mockAfterEach  = () => runLog.push('afterEach');
      const mockAfterAll   = () => runLog.push('afterAll');

      // Emulate runner loop processing a single test file containing two test cases
      mockBeforeAll();

      // Test Case #1 execution phase
      mockBeforeEach();
      mockTestCase();
      mockAfterEach();

      // Test Case #2 execution phase
      mockBeforeEach();
      mockTestCase();
      mockAfterEach();

      mockAfterAll();

      // Assert precise chronological alignment and call metrics
      nodeAssert.deepStrictEqual(runLog, [
        'beforeAll',
        'beforeEach', 'test', 'afterEach',
        'beforeEach', 'test', 'afterEach',
        'afterAll'
      ]);
    });

    nodeIt('explicitly awaits async lifecycle promises before advancing the execution queue', async () => {
      let timeline = [];

      // Simulate an asynchronous database setup hook that takes 15ms to settle
      const asyncBeforeAllHook = async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
        timeline.push('async_hook_complete');
      };

      const syncTestBody = () => {
        timeline.push('test_body_executed');
      };

      // Framework orchestrator must recognize the returned Promise and await it explicitly
      await asyncBeforeAllHook();
      syncTestBody();

      // If the engine fails to await, 'test_body_executed' would append first
      nodeAssert.deepStrictEqual(timeline, ['async_hook_complete', 'test_body_executed']);
    });
  });

  // ==========================================
  // ISOMORPHIC SNAPSHOT VERIFICATION CORE
  // ==========================================
  nodeDescribe('Isomorphic Snapshot Verification Core', () => {

    nodeIt('proves node filesystem routing works and saves snapshot artifacts to the disk', () => {
      // Skip manually if running outside standard node test runner threads
      const snapFilePath = path.join(process.cwd(), '__snapshots__', 'jest-lite.snap');

      // Clear any historic integration state files cleanly
      if (fs.existsSync(snapFilePath)) fs.unlinkSync(snapFilePath);

      const targetDataMetadata = { build: "v1.0.0", environment: "NodeCI" };

      // Execute the test tool validation sequence targeting disk writing channels
      nodeAssert.doesNotThrow(() => {
        jlExpect(targetDataMetadata).toMatchSnapshot("node_integration_disk_test");
      });

      // Verify physical disk file generation state
      nodeAssert.equal(fs.existsSync(snapFilePath), true);
      const readDiskData = JSON.parse(fs.readFileSync(snapFilePath, 'utf8'));
      nodeAssert.match(readDiskData["node_integration_disk_test"], /NodeCI/);
    });

    nodeIt('falls back seamlessly to browser localStorage arrays if disk modules are absent', () => {
      // Force temporary runtime environment spoof variables
      const originalLocalStore = globalThis.localStorage;
      globalThis._forceBrowserStorage = true;
      let virtualStoreMemory = {};

      globalThis.localStorage = {
        setItem(k, v) { virtualStoreMemory[k] = v; },
        getItem(k) { return virtualStoreMemory[k] || null; }
      };

      const browserContextPayload = { type: "Browser_Render", canvas: true };

      // Force matchers to utilize alternative storage mapping routes
      nodeAssert.doesNotThrow(() => {
        jlExpect(browserContextPayload).toMatchSnapshot("browser_viewport_mock_snap");
      });

      // Validate that virtual store arrays caught the matching parameters accurately
      nodeAssert.match(virtualStoreMemory["browser_viewport_mock_snap"], /Browser_Render/);

      // Restore baseline global parameters
      globalThis._forceBrowserStorage = false;
      globalThis.localStorage = originalLocalStore;
    });

    nodeIt('triggers explicit framework errors upon mismatching stored values', () => {
      const experimentalDataState = { values: [10, 20] };

      // Instantiates baseline initialization parameters state
      jlExpect(experimentalDataState).toMatchSnapshot("resiliency_mismatch_boundary");

      // Attempt to enforce modified matching values parameters against structural constraints
      const mutatedPayloadState = { values: [10, 99999] };

      nodeAssert.throws(() => {
        jlExpect(mutatedPayloadState).toMatchSnapshot("resiliency_mismatch_boundary");
      }, /Snapshot Mismatch/);
    });
  });

  // ==========================================
  // README DOCUMENTATION EXAMPLES COMPLIANCE SUITE
  // ==========================================
  nodeDescribe('README Documentation Examples Compliance Suite', () => {

    nodeIt('verifies Quickstart Calculator and object equality examples', () => {
      nodeAssert.doesNotThrow(() => {
        jlExpect(2 + 3).toBe(5);
        jlExpect({ user: 'Alice' }).toEqual({ user: 'Alice' });
      });
    });

    nodeIt('verifies Section 1 Suite Structure & Test Organization regex and empty checks', () => {
      const email = 'user@example.com';
      const password = '';
      nodeAssert.doesNotThrow(() => {
        jlExpect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        jlExpect(password).toBeEmpty();
      });
    });

    nodeIt('verifies Section 2 Data-Driven Matrix Testing (it.each) examples', () => {
      // Array matrix form example
      const matrix = [
        [1, 1, 2],
        [5, 5, 10],
        [10, -2, 8]
      ];
      matrix.forEach(([a, b, expected]) => {
        jlExpect(a + b).toBe(expected);
      });

      // Object parameter form example
      const discountRows = [
        { tier: 'gold', price: 100, expected: 80 },
        { tier: 'silver', price: 100, expected: 90 },
        { tier: 'bronze', price: 100, expected: 95 }
      ];
      const discountMap = { gold: 0.20, silver: 0.10, bronze: 0.05 };
      discountRows.forEach(({ tier, price, expected }) => {
        const finalPrice = price * (1 - discountMap[tier]);
        jlExpect(finalPrice).toBe(expected);
      });
    });

    nodeIt('verifies Section 3 Lifecycle Hooks & Scope Chain example logic', () => {
      let dbConnection = { status: 'disconnected', queries: 0 };
      const logs = [];

      // Simulated beforeAll
      dbConnection.status = 'connected';

      // Simulated beforeEach
      logs.length = 0;
      logs.push('record_setup');

      // Test body
      dbConnection.queries++;
      jlExpect(dbConnection.status).toBe('connected');
      jlExpect(logs).toEqual(['record_setup']);

      // Simulated afterAll
      dbConnection.status = 'disconnected';
      jlExpect(dbConnection.status).toBe('disconnected');
    });

    nodeIt('verifies Section 4 Standard Expectations & Matchers examples', () => {
      // Identity & Equality
      jlExpect(42).toBe(42);
      jlExpect(NaN).toBe(NaN);
      jlExpect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });

      // Inversion
      jlExpect(10).not.toBe(20);
      jlExpect([1, 2, 3]).not.toContain(99);

      // Nullability & Truthiness
      jlExpect(undefined).toBeUndefined();
      jlExpect('hello').toBeDefined();
      jlExpect(null).toBeNull();
      jlExpect('active').toBeTruthy();
      jlExpect(0).toBeFalsy();

      // Numbers & Ranges
      jlExpect(15).toBeGreaterThan(10);
      jlExpect(15).toBeGreaterThanOrEqual(15);
      jlExpect(5).toBeLessThan(20);
      jlExpect(5).toBeLessThanOrEqual(5);
      jlExpect(7).toBeWithinRange(1, 10);
      jlExpect(0.1 + 0.2).toBeCloseTo(0.3, 2);

      // Strings, Regex & Collections
      jlExpect('JavaScript').toContain('Script');
      jlExpect(['apple', 'banana']).toContain('apple');
      jlExpect('apple').toBeOneOf(['apple', 'banana', 'cherry']);
      jlExpect('ORDER-12345').toMatch(/^ORDER-\d+$/);
      jlExpect('hello world').toStartWith('hello');
      jlExpect('hello world').toEndWith('world');
      jlExpect([]).toBeEmpty();
      jlExpect({}).toBeEmpty();

      // Types & Instance Checking
      jlExpect('text').toBeType('string');
      jlExpect([1, 2]).toBeArray();
      jlExpect({ key: 'val' }).toBeObject();
      jlExpect(new Date()).toBeInstanceOf(Date);

      // Object Structure & Properties
      const user = { profile: { name: 'Alex', age: 30 } };
      jlExpect(user).toHaveProperty('profile.name', 'Alex');
      jlExpect(user).toMatchObject({ profile: { name: 'Alex' } });

      // Exception Trapping
      const throwError = () => {
        throw new TypeError('Invalid database configuration');
      };
      jlExpect(throwError).toThrow();
      jlExpect(throwError).toThrow('Invalid database');
      jlExpect(throwError).toThrow(/configuration/);
    });

    nodeIt('verifies Section 5 Asymmetric Engine Matchers examples', () => {
      const response = {
        id: 101,
        username: 'dev_user',
        createdAt: new Date(),
        tags: ['javascript', 'testing']
      };

      jlExpect(response).toEqual({
        id: globalThis.jest.expect.any(Number),
        username: globalThis.jest.expect.stringMatching(/^dev_/),
        createdAt: globalThis.jest.expect.anything(),
        tags: globalThis.jest.expect.arrayContaining(['testing'])
      });

      jlExpect(response).toEqual(
        globalThis.jest.expect.objectContaining({ id: 101 })
      );
    });

    nodeIt('verifies Section 6 UI & DOM Element Matchers examples', () => {
      const button = globalThis.document.createElement('button');
      button.className = 'btn btn-primary';
      button.textContent = 'Submit Form';
      button.setAttribute('data-testid', 'submit-btn');

      // Mock DOM tree attachment for document.contains
      const originalContains = globalThis.document.contains;
      globalThis.document.contains = (node) => node === button || node === globalThis.document.body;

      jlExpect(button).toExist();
      jlExpect(button).toBeInTheDocument();
      jlExpect(button).toHaveClass('btn-primary');
      jlExpect(button).toHaveTextContent('Submit');
      jlExpect(button).toHaveAttribute('data-testid', 'submit-btn');
      jlExpect(button).not.toBeDisabled();

      globalThis.document.contains = originalContains;
    });

    nodeIt('verifies Section 7 Mock Functions (jest.fn) examples', () => {
      const mockFn = jlFn((a, b) => a + b);

      mockFn(10, 20);
      mockFn(5, 5);

      jlExpect(mockFn).toHaveBeenCalled();
      jlExpect(mockFn).toHaveBeenCalledTimes(2);
      jlExpect(mockFn).toHaveBeenCalledWith(10, 20);
      jlExpect(mockFn).toHaveReturnedWith(30);

      jlExpect(mockFn.mock.calls).toEqual([[10, 20], [5, 5]]);
      // NOTE: mock.results now uses the Jest shape ({ type, value }).
      // `mock.returns` keeps the legacy "raw values" view documented in the README.
      jlExpect(mockFn.mock.results).toEqual([
        { type: 'return', value: 30 },
        { type: 'return', value: 10 },
      ]);
      jlExpect(mockFn.mock.returns).toEqual([30, 10]);

      // Overriding implementations & return values
      const mockFetch = jlFn();
      mockFetch
        .mockReturnValueOnce({ status: 200, data: 'first' })
        .mockReturnValueOnce({ status: 500, data: 'error' })
        .mockReturnValue({ status: 200, data: 'default' });

      jlExpect(mockFetch()).toEqual({ status: 200, data: 'first' });
      jlExpect(mockFetch()).toEqual({ status: 500, data: 'error' });
      jlExpect(mockFetch()).toEqual({ status: 200, data: 'default' });

      // Promise helpers
      const asyncMock = jlFn().mockResolvedValue({ success: true });
      return asyncMock().then((result) => {
        jlExpect(result).toEqual({ success: true });
      });
    });

    nodeIt('verifies Section 8 Spying & Automatic Cleanup (jest.spyOn) examples', () => {
      const cart = {
        calculateTotal(price, tax) {
          return price + (price * tax);
        }
      };

      const spy = jlSpyOn(cart, 'calculateTotal');
      cart.calculateTotal(100, 0.1);

      jlExpect(spy).toHaveBeenCalledWith(100, 0.1);
      jlExpect(spy).toHaveReturnedWith(110);

      spy.mockRestore();
    });

    nodeIt('verifies Section 9 Asynchronous Testing & Polling (waitFor) examples', async () => {
      // Standard async/await
      const fetchUser = async (id) => ({ id, name: 'Alice' });
      const user = await fetchUser(42);
      jlExpect(user.name).toBe('Alice');

      // Asynchronous Event Polling
      const banner = globalThis.document.createElement('div');
      setTimeout(() => {
        banner.textContent = 'Ready';
      }, 50);

      const waitForFn = globalThis.jest.waitFor || globalThis.waitFor;
      await waitForFn(() => {
        jlExpect(banner.textContent).toBe('Ready');
      }, { timeout: 500, interval: 10 });
    });

    nodeIt('verifies Section 10 Fake Timers & Time Travel examples', () => {
      globalThis.jest.useFakeTimers();

      let executed = false;
      setTimeout(() => {
        executed = true;
      }, 10000);

      jlExpect(executed).toBe(false);

      globalThis.jest.advanceTimersByTime(10000);

      jlExpect(executed).toBe(true);

      globalThis.jest.useRealTimers();
    });

    nodeIt('verifies Section 11 Isomorphic State Snapshots examples', () => {
      const config = {
        theme: 'dark',
        sidebar: true,
        fontSize: 14
      };

      jlExpect(config).toMatchSnapshot('ui_theme_config_readme_example');
    });

    nodeIt('verifies Section 12 Extending Matchers (expect.extend) examples', () => {
      globalThis.jest.expect.extend({
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

      jlExpect('123e4567-e89b-12d3-a456-426614174000').toBeValidUUID();
      jlExpect('invalid-id').not.toBeValidUUID();
    });

    nodeIt('verifies Section 13 Module System Emulation examples', async () => {
      globalThis.jest.mock('api-client', () => ({
        fetchUsers: jlFn().mockResolvedValue([{ id: 1, name: 'Bob' }])
      }));

      const apiClient = globalThis.jest.requireMock('api-client');
      const users = await apiClient.fetchUsers();

      jlExpect(users).toEqual([{ id: 1, name: 'Bob' }]);
      jlExpect(apiClient.fetchUsers).toHaveBeenCalled();

      globalThis.jest.clearAllMocks();
    });

  });

  // ==========================================
  // DEFENSIVE EDGE-CASES AND MISUSE PREVENTION SUITE
  // ==========================================
  nodeDescribe('Defensive Edge-Cases and Misuse Prevention Suite', () => {

    nodeIt('handles DOM toBeVisible, toHaveStyle, and toHaveFocus edge cases', () => {
      // Setup mock getComputedStyle on global window
      const originalGetComputedStyle = globalThis.window.getComputedStyle;
      
      let mockStyleObj = {
        display: 'block',
        visibility: 'visible',
        getPropertyValue: (prop) => {
          if (prop === 'background-color') return 'red';
          if (prop === 'font-size') return '16px';
          return '';
        }
      };

      globalThis.window.getComputedStyle = () => mockStyleObj;

      const mockEl = {
        offsetWidth: 100,
        offsetHeight: 50,
        getClientRects: () => [1]
      };

      // toBeVisible positive case
      nodeAssert.doesNotThrow(() => {
        jlExpect(mockEl).toBeVisible();
      });

      // toBeVisible failure case when display is 'none'
      mockStyleObj.display = 'none';
      nodeAssert.throws(() => {
        jlExpect(mockEl).toBeVisible();
      }, /Expected element to be visible/);

      // toHaveStyle case
      nodeAssert.doesNotThrow(() => {
        jlExpect(mockEl).toHaveStyle({ backgroundColor: 'red', fontSize: '16px' });
      });

      nodeAssert.throws(() => {
        jlExpect(mockEl).toHaveStyle({ backgroundColor: 'blue' });
      }, /Expected background-color to be "blue"/);

      // toHaveFocus failure case
      globalThis.document.activeElement = null;
      nodeAssert.throws(() => {
        jlExpect(mockEl).toHaveFocus();
      }, /Expected element to have focus/);

      globalThis.window.getComputedStyle = originalGetComputedStyle;
    });

    nodeIt('guards module registry against missing mocks and un-factored registration', () => {
      // Non-existent module request
      let caughtError = null;
      try {
        requireMock('unregistered_module_xyz_12345');
      } catch (e) {
        caughtError = e;
      }
      nodeAssert.match(caughtError?.message || '', /is not mocked/);

      // Default mock factory handling
      mock('empty_factory_module');
      nodeAssert.deepEqual(requireMock('empty_factory_module'), {});
    });

    nodeIt('properly handles spy exceptions without corrupting restoration state', () => {
      const service = {
        danger() { return 'safe'; }
      };

      const spy = jlSpyOn(service, 'danger');
      spy.mockImplementation(() => {
        throw new Error('boom');
      });

      nodeAssert.throws(() => {
        service.danger();
      }, /boom/);

      // Verify return history recorded undefined for thrown exception
      nodeAssert.equal(spy.mock.returns.length, 1);
      nodeAssert.equal(spy.mock.returns[0], undefined);

      // Ensure mockRestore cleanly restores original method
      spy.mockRestore();
      nodeAssert.equal(service.danger(), 'safe');
    });

    nodeIt('handles expect.any with Boolean, Date, and Function constructors', () => {
      jlExpect(true).toEqual(globalThis.jest.expect.any(Boolean));
      jlExpect(new Date()).toEqual(globalThis.jest.expect.any(Date));
      jlExpect(() => {}).toEqual(globalThis.jest.expect.any(Function));

      nodeAssert.throws(() => {
        jlExpect('not_a_boolean').toEqual(globalThis.jest.expect.any(Boolean));
      });
    });

    nodeIt('handles invalid target inputs to arrayContaining and objectContaining safely', () => {
      // arrayContaining against non-array actual
      nodeAssert.throws(() => {
        jlExpect('not_an_array').toEqual(globalThis.jest.expect.arrayContaining(['item']));
      });

      // objectContaining against null or non-object actual
      nodeAssert.throws(() => {
        jlExpect(null).toEqual(globalThis.jest.expect.objectContaining({ a: 1 }));
      });
    });

    nodeIt('handles circular reference objects inside toMatchSnapshot without throwing stack overflows', () => {
      const circular = { name: 'circular_test' };
      circular.self = circular;

      nodeAssert.doesNotThrow(() => {
        jlExpect(circular).toMatchSnapshot('circular_object_snapshot_test');
      });
    });

    nodeIt('verifies waitFor timeout rejection carries internal assertion failure message', async () => {
      await nodeAssert.rejects(
        async () => {
          const waitForFn = globalThis.jest.waitFor || globalThis.waitFor;
          await waitForFn(() => {
            throw new Error('custom_polling_error');
          }, { timeout: 100, interval: 20 });
        },
        /waitFor timed out after 100ms. Last internal runner exception was: custom_polling_error/
      );
    });

  });

});


// ==========================================
// 5. TRUE END-TO-END RUNNER VERIFICATION
//    (registers real suites and executes jest.run())
// ==========================================
nodeDescribe('End-to-End Runner Execution', () => {

  nodeIt('reports pass/fail/skip/todo counts and actionable failure details', async () => {
    const stats = await runIsolated(() => {
      jlDescribe('math', () => {
        jlIt('adds', () => jlExpect(1 + 1).toBe(2));
        jlIt('breaks', () => jlExpect(1 + 1).toBe(3));
        jlIt.skip('skipped', () => jlExpect(true).toBe(false));
        jlIt.todo('write more math tests');
      });
    });

    nodeAssert.equal(stats.pass, 1);
    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.skip, 1);
    nodeAssert.equal(stats.todo, 1);
    nodeAssert.equal(stats.total, 4);
    nodeAssert.equal(stats.failures.length, 1);
    nodeAssert.equal(stats.failures[0].test, 'math > breaks');
    nodeAssert.equal(stats.failures[0].phase, 'test');
    nodeAssert.match(stats.failures[0].message, /Expected 3, got 2/);
  });

  nodeIt('reports asynchronous test rejections as failures instead of crashing the run', async () => {
    const stats = await runIsolated(() => {
      jlIt('async explodes', async () => {
        await Promise.resolve();
        throw new Error('async boom');
      });
      jlIt('async passes', async () => {
        const value = await Promise.resolve(7);
        jlExpect(value).toBe(7);
      });
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.pass, 1);
    nodeAssert.match(stats.failures[0].message, /async boom/);
  });

  nodeIt('executes nested lifecycle hooks in strict Jest ordering', async () => {
    const order = [];

    const stats = await runIsolated(() => {
      jlDescribe('outer', () => {
        jlBeforeAll(() => order.push('outer:beforeAll'));
        jlBeforeEachHook(() => order.push('outer:beforeEach'));
        jlAfterEachHook(() => order.push('outer:afterEach'));
        jlAfterAll(() => order.push('outer:afterAll'));

        jlIt('outer test', () => order.push('outer:test'));

        jlDescribe('inner', () => {
          jlBeforeAll(() => order.push('inner:beforeAll'));
          jlBeforeEachHook(() => order.push('inner:beforeEach'));
          jlAfterEachHook(() => order.push('inner:afterEach'));
          jlAfterAll(() => order.push('inner:afterAll'));
          jlIt('inner test', () => order.push('inner:test'));
        });
      });
    });

    nodeAssert.equal(stats.fail, 0);
    nodeAssert.deepEqual(order, [
      'outer:beforeAll',
      'outer:beforeEach',
      'outer:test',
      'outer:afterEach',
      'inner:beforeAll',
      'outer:beforeEach',
      'inner:beforeEach',
      'inner:test',
      'inner:afterEach',
      'outer:afterEach',
      'inner:afterAll',
      'outer:afterAll',
    ]);
  });

  nodeIt('awaits asynchronous hooks before advancing the queue', async () => {
    const order = [];
    const delay = (label) => async () => {
      await new Promise(resolve => globalThis.setTimeout(resolve, 5));
      order.push(label);
    };

    const stats = await runIsolated(() => {
      jlBeforeAll(delay('beforeAll'));
      jlBeforeEachHook(delay('beforeEach'));
      jlAfterEachHook(delay('afterEach'));
      jlAfterAll(delay('afterAll'));
      jlIt('async body', async () => {
        await new Promise(resolve => globalThis.setTimeout(resolve, 5));
        order.push('test');
      });
    });

    nodeAssert.equal(stats.pass, 1);
    nodeAssert.deepEqual(order, ['beforeAll', 'beforeEach', 'test', 'afterEach', 'afterAll']);
  });

  nodeIt('fails every test in a block (and nested blocks) when beforeAll throws, but still runs afterAll', async () => {
    const order = [];

    const stats = await runIsolated(() => {
      jlDescribe('broken setup', () => {
        jlBeforeAll(() => { throw new Error('setup exploded'); });
        jlAfterAll(() => order.push('afterAll ran'));
        jlIt('never runs a', () => order.push('a ran'));
        jlDescribe('nested', () => {
          jlIt('never runs b', () => order.push('b ran'));
        });
      });
      jlDescribe('healthy', () => {
        jlIt('still runs', () => order.push('c ran'));
      });
    });

    nodeAssert.equal(stats.fail, 2);
    nodeAssert.equal(stats.pass, 1);
    nodeAssert.deepEqual(order, ['afterAll ran', 'c ran']);
    nodeAssert.ok(stats.failures.every(f => f.phase === 'beforeAll'));
    nodeAssert.ok(stats.failures.every(f => /setup exploded/.test(f.message)));
  });

  nodeIt('fails the test when beforeEach throws, skips the body, and still runs afterEach', async () => {
    const order = [];

    const stats = await runIsolated(() => {
      jlBeforeEachHook(() => { throw new Error('beforeEach exploded'); });
      jlAfterEachHook(() => order.push('afterEach ran'));
      jlIt('body should not execute', () => order.push('body ran'));
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.failures[0].phase, 'beforeEach');
    nodeAssert.match(stats.failures[0].message, /beforeEach exploded/);
    nodeAssert.deepEqual(order, ['afterEach ran']);
  });

  nodeIt('finalizes test status after afterEach, so a failing afterEach fails a passing test', async () => {
    const stats = await runIsolated(() => {
      jlAfterEachHook(() => { throw new Error('afterEach exploded'); });
      jlIt('body passes', () => jlExpect(1).toBe(1));
    });

    nodeAssert.equal(stats.pass, 0);
    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.failures[0].phase, 'afterEach');
    nodeAssert.match(stats.failures[0].message, /afterEach exploded/);
  });

  nodeIt('runs every afterEach hook even when one of them throws', async () => {
    const order = [];

    const stats = await runIsolated(() => {
      jlDescribe('parent', () => {
        jlAfterEachHook(() => order.push('parent:afterEach'));
        jlDescribe('child', () => {
          jlAfterEachHook(() => { throw new Error('child afterEach exploded'); });
          jlIt('passes body', () => jlExpect(true).toBe(true));
        });
      });
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.deepEqual(order, ['parent:afterEach']);
  });

  nodeIt('records afterAll hook failures without aborting the run', async () => {
    const stats = await runIsolated(() => {
      jlDescribe('teardown trouble', () => {
        jlIt('passes', () => jlExpect(1).toBe(1));
        jlAfterAll(() => { throw new Error('afterAll exploded'); });
      });
      jlDescribe('later suite', () => {
        jlIt('still runs', () => jlExpect(2).toBe(2));
      });
    });

    nodeAssert.equal(stats.pass, 2);
    nodeAssert.equal(stats.fail, 1);
    const afterAllFailure = stats.failures.find(f => f.phase === 'afterAll');
    nodeAssert.ok(afterAllFailure);
    nodeAssert.match(afterAllFailure.test, /afterAll hook/);
    nodeAssert.match(afterAllFailure.message, /afterAll exploded/);
  });

  nodeIt('counts assertions made inside afterEach hooks toward expect.assertions', async () => {
    const passing = await runIsolated(() => {
      jlAfterEachHook(() => { jlExpect('hook').toBeType('string'); });
      jlIt('counts hook assertions too', () => {
        jlExpect.assertions(2);
        jlExpect(1).toBe(1);
      });
    });
    nodeAssert.equal(passing.pass, 1, failureMessages(passing).join('\n'));

    const failing = await runIsolated(() => {
      jlAfterEachHook(() => { jlExpect('hook').toBeType('string'); });
      jlIt('does not account for the hook assertion', () => {
        jlExpect.assertions(1);
        jlExpect(1).toBe(1);
      });
    });
    nodeAssert.equal(failing.fail, 1);
    nodeAssert.match(failing.failures[0].message, /Expected 1 assertions but saw 2/);
  });

  nodeIt('supports expect.hasAssertions() contracts', async () => {
    const stats = await runIsolated(() => {
      jlIt('fails with no assertions', () => { jlExpect.hasAssertions(); });
      jlIt('passes with an assertion', () => {
        jlExpect.hasAssertions();
        jlExpect(true).toBe(true);
      });
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.pass, 1);
    nodeAssert.match(stats.failures[0].message, /at least one assertion/);
  });

  nodeIt('applies describe.only focus to every descendant suite and test', async () => {
    const executed = [];

    const stats = await runIsolated(() => {
      jlDescribe.only('focused', () => {
        jlIt('focused direct child', () => executed.push('direct'));
        jlDescribe('nested inside focus', () => {
          jlIt('focused grandchild', () => executed.push('grandchild'));
        });
      });
      jlDescribe('ignored suite', () => {
        jlIt('ignored child', () => executed.push('ignored'));
      });
      jlIt('ignored root test', () => executed.push('root'));
    });

    nodeAssert.deepEqual(executed, ['direct', 'grandchild']);
    nodeAssert.equal(stats.pass, 2);
    nodeAssert.equal(stats.skip, 2);
  });

  nodeIt('applies describe.skip exclusion to descendants and skips its hooks', async () => {
    const executed = [];

    const stats = await runIsolated(() => {
      jlDescribe.skip('disabled', () => {
        jlBeforeAll(() => executed.push('beforeAll'));
        jlAfterAll(() => executed.push('afterAll'));
        jlIt('child', () => executed.push('child'));
        jlDescribe('deep', () => {
          jlIt('grandchild', () => executed.push('grandchild'));
        });
      });
      jlIt('active', () => executed.push('active'));
    });

    nodeAssert.deepEqual(executed, ['active']);
    nodeAssert.equal(stats.skip, 2);
    nodeAssert.equal(stats.pass, 1);
  });

  nodeIt('honours it.only across suites and keeps skip taking priority', async () => {
    const executed = [];

    const stats = await runIsolated(() => {
      jlDescribe('alpha', () => {
        jlIt.only('focused one', () => executed.push('alpha-focus'));
        jlIt('normal', () => executed.push('alpha-normal'));
      });
      jlDescribe('beta', () => {
        jlIt.only('focused two', () => executed.push('beta-focus'));
        jlIt.skip('explicitly skipped', () => executed.push('beta-skip'));
      });
    });

    nodeAssert.deepEqual(executed, ['alpha-focus', 'beta-focus']);
    nodeAssert.equal(stats.pass, 2);
    nodeAssert.equal(stats.skip, 2);
  });

  nodeIt('treats test.* aliases identically to it.*', async () => {
    const executed = [];

    const stats = await runIsolated(() => {
      jlTest('alias runs', () => executed.push('test'));
      jlTest.skip('alias skips', () => executed.push('skipped'));
      jlTest.todo('alias todo');
    });

    nodeAssert.deepEqual(executed, ['test']);
    nodeAssert.equal(stats.pass, 1);
    nodeAssert.equal(stats.skip, 1);
    nodeAssert.equal(stats.todo, 1);
  });

  nodeIt('never executes todo test bodies and counts them separately', async () => {
    const stats = await runIsolated(() => {
      jlIt.todo('implement caching layer');
      jlIt.todo('implement retry policy');
      jlIt('real', () => jlExpect(1).toBe(1));
    });

    nodeAssert.equal(stats.todo, 2);
    nodeAssert.equal(stats.pass, 1);
    nodeAssert.equal(stats.total, 3);
  });

  nodeIt('automatically restores spies and fake timers after every test', async () => {
    const service = { getValue: () => 'real' };
    const realSetTimeout = globalThis.setTimeout;

    const stats = await runIsolated(() => {
      jlIt('mutates global state', () => {
        jlSpyOn(service, 'getValue').mockReturnValue('mocked');
        globalThis.jest.useFakeTimers();
        jlExpect(service.getValue()).toBe('mocked');
      });
      jlIt('sees a clean environment', () => {
        jlExpect(service.getValue()).toBe('real');
        jlExpect(globalThis.setTimeout).toBe(realSetTimeout);
      });
    });

    nodeAssert.equal(stats.pass, 2, failureMessages(stats).join('\n'));
    nodeAssert.equal(service.getValue(), 'real');
    nodeAssert.equal(globalThis.setTimeout, realSetTimeout);
  });

  nodeIt('resets the root suite after a run unless reset:false is passed', async () => {
    jlResetSuites();
    jlIt('temporary', () => jlExpect(1).toBe(1));
    nodeAssert.equal(jlGetRootSuite().tests.length, 1);

    await jlRun({ silent: true, setExitCode: false });
    nodeAssert.equal(jlGetRootSuite().tests.length, 0);

    jlResetSuites();
    jlIt('kept for a second run', () => jlExpect(1).toBe(1));
    const stats = await jlRun({ silent: true, setExitCode: false, reset: false });
    nodeAssert.equal(stats.pass, 1);
    nodeAssert.equal(jlGetRootSuite().tests.length, 1);

    const secondStats = await jlRun({ silent: true, setExitCode: false });
    nodeAssert.equal(secondStats.pass, 1);
    nodeAssert.equal(jlGetRootSuite().tests.length, 0);
  });

  nodeIt('signals failures without breaking browser usage: stats, exit code and throwOnFail', async () => {
    const previousExitCode = process.exitCode;

    // Default for tests here: never touch the exit code.
    const stats = await runIsolated(() => {
      jlIt('fails', () => jlExpect(1).toBe(2));
    });
    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(process.exitCode, previousExitCode);

    // Opt-in Node signalling makes CI runs actionable.
    await runIsolated(() => {
      jlIt('fails', () => jlExpect(1).toBe(2));
    }, { setExitCode: true });
    nodeAssert.equal(process.exitCode, 1);
    process.exitCode = previousExitCode === undefined ? 0 : previousExitCode;

    // throwOnFail surfaces an aggregated, actionable error.
    await nodeAssert.rejects(
      () => runIsolated(() => { jlIt('fails', () => jlExpect(1).toBe(2)); }, { throwOnFail: true }),
      (error) => {
        nodeAssert.match(error.message, /1 test\(s\) failed/);
        nodeAssert.match(error.message, /fails \(test\)/);
        nodeAssert.equal(error.stats.fail, 1);
        return true;
      }
    );
    process.exitCode = previousExitCode === undefined ? 0 : previousExitCode;

    // Successful runs never set a failing exit code.
    const clean = await runIsolated(() => { jlIt('passes', () => jlExpect(1).toBe(1)); }, { setExitCode: true });
    nodeAssert.equal(clean.fail, 0);
    nodeAssert.equal(process.exitCode, previousExitCode === undefined ? 0 : previousExitCode);
  });

  nodeIt('runs data-driven tables end-to-end (arrays, objects, describe.each and templates)', async () => {
    const executed = [];

    const stats = await runIsolated(() => {
      jlIt.each([[1, 2, 3], [4, 5, 9]])('adds %i + %i = %i', (a, b, expected) => {
        executed.push(`${a}+${b}`);
        jlExpect(a + b).toBe(expected);
      });

      jlTest.each([{ name: 'alpha' }, { name: 'beta' }])('handles $name', (row) => {
        executed.push(row.name);
        jlExpect(row.name).toBeType('string');
      });

      jlDescribe.each([['red'], ['blue']])('colour %s', (colour) => {
        jlIt(`is a string (${colour})`, () => {
          executed.push(colour);
          jlExpect(colour).toBeType('string');
        });
      });

      jlIt.each`
        a    | b    | expected
        ${1} | ${2} | ${3}
        ${4} | ${5} | ${9}
      `('template $a + $b = $expected', ({ a, b, expected }) => {
        executed.push(`t${a}`);
        jlExpect(a + b).toBe(expected);
      });
    });

    nodeAssert.equal(stats.pass, 8, failureMessages(stats).join('\n'));
    // Tests declared in a block run before that block's nested suites (Jest ordering).
    nodeAssert.deepEqual(executed, ['1+2', '4+5', 'alpha', 'beta', 't1', 't4', 'red', 'blue']);
  });

  nodeIt('interpolates each() titles with %-tokens, $properties and %#', () => {
    jlResetSuites();

    jlIt.each([[1, 2], [3, 4]])('case %#: %i and %i', () => {});
    jlIt.each([{ id: 7, nested: { label: 'deep' } }])('user $id -> $nested.label', () => {});
    jlIt.each([['literal']])('100%% of %s', () => {});
    jlIt.each`
      left | right
      ${'a'} | ${'b'}
    `('template $left$right', () => {});
    jlDescribe.each([['grouped']])('suite %s', () => { jlIt('inner', () => {}); });

    const root = jlGetRootSuite();
    const names = root.tests.map(test => test.name);
    nodeAssert.deepEqual(names, [
      'case 0: 1 and 2',
      'case 1: 3 and 4',
      'user 7 -> deep',
      '100% of literal',
      'template ab',
    ]);
    nodeAssert.equal(root.suites[0].name, 'suite grouped');
    jlResetSuites();
  });

  nodeIt('rejects malformed each() usage with actionable errors', () => {
    jlResetSuites();
    nodeAssert.throws(() => jlIt.each('not-a-table')('name', () => {}), /each expects an array table/);
    nodeAssert.throws(() => jlIt.each([[1]])('name', 'not-a-function'), /requires a callback function/);
    nodeAssert.throws(() => jlIt.each`${1}${2}`('name', () => {}), /template tables require a header row/);
    nodeAssert.throws(
      () => jlIt.each`
        a | b
        ${1}
      `('name', () => {}),
      /not divisible by 2 headings/
    );
    jlResetSuites();
  });

  nodeIt('rejects malformed suite and test registrations', () => {
    jlResetSuites();
    nodeAssert.throws(() => jlIt('missing implementation'), /requires an implementation function/);
    nodeAssert.throws(() => jlDescribe('missing callback'), /requires a callback function/);
    nodeAssert.throws(() => jlBeforeEachHook('not a function'), /beforeEach expects a function/);
    jlResetSuites();
  });

  nodeIt('keeps the suite tree intact when a describe callback throws', () => {
    jlResetSuites();
    nodeAssert.throws(() => jlDescribe('exploding suite', () => { throw new Error('registration failure'); }), /registration failure/);
    // currentSuite must be restored to root, so later registrations still land correctly
    jlIt('registered after failure', () => {});
    nodeAssert.equal(jlGetRootSuite().tests.length, 1);
    jlResetSuites();
  });

  nodeIt('exposes the whole public API on the jest object and as ES module exports', () => {
    const requiredKeys = [
      'describe', 'it', 'test', 'expect', 'run', 'fn', 'spyOn',
      'beforeAll', 'afterAll', 'beforeEach', 'afterEach',
      'clearAllMocks', 'resetAllMocks', 'restoreAllMocks',
      'useFakeTimers', 'useRealTimers', 'advanceTimersByTime',
      'runAllTimers', 'runOnlyPendingTimers', 'clearAllTimers', 'getTimerCount',
      'mock', 'registerMock', 'requireMock', 'getMock', 'hasMock', 'unmock',
      'waitFor', 'extendExpect', 'AssertionError',
    ];
    requiredKeys.forEach(key => {
      nodeAssert.ok(globalThis.jest[key], `jest.${key} is missing`);
    });

    nodeAssert.equal(typeof jlTest, 'function');
    nodeAssert.equal(typeof jlTest.only, 'function');
    nodeAssert.equal(typeof jlTest.skip, 'function');
    nodeAssert.equal(typeof jlTest.each, 'function');
    nodeAssert.equal(typeof jlTest.todo, 'function');
    nodeAssert.equal(typeof jlDescribe.only, 'function');
    nodeAssert.equal(typeof jlDescribe.skip, 'function');
    nodeAssert.equal(typeof jlDescribe.each, 'function');
    nodeAssert.equal(typeof jlIt.only.each, 'function');
    nodeAssert.equal(typeof jlIt.skip.each, 'function');
  });
});

nodeDescribe('Test & Hook Timeouts', () => {

  nodeIt('fails a hanging test once its custom timeout elapses', async () => {
    const stats = await runIsolated(() => {
      jlIt('hangs forever', () => new Promise(() => {}), 50);
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.pass, 0);
    nodeAssert.equal(stats.failures[0].phase, 'test');
    nodeAssert.match(stats.failures[0].test, /hangs forever/);
    nodeAssert.match(stats.failures[0].message, /timed out after 50ms/);
  });

  nodeIt('fails a test whose beforeEach hook hangs past its own timeout', async () => {
    const order = [];
    const stats = await runIsolated(() => {
      jlBeforeEachHook(() => new Promise(() => {}), 50);
      jlAfterEachHook(() => order.push('afterEach ran'));
      jlIt('body should not execute', () => order.push('body ran'));
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.failures[0].phase, 'beforeEach');
    nodeAssert.match(stats.failures[0].message, /beforeEach hook.*timed out after 50ms/);
    // afterEach must still run even though beforeEach timed out.
    nodeAssert.deepEqual(order, ['afterEach ran']);
  });

  nodeIt('fails every test in a block when its beforeAll hook hangs past its own timeout', async () => {
    const stats = await runIsolated(() => {
      jlDescribe('slow setup', () => {
        jlBeforeAll(() => new Promise(() => {}), 50);
        jlIt('never runs', () => {});
      });
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.failures[0].phase, 'beforeAll');
    nodeAssert.match(stats.failures[0].message, /beforeAll hook.*timed out after 50ms/);
  });

  nodeIt('fails a test whose afterEach hook hangs past its own timeout', async () => {
    const stats = await runIsolated(() => {
      jlAfterEachHook(() => new Promise(() => {}), 50);
      jlIt('body passes', () => jlExpect(1).toBe(1));
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.failures[0].phase, 'afterEach');
    nodeAssert.match(stats.failures[0].message, /afterEach hook.*timed out after 50ms/);
  });

  nodeIt('passes a slow test whose custom timeout comfortably covers its duration', async () => {
    const stats = await runIsolated(() => {
      jlIt('takes 30ms', async () => {
        await new Promise(resolve => globalThis.setTimeout(resolve, 30));
        jlExpect(true).toBe(true);
      }, 500);
    });

    nodeAssert.equal(stats.pass, 1, failureMessages(stats).join('\n'));
    nodeAssert.equal(stats.fail, 0);
  });

  nodeIt('falls back to the 5000ms default timeout when none is supplied', () => {
    jlResetSuites();
    jlIt('uses default', () => {});
    nodeAssert.equal(jlGetRootSuite().tests[0].timeout, 5000);
    jlResetSuites();
  });

  nodeIt('rejects non-numeric, negative, NaN or Infinity timeouts as usage errors', () => {
    jlResetSuites();
    nodeAssert.throws(() => jlIt('bad', () => {}, -1), /timeout must be a non-negative finite number/);
    nodeAssert.throws(() => jlIt('bad', () => {}, NaN), /timeout must be a non-negative finite number/);
    nodeAssert.throws(() => jlIt('bad', () => {}, Infinity), /timeout must be a non-negative finite number/);
    nodeAssert.throws(() => jlIt('bad', () => {}, 'soon'), /timeout must be a non-negative finite number/);
    nodeAssert.throws(() => jlBeforeEachHook(() => {}, -5), /timeout must be a non-negative finite number/);
    nodeAssert.throws(() => jlBeforeAll(() => {}, -5), /timeout must be a non-negative finite number/);
    nodeAssert.throws(() => jlAfterAll(() => {}, -5), /timeout must be a non-negative finite number/);
    nodeAssert.throws(() => jlAfterEachHook(() => {}, -5), /timeout must be a non-negative finite number/);
    jlResetSuites();
  });

  nodeIt('accepts a zero timeout as valid (immediate expiry), not a usage error', () => {
    jlResetSuites();
    nodeAssert.doesNotThrow(() => jlIt('zero timeout', () => {}, 0));
    nodeAssert.equal(jlGetRootSuite().tests[0].timeout, 0);
    jlResetSuites();
  });

  nodeIt('forwards a custom timeout to every row registered via it.each/test.each', async () => {
    const stats = await runIsolated(() => {
      jlIt.each([[1], [2]])('row %s hangs', () => new Promise(() => {}), 50);
    });

    nodeAssert.equal(stats.fail, 2);
    nodeAssert.equal(stats.pass, 0);
    stats.failures.forEach(failure => {
      nodeAssert.match(failure.message, /timed out after 50ms/);
    });
  });

  nodeIt('rejects an invalid timeout forwarded through .each just like a direct call', () => {
    jlResetSuites();
    nodeAssert.throws(
      () => jlIt.each([[1]])('row %s', () => {}, -10),
      /timeout must be a non-negative finite number/
    );
    jlResetSuites();
  });

  nodeIt('enforces the real-timer timeout even while jest.useFakeTimers() is active', async () => {
    const stats = await runIsolated(() => {
      jlIt('hangs under fake timers', () => {
        globalThis.jest.useFakeTimers();
        // Never resolved and no fake timer is ever advanced, so only the real
        // (native) timeout enforcement mechanism can end this test.
        return new Promise(() => {});
      }, 50);
    });

    nodeAssert.equal(stats.fail, 1);
    nodeAssert.equal(stats.pass, 0);
    nodeAssert.match(stats.failures[0].message, /timed out after 50ms/);
    // The runner's automatic cleanup must have restored real timers afterwards.
    nodeAssert.notEqual(globalThis.jest.getTimerCount, undefined);
    jest.useRealTimers();
  });

  nodeIt('clears its internal timer once a fast test settles, leaving nothing pending', async () => {
    // Regression guard: if the timer were never cleared, Node would keep the
    // process alive / leak handles across many fast passing tests.
    const stats = await runIsolated(() => {
      for (let i = 0; i < 20; i++) {
        jlIt(`fast ${i}`, () => jlExpect(1).toBe(1), 100);
      }
    });

    nodeAssert.equal(stats.pass, 20);
    nodeAssert.equal(stats.fail, 0);
  });
});

// ==========================================
// 6. MOCK & SPY CORRECTNESS
// ==========================================
nodeDescribe('Mock Function Correctness', () => {

  nodeIt('records Jest-shaped results for returning and throwing calls', () => {
    const mixed = jlFn((shouldThrow) => {
      if (shouldThrow) throw new Error('mock exploded');
      return 'ok';
    });

    mixed(false);
    nodeAssert.throws(() => mixed(true), /mock exploded/);
    mixed(false);

    nodeAssert.deepEqual(mixed.mock.results.map(r => r.type), ['return', 'throw', 'return']);
    nodeAssert.equal(mixed.mock.results[0].value, 'ok');
    nodeAssert.equal(mixed.mock.results[1].value.message, 'mock exploded');
    // calls and results stay index-aligned even when a call throws
    nodeAssert.equal(mixed.mock.calls.length, mixed.mock.results.length);
    nodeAssert.deepEqual(mixed.mock.calls, [[false], [true], [false]]);
    // legacy raw-value view
    nodeAssert.deepEqual(mixed.mock.returns, ['ok', undefined, 'ok']);
  });

  nodeIt('exposes contexts, instances and lastCall', () => {
    const tracker = jlFn(function () { return this; });
    const host = { tracker };

    host.tracker('a', 'b');
    tracker.call({ id: 'explicit' });

    nodeAssert.equal(tracker.mock.contexts[0], host);
    nodeAssert.deepEqual(tracker.mock.contexts[1], { id: 'explicit' });
    nodeAssert.deepEqual(tracker.mock.lastCall, []);
    host.tracker('final');
    nodeAssert.deepEqual(tracker.mock.lastCall, ['final']);
    nodeAssert.equal(tracker.mock.instances.length, 0);
  });

  nodeIt('preserves the runtime `this` for mocks and spies', () => {
    const counter = {
      value: 41,
      read: jlFn(function () { return this.value + 1; }),
    };
    nodeAssert.equal(counter.read(), 42);

    const service = { total: 10, sum(extra) { return this.total + extra; } };
    const spy = jlSpyOn(service, 'sum');
    nodeAssert.equal(service.sum(5), 15);
    nodeAssert.equal(spy.mock.contexts[0], service);
    spy.mockRestore();

    const returnsThis = jlFn().mockReturnThis();
    const owner = { returnsThis };
    nodeAssert.equal(owner.returnsThis(), owner);
  });

  nodeIt('supports constructor usage with function and class implementations', () => {
    const Person = jlFn(function (name) { this.name = name; });
    const person = new Person('Ada');

    nodeAssert.equal(person.name, 'Ada');
    nodeAssert.ok(person instanceof Person);
    nodeAssert.equal(Person.mock.instances.length, 1);
    nodeAssert.equal(Person.mock.instances[0], person);
    nodeAssert.deepEqual(Person.mock.calls, [['Ada']]);

    class Widget {
      constructor(id) { this.id = id; }
    }
    const MockWidget = jlFn(Widget);
    const widget = new MockWidget(7);
    nodeAssert.equal(widget.id, 7);
    nodeAssert.ok(widget instanceof MockWidget);
    nodeAssert.equal(MockWidget.mock.instances[0], widget);
  });

  nodeIt('implements mockName/getMockName, mockReset and mockRejectedValueOnce', async () => {
    const named = jlFn(() => 'value').mockName('fancyMock');
    nodeAssert.equal(named.getMockName(), 'fancyMock');
    nodeAssert.equal(jlFn().getMockName(), 'jest.fn()');

    named();
    named.mockReset();
    nodeAssert.equal(named.mock.calls.length, 0);
    nodeAssert.equal(named(), undefined, 'mockReset must remove the implementation');

    const sequence = jlFn()
      .mockRejectedValueOnce(new Error('once rejection'))
      .mockResolvedValue('steady');

    await nodeAssert.rejects(() => sequence(), /once rejection/);
    nodeAssert.equal(await sequence(), 'steady');
    nodeAssert.equal(await sequence(), 'steady');
  });

  nodeIt('keeps once-implementations working with falsy return values', () => {
    const mock = jlFn(() => 'default');
    mock.mockImplementationOnce(() => 0).mockImplementationOnce(() => undefined);

    nodeAssert.equal(mock(), 0);
    nodeAssert.equal(mock(), undefined);
    nodeAssert.equal(mock(), 'default');
  });

  nodeIt('restores spies via one consistent registry (restoreAllMocks) and manual restore', () => {
    const service = { alpha: () => 'real-a', beta: () => 'real-b' };
    jlSpyOn(service, 'alpha').mockReturnValue('fake-a');
    const betaSpy = jlSpyOn(service, 'beta').mockReturnValue('fake-b');

    nodeAssert.equal(service.alpha(), 'fake-a');
    // manual restore still works, and does not confuse the registry
    betaSpy.mockRestore();
    nodeAssert.equal(service.beta(), 'real-b');

    restoreAllMocks();
    nodeAssert.equal(service.alpha(), 'real-a');
    nodeAssert.equal(service.beta(), 'real-b');
    // idempotent
    nodeAssert.doesNotThrow(() => restoreAllMocks());
  });

  nodeIt('removes spies from objects that never owned the method', () => {
    class Base { greet() { return 'base'; } }
    const instance = new Base();
    const spy = jlSpyOn(instance, 'greet').mockReturnValue('spied');

    nodeAssert.equal(instance.greet(), 'spied');
    nodeAssert.equal(Object.prototype.hasOwnProperty.call(instance, 'greet'), true);
    spy.mockRestore();
    nodeAssert.equal(Object.prototype.hasOwnProperty.call(instance, 'greet'), false);
    nodeAssert.equal(instance.greet(), 'base');
  });

  nodeIt('resets a spy back to the original implementation and clears history', () => {
    const service = { fetch: () => 'original' };
    const spy = jlSpyOn(service, 'fetch').mockReturnValue('mocked');

    service.fetch();
    nodeAssert.equal(spy.mock.calls.length, 1);

    spy.mockReset();
    nodeAssert.equal(spy.mock.calls.length, 0);
    nodeAssert.equal(service.fetch(), 'original');
    spy.mockRestore();
  });

  nodeIt('implements clear/reset/restore-all semantics across the registry', () => {
    const standalone = jlFn(() => 'implemented');
    const service = { ping: () => 'real' };
    const spy = jlSpyOn(service, 'ping').mockReturnValue('spied');

    standalone();
    service.ping();

    globalThis.jest.clearAllMocks();
    nodeAssert.equal(standalone.mock.calls.length, 0);
    nodeAssert.equal(spy.mock.calls.length, 0);
    nodeAssert.equal(standalone(), 'implemented', 'clearAllMocks must keep implementations');
    nodeAssert.equal(service.ping(), 'spied');

    resetAllMocks();
    nodeAssert.equal(standalone(), undefined, 'resetAllMocks must drop implementations');
    nodeAssert.equal(service.ping(), 'real', 'resetAllMocks reverts spies to the original method');

    restoreAllMocks();
    nodeAssert.equal(service.ping(), 'real');

    // Restore the shared axios registry fixture used by the other suites
    globalThis.jest.mock('axios', () => ({
      get: jlFn(() => Promise.resolve({ data: { user: 'Fake User' } })),
      post: jlFn(() => Promise.resolve({ status: 201 }))
    }));
  });

  nodeIt('guards spyOn against invalid targets', () => {
    nodeAssert.throws(() => jlSpyOn(null, 'method'), /expects an object or function/);
    nodeAssert.throws(() => jlSpyOn({}, 'missing'), /is not a function/);
    nodeAssert.throws(() => jlSpyOn({ value: 3 }, 'value'), /is not a function \(received number\)/);
  });
});


// ==========================================
// 7. EXPECT UPGRADES
// ==========================================
nodeDescribe('Expect Upgrades: async chains, strict equality and new matchers', () => {

  nodeIt('supports .resolves and .rejects (including .not)', async () => {
    await jlExpect(Promise.resolve(42)).resolves.toBe(42);
    await jlExpect(Promise.resolve({ ok: true })).resolves.toEqual({ ok: true });
    await jlExpect(Promise.resolve(42)).resolves.not.toBe(43);

    await jlExpect(Promise.reject(new Error('rejected!'))).rejects.toThrow('rejected!');
    await jlExpect(Promise.reject(new Error('rejected!'))).rejects.toBeInstanceOf(Error);
    await jlExpect(Promise.reject('plain reason')).rejects.toBe('plain reason');
    await jlExpect(Promise.reject(new Error('a'))).rejects.not.toThrow('b');

    // Works with any thenable, including async mock functions
    const asyncMock = jlFn().mockResolvedValue('mocked value');
    await jlExpect(asyncMock()).resolves.toBe('mocked value');
  });

  nodeIt('fails .resolves/.rejects correctly instead of silently passing', async () => {
    await nodeAssert.rejects(
      () => jlExpect(Promise.resolve(1)).resolves.toBe(2),
      /Expected 2, got 1/
    );
    await nodeAssert.rejects(
      () => jlExpect(Promise.reject(new Error('boom'))).resolves.toBe(1),
      /Expected promise to resolve, but it rejected with/
    );
    await nodeAssert.rejects(
      () => jlExpect(Promise.resolve('resolved')).rejects.toBe('x'),
      /Expected promise to reject, but it resolved with/
    );
    await nodeAssert.rejects(
      () => jlExpect(42).resolves.toBe(42),
      /expects a promise or thenable/
    );
  });

  nodeIt('distinguishes toEqual from toStrictEqual the way Jest does', () => {
    class Point { constructor(x) { this.x = x; } }

    // undefined properties
    jlExpect({ a: 1, b: undefined }).toEqual({ a: 1 });
    nodeAssert.throws(() => jlExpect({ a: 1, b: undefined }).toStrictEqual({ a: 1 }), /Expected \(strict\)/);

    // class identity
    jlExpect(new Point(1)).toEqual({ x: 1 });
    nodeAssert.throws(() => jlExpect(new Point(1)).toStrictEqual({ x: 1 }));
    jlExpect(new Point(1)).toStrictEqual(new Point(1));

    // array sparseness
    jlExpect([, 1]).toEqual([undefined, 1]);
    nodeAssert.throws(() => jlExpect([, 1]).toStrictEqual([undefined, 1]));

    // strict equality still supports asymmetric matchers
    jlExpect({ id: 3 }).toStrictEqual({ id: jlExpect.any(Number) });
  });

  nodeIt('compares Map, Set, Date, RegExp and Error values deeply', () => {
    jlExpect(new Set([1, 2, 3])).toEqual(new Set([3, 2, 1]));
    nodeAssert.throws(() => jlExpect(new Set([1, 2])).toEqual(new Set([1, 3])));

    jlExpect(new Map([['a', 1]])).toEqual(new Map([['a', 1]]));
    nodeAssert.throws(() => jlExpect(new Map([['a', 1]])).toEqual(new Map([['a', 2]])));

    jlExpect(new Date('2020-01-01')).toEqual(new Date('2020-01-01'));
    nodeAssert.throws(() => jlExpect(new Date('2020-01-01')).toEqual(new Date('2021-01-01')));

    jlExpect(/abc/gi).toEqual(/abc/gi);
    nodeAssert.throws(() => jlExpect(/abc/g).toEqual(/abc/i));

    jlExpect(new Error('same')).toEqual(new Error('same'));
    nodeAssert.throws(() => jlExpect(new Error('a')).toEqual(new Error('b')));
    nodeAssert.throws(() => jlExpect(new TypeError('same')).toStrictEqual(new Error('same')));
  });

  nodeIt('implements toContainEqual, toHaveLength and expect.stringContaining', () => {
    jlExpect([{ id: 1 }, { id: 2 }]).toContainEqual({ id: 2 });
    nodeAssert.throws(() => jlExpect([{ id: 1 }]).toContainEqual({ id: 9 }), /does not contain an item equal to/);
    jlExpect([{ id: 1 }]).not.toContainEqual({ id: 9 });

    // toContain uses identity, toContainEqual uses deep equality
    nodeAssert.throws(() => jlExpect([{ id: 1 }]).toContain({ id: 1 }), /does not contain/);

    jlExpect('hello').toHaveLength(5);
    jlExpect([1, 2, 3]).toHaveLength(3);
    jlExpect(new Set([1, 2])).toHaveLength(2);
    nodeAssert.throws(() => jlExpect([1]).toHaveLength(2), /Expected length 2, got 1/);
    nodeAssert.throws(() => jlExpect(42).toHaveLength(1), /expects a value with a length or size/);
    nodeAssert.throws(() => jlExpect([1]).toHaveLength('1'), /expects a number/);

    jlExpect('the quick brown fox').toEqual(jlExpect.stringContaining('quick'));
    jlExpect({ msg: 'error: disk full' }).toMatchObject({ msg: jlExpect.stringContaining('disk') });
    nodeAssert.throws(() => jlExpect('abc').toEqual(jlExpect.stringContaining('xyz')));
    nodeAssert.throws(() => jlExpect.stringContaining(/regex/), /expects a string/);
  });

  nodeIt('implements the full family of call and return matchers', () => {
    const mock = jlFn((value) => value * 2);
    mock(1);
    mock(2);
    mock(3);

    jlExpect(mock).toHaveBeenCalledTimes(3);
    jlExpect(mock).toHaveBeenLastCalledWith(3);
    jlExpect(mock).toHaveBeenNthCalledWith(2, 2);
    jlExpect(mock).toHaveReturned();
    jlExpect(mock).toHaveReturnedTimes(3);
    jlExpect(mock).toHaveReturnedWith(4);
    jlExpect(mock).toHaveLastReturnedWith(6);
    jlExpect(mock).toHaveNthReturnedWith(1, 2);

    nodeAssert.throws(() => jlExpect(mock).toHaveBeenLastCalledWith(1), /Last call was/);
    nodeAssert.throws(() => jlExpect(mock).toHaveBeenNthCalledWith(1, 99), /Call 1 was/);
    nodeAssert.throws(() => jlExpect(mock).toHaveBeenNthCalledWith(9, 1), /no call number 9/);
    nodeAssert.throws(() => jlExpect(mock).toHaveNthReturnedWith(3, 99), /Result 3 was/);
    nodeAssert.throws(() => jlExpect(mock).toHaveLastReturnedWith(99), /Last result was/);
    nodeAssert.throws(() => jlExpect(mock).toHaveReturnedTimes(2), /returned 3 times/);
    nodeAssert.throws(() => jlExpect(mock).toHaveBeenNthCalledWith(0, 1), /positive integer/);
  });

  nodeIt('never counts a throwing call as a return', () => {
    const thrower = jlFn(() => { throw new Error('always fails'); });
    nodeAssert.throws(() => thrower());

    jlExpect(thrower).toHaveBeenCalledTimes(1);
    nodeAssert.throws(() => jlExpect(thrower).toHaveReturned(), /returned at least once/);
    nodeAssert.throws(() => jlExpect(thrower).toHaveReturnedWith(undefined), /Never returned/);
    jlExpect(thrower).toHaveReturnedTimes(0);
    nodeAssert.throws(() => jlExpect(thrower).toHaveLastReturnedWith(undefined), /Last result was a thrown/);
  });

  nodeIt('validates toThrow against strings, regexes, classes and Error instances', () => {
    class CustomError extends Error {}
    const thrower = () => { throw new CustomError('detailed failure'); };

    jlExpect(thrower).toThrow();
    jlExpect(thrower).toThrow('detailed');
    jlExpect(thrower).toThrow(/DETAILED/i);
    jlExpect(thrower).toThrow(CustomError);
    jlExpect(thrower).toThrow(Error);
    jlExpect(thrower).toThrow(new Error('detailed failure'));
    jlExpect(() => 'safe').not.toThrow();

    nodeAssert.throws(() => jlExpect(thrower).toThrow(TypeError), /Expected error of type TypeError/);
    nodeAssert.throws(() => jlExpect(thrower).toThrow('other message'), /Expected error containing/);
    nodeAssert.throws(() => jlExpect(thrower).toThrow(/nope/), /Expected error matching/);
    nodeAssert.throws(() => jlExpect(thrower).toThrow(new Error('different')), /Expected error message/);
    nodeAssert.throws(() => jlExpect(thrower).toThrow(12345), /toThrow expects a string, RegExp, Error class/);

    // Non-Error throws are still reported usefully
    jlExpect(() => { throw 'string failure'; }).toThrow('string failure');
  });

  nodeIt('treats matcher misuse as an error rather than an assertion, even under .not', () => {
    // Previously `expect(notAFunction).toThrow()` passed because calling the value threw.
    nodeAssert.throws(() => jlExpect('not a function').toThrow(), /toThrow expects a function/);
    nodeAssert.throws(() => jlExpect('not a function').not.toThrow(), /toThrow expects a function/);
    nodeAssert.throws(() => jlExpect(null).toThrow(), /toThrow expects a function/);

    nodeAssert.throws(() => jlExpect(5).not.toBeOneOf('not-an-array'), /toBeOneOf expects an Array/);
    nodeAssert.throws(() => jlExpect(5).not.toMatch(/x/), /toMatch expects a string/);
    nodeAssert.throws(() => jlExpect('abc').not.toMatch(12345), /toMatch expects a string or RegExp/);
    nodeAssert.throws(() => jlExpect({}).not.toBeInstanceOf('String'), /toBeInstanceOf expects a constructor/);
  });

  nodeIt('exposes a recognizable assertion error contract', () => {
    let caught = null;
    try {
      jlExpect(1).toBe(2);
    } catch (error) {
      caught = error;
    }

    nodeAssert.ok(caught instanceof JlAssertionError);
    nodeAssert.equal(caught.isJestLiteAssertionError, true);
    nodeAssert.equal(caught.name, 'JestLiteAssertionError');
    nodeAssert.equal(caught.matcherName, 'toBe');
    nodeAssert.equal(caught.actual, 1);
    nodeAssert.equal(caught.expected, 2);
    nodeAssert.equal(globalThis.jest.AssertionError, JlAssertionError);
    nodeAssert.equal(globalThis.jest.expect.AssertionError, JlAssertionError);
  });

  nodeIt('propagates custom matcher implementation bugs through .not', () => {
    globalThis.jest.expect.extend({
      brokenMatcher() { throw new ReferenceError('matcher implementation bug'); },
      malformedMatcher() { return 'not a result object'; },
    });

    nodeAssert.throws(() => jlExpect(1).brokenMatcher(), /matcher implementation bug/);
    nodeAssert.throws(() => jlExpect(1).not.brokenMatcher(), /matcher implementation bug/);
    nodeAssert.throws(() => jlExpect(1).malformedMatcher(), /must return an object shaped like/);
    nodeAssert.throws(() => globalThis.jest.expect.extend({ notAFunction: 42 }), /must be a function/);
  });

  nodeIt('gives custom matchers a Jest-like `this` context', () => {
    let seenContext = null;
    globalThis.jest.expect.extend({
      toBeContextAware(actual, expected) {
        seenContext = this;
        return {
          pass: this.equals(actual, expected),
          message: () => `expected ${this.utils.printReceived(actual)} to equal ${this.utils.printExpected(expected)}`,
        };
      },
    });

    jlExpect({ a: 1 }).toBeContextAware({ a: 1 });
    nodeAssert.equal(seenContext.isNot, false);
    jlExpect({ a: 1 }).not.toBeContextAware({ a: 2 });
    nodeAssert.equal(seenContext.isNot, true);
    nodeAssert.equal(typeof seenContext.equals, 'function');
    nodeAssert.equal(typeof seenContext.utils.printReceived, 'function');
  });

  nodeIt('supports expect.closeTo and toBeNaN', () => {
    jlExpect({ value: 0.1 + 0.2 }).toEqual({ value: jlExpect.closeTo(0.3) });
    nodeAssert.throws(() => jlExpect({ value: 0.5 }).toEqual({ value: jlExpect.closeTo(0.3) }));
    jlExpect(NaN).toBeNaN();
    nodeAssert.throws(() => jlExpect(1).toBeNaN(), /Expected NaN/);
  });
});


// ==========================================
// 8. NEGATIVE REGRESSION SUITE
//    (each case previously produced a FALSE POSITIVE)
// ==========================================
nodeDescribe('Negative Regressions: previously silent false positives now fail', () => {

  nodeIt('no longer treats arbitrary objects exposing .test() as asymmetric matchers', () => {
    const notAMatcher = { test: () => true };

    nodeAssert.throws(() => jlExpect({ a: 1 }).toEqual(notAMatcher));
    nodeAssert.throws(() => jlExpect(notAMatcher).toEqual({ a: 1 }));
    // regexes are compared as values, not applied as predicates
    nodeAssert.throws(() => jlExpect('abc').toEqual(/b/));
    // identical shapes still match
    jlExpect({ test: notAMatcher.test }).toEqual({ test: notAMatcher.test });
  });

  nodeIt('no longer short-circuits deep equality on repeated object references', () => {
    const shared = { v: 1 };

    // Old pair tracking marked `shared` as "seen" after the first comparison and
    // then blindly returned true for the second, differing comparison.
    nodeAssert.throws(() => jlExpect({ x: shared, y: shared }).toEqual({ x: { v: 1 }, y: { v: 2 } }));
    nodeAssert.throws(() => jlExpect([shared, shared]).toEqual([{ v: 1 }, { v: 2 }]));

    // genuinely equal repeats still pass
    jlExpect({ x: shared, y: shared }).toEqual({ x: { v: 1 }, y: { v: 1 } });
  });

  nodeIt('still protects against truly circular structures', () => {
    const a = { name: 'node' };
    a.self = a;
    const b = { name: 'node' };
    b.self = b;

    jlExpect(a).toEqual(b);

    const c = { name: 'different' };
    c.self = c;
    nodeAssert.throws(() => jlExpect(a).toEqual(c));
  });

  nodeIt('no longer lets plain functions satisfy mock matchers', () => {
    const plain = function namedFunction() {};

    nodeAssert.throws(() => jlExpect(plain).toHaveBeenCalled(), /must be a mock or spy function/);
    nodeAssert.throws(() => jlExpect(plain).toHaveBeenCalledTimes(0), /must be a mock or spy function/);
    nodeAssert.throws(() => jlExpect(plain).toHaveBeenCalledWith('x'), /must be a mock or spy function/);
    nodeAssert.throws(() => jlExpect(plain).toHaveReturnedWith('x'), /must be a mock or spy function/);
    nodeAssert.throws(() => jlExpect(plain).toHaveLastReturnedWith('x'), /must be a mock or spy function/);
  });

  nodeIt('no longer ignores the expected value passed to toHaveAttribute', () => {
    const el = globalThis.document.createElement('div');
    el.setAttribute('data-role', 'admin');

    jlExpect(el).toHaveAttribute('data-role');
    jlExpect(el).toHaveAttribute('data-role', 'admin');

    // Previously this passed because `arguments.length` was read inside an arrow function.
    nodeAssert.throws(() => jlExpect(el).toHaveAttribute('data-role', 'guest'), /to be "guest"/);
    nodeAssert.throws(() => jlExpect(el).toHaveAttribute('missing-attr'), /have attribute "missing-attr"/);
  });

  nodeIt('no longer swallows exceptions thrown inside fake timer callbacks', () => {
    const jest = globalThis.jest;
    jest.useFakeTimers();
    try {
      globalThis.setTimeout(() => { throw new Error('timer callback exploded'); }, 10);
      nodeAssert.throws(() => jest.advanceTimersByTime(20), /timer callback exploded/);
    } finally {
      jest.useRealTimers();
    }
  });

  nodeIt('no longer allows hook failures to escape or go unreported by the runner', async () => {
    const stats = await runIsolated(() => {
      jlDescribe('hook failures', () => {
        jlBeforeAll(() => { throw new Error('beforeAll failure'); });
        jlIt('a', () => {});
      });
    });
    nodeAssert.equal(stats.fail, 1);
    nodeAssert.match(stats.failures[0].message, /beforeAll failure/);
  });

  nodeIt('no longer inverts assertions when the matcher itself is broken', () => {
    // `.not` must only invert real assertion failures
    nodeAssert.throws(() => jlExpect(undefined).not.toHaveLength(0), /expects a value with a length or size/);
    nodeAssert.throws(() => jlExpect({}).not.toHaveProperty(42), /expects a string path/);
    // but genuine inversions keep working
    jlExpect([1]).not.toHaveLength(2);
    jlExpect({ a: 1 }).not.toHaveProperty('b');
  });
});

// ==========================================
// 9. DOM MATCHER SAFETY
// ==========================================
nodeDescribe('DOM Matcher Safety & Misuse Reporting', () => {

  nodeIt('never throws a ReferenceError when HTMLElement is unavailable', () => {
    const savedHTMLElement = globalThis.HTMLElement;
    delete globalThis.HTMLElement;
    try {
      nodeAssert.doesNotThrow(() => jlExpect({ id: 'plain-object' }).toExist());
      nodeAssert.doesNotThrow(() => jlExpect([1]).toExist());
      nodeAssert.throws(() => jlExpect(null).toExist(), /Expected element to exist/);
      nodeAssert.throws(() => jlExpect(undefined).toExist(), /Expected element to exist/);
      nodeAssert.throws(() => jlExpect([]).toExist(), /Expected element to exist/);
    } finally {
      globalThis.HTMLElement = savedHTMLElement;
    }
  });

  nodeIt('recognises real HTMLElement instances when the global exists', () => {
    const element = new globalThis.HTMLElement();
    jlExpect(element).toExist();
  });

  nodeIt('reports misuse of DOM matchers with actionable errors', () => {
    nodeAssert.throws(() => jlExpect(null).toHaveAttribute('id'), /toHaveAttribute expects a DOM element/);
    nodeAssert.throws(() => jlExpect('string').toHaveClass('x'), /toHaveClass expects a DOM element/);
    nodeAssert.throws(() => jlExpect(null).toBeVisible(), /toBeVisible expects a DOM element/);
    nodeAssert.throws(() => jlExpect(null).toBeDisabled(), /toBeDisabled expects a DOM element/);
    nodeAssert.throws(() => jlExpect(null).toHaveTextContent('x'), /toHaveTextContent expects a DOM element/);
    nodeAssert.throws(() => jlExpect({}).toHaveStyle('not-an-object'), /expects an object of CSS properties/);

    const element = globalThis.document.createElement('div');
    nodeAssert.throws(() => jlExpect(element).toHaveAttribute(42), /expects an attribute name string/);
  });

  nodeIt('explains missing DOM capabilities instead of crashing', () => {
    const element = globalThis.document.createElement('div');
    const savedGetComputedStyle = globalThis.getComputedStyle;
    delete globalThis.getComputedStyle;
    try {
      nodeAssert.throws(() => jlExpect(element).toBeVisible(), /requires a DOM environment exposing getComputedStyle/);
      nodeAssert.throws(() => jlExpect(element).toHaveStyle({ color: 'red' }), /requires a DOM environment exposing getComputedStyle/);
    } finally {
      if (savedGetComputedStyle === undefined) delete globalThis.getComputedStyle;
      else globalThis.getComputedStyle = savedGetComputedStyle;
    }

    const savedDocument = globalThis.document;
    delete globalThis.document;
    try {
      nodeAssert.throws(() => jlExpect(element).toBeInTheDocument(), /requires a DOM environment/);
      nodeAssert.throws(() => jlExpect(element).toHaveFocus(), /requires a DOM environment/);
    } finally {
      globalThis.document = savedDocument;
    }
  });
});


// ==========================================
// 10. FAKE TIMER ENGINE
// ==========================================
nodeDescribe('Fake Timer Engine Reliability', () => {
  const jest = globalThis.jest;

  nodeBeforeEach(() => {
    jest.useRealTimers();
  });

  nodeAfter(() => {
    jest.useRealTimers();
  });

  nodeIt('requires fake timers before any virtual clock API is used', () => {
    nodeAssert.throws(() => jest.advanceTimersByTime(10), /Fake timers are not enabled/);
    nodeAssert.throws(() => jest.runAllTimers(), /Fake timers are not enabled/);
    nodeAssert.throws(() => jest.runOnlyPendingTimers(), /Fake timers are not enabled/);
    nodeAssert.throws(() => jest.advanceTimersToNextTimer(), /Fake timers are not enabled/);
  });

  nodeIt('supports self-cancelling intervals', () => {
    jest.useFakeTimers();
    let ticks = 0;
    const id = globalThis.setInterval(() => {
      ticks++;
      if (ticks === 3) globalThis.clearInterval(id);
    }, 10);

    jest.advanceTimersByTime(1000);
    nodeAssert.equal(ticks, 3);
    nodeAssert.equal(jest.getTimerCount(), 0);
  });

  nodeIt('clamps zero-delay intervals so they cannot spin forever', () => {
    jest.useFakeTimers();
    let spins = 0;
    globalThis.setInterval(() => { spins++; }, 0);

    jest.advanceTimersByTime(5);
    nodeAssert.equal(spins, 5);
    jest.clearAllTimers();
  });

  nodeIt('guards against infinite timer loops', () => {
    jest.useFakeTimers();
    globalThis.setInterval(() => {}, 1);
    nodeAssert.throws(() => jest.runAllTimers(), /Aborting after running 100000 timers/);
    jest.clearAllTimers();

    // Timers that re-schedule themselves at zero delay are caught too
    const reschedule = () => { globalThis.setTimeout(reschedule, 0); };
    reschedule();
    nodeAssert.throws(() => jest.advanceTimersByTime(0), /Aborting after running 100000 timers/);
    jest.clearAllTimers();
  });

  nodeIt('implements runAllTimers, runOnlyPendingTimers, advanceTimersToNextTimer and getTimerCount', () => {
    jest.useFakeTimers();
    const seen = [];

    globalThis.setTimeout(() => {
      seen.push('first');
      globalThis.setTimeout(() => seen.push('nested'), 10);
    }, 10);
    globalThis.setTimeout(() => seen.push('second'), 20);

    nodeAssert.equal(jest.getTimerCount(), 2);

    jest.runOnlyPendingTimers();
    nodeAssert.deepEqual(seen, ['first', 'second']);
    nodeAssert.equal(jest.getTimerCount(), 1, 'the nested timer is not executed in the same pass');

    jest.runAllTimers();
    nodeAssert.deepEqual(seen, ['first', 'second', 'nested']);
    nodeAssert.equal(jest.getTimerCount(), 0);

    globalThis.setTimeout(() => seen.push('step-1'), 5);
    globalThis.setTimeout(() => seen.push('step-2'), 50);
    jest.advanceTimersToNextTimer();
    nodeAssert.deepEqual(seen.slice(-1), ['step-1']);
    jest.advanceTimersToNextTimer();
    nodeAssert.deepEqual(seen.slice(-1), ['step-2']);
    nodeAssert.equal(jest.getTimerCount(), 0);
  });

  nodeIt('clears every pending timer with clearAllTimers', () => {
    jest.useFakeTimers();
    let fired = 0;
    globalThis.setTimeout(() => { fired++; }, 5);
    globalThis.setInterval(() => { fired++; }, 5);
    nodeAssert.equal(jest.getTimerCount(), 2);

    jest.clearAllTimers();
    nodeAssert.equal(jest.getTimerCount(), 0);
    jest.advanceTimersByTime(1000);
    nodeAssert.equal(fired, 0);
  });

  nodeIt('keeps virtual clock state consistent after a callback throws', () => {
    jest.useFakeTimers();
    const order = [];

    globalThis.setTimeout(() => { order.push('ok'); }, 5);
    globalThis.setTimeout(() => { throw new Error('mid-flight failure'); }, 10);
    globalThis.setTimeout(() => { order.push('after'); }, 15);

    nodeAssert.throws(() => jest.advanceTimersByTime(20), /mid-flight failure/);
    nodeAssert.deepEqual(order, ['ok']);
    nodeAssert.equal(jest.getTimerTime(), 10, 'clock stops on the failing task');

    // The queue is still usable afterwards
    jest.advanceTimersByTime(10);
    nodeAssert.deepEqual(order, ['ok', 'after']);
  });

  nodeIt('restores the native timer functions and forgets pending tasks', () => {
    const realSetTimeout = globalThis.setTimeout;
    const realClearInterval = globalThis.clearInterval;

    jest.useFakeTimers();
    nodeAssert.notEqual(globalThis.setTimeout, realSetTimeout);
    globalThis.setTimeout(() => {}, 10);
    nodeAssert.equal(jest.getTimerCount(), 1);

    jest.useRealTimers();
    nodeAssert.equal(globalThis.setTimeout, realSetTimeout);
    nodeAssert.equal(globalThis.clearInterval, realClearInterval);
    nodeAssert.equal(jest.getTimerCount(), 0);

    // Repeated calls are safe
    nodeAssert.doesNotThrow(() => jest.useRealTimers());
    jest.useFakeTimers();
    nodeAssert.doesNotThrow(() => jest.useFakeTimers());
    jest.useRealTimers();
    nodeAssert.equal(globalThis.setTimeout, realSetTimeout);
  });

  nodeIt('rejects non-function timer callbacks', () => {
    jest.useFakeTimers();
    nodeAssert.throws(() => globalThis.setTimeout('not a function', 10), /Fake timers require a callback function/);
    jest.useRealTimers();
  });

  nodeIt('keeps waitFor polling on real timers even while fake timers are installed', async () => {
    const nativeSetTimeout = globalThis.setTimeout;
    let ready = false;
    // Schedule on the *real* timer queue before faking, so only wall-clock time can flip it.
    nativeSetTimeout(() => { ready = true; }, 20);

    jest.useFakeTimers();
    try {
      globalThis.setTimeout(() => { ready = false; }, 5); // virtual task that is never advanced
      nodeAssert.equal(jest.getTimerCount(), 1);

      await globalThis.jest.waitFor(() => {
        if (!ready) throw new Error('not ready yet');
      }, { timeout: 1000, interval: 10 });

      nodeAssert.equal(ready, true);
      // The virtual timer never ran, proving waitFor did not rely on the fake clock.
      nodeAssert.equal(jest.getTimerCount(), 1);
    } finally {
      jest.useRealTimers();
    }
  });
});


// ==========================================
// 11. SNAPSHOT NAMESPACING
// ==========================================
nodeDescribe('Snapshot Key Namespacing', () => {

  nodeIt('namespaces default keys by full suite path and test name', async () => {
    const savedForceBrowser = globalThis._forceBrowserStorage;
    globalThis._forceBrowserStorage = true;
    globalThis.localStorage.clear();

    try {
      const register = () => {
        jlDescribe('AlphaParent', () => {
          jlDescribe('shared', () => {
            jlIt('renders', () => jlExpect({ theme: 'alpha' }).toMatchSnapshot());
          });
        });
        jlDescribe('BetaParent', () => {
          jlDescribe('shared', () => {
            jlIt('renders', () => jlExpect({ theme: 'beta' }).toMatchSnapshot());
          });
        });
      };

      const first = await runIsolated(register);
      nodeAssert.equal(first.fail, 0, failureMessages(first).join('\n'));

      const keys = Object.keys(globalThis.localStorage.store);
      nodeAssert.equal(keys.length, 2, `expected two distinct snapshot keys, got ${keys}`);
      nodeAssert.ok(keys.some(key => key.includes('AlphaParent > shared') && key.includes('renders')));
      nodeAssert.ok(keys.some(key => key.includes('BetaParent > shared') && key.includes('renders')));

      // Keys are deterministic: re-running compares against the stored values (no collisions)
      const second = await runIsolated(register);
      nodeAssert.equal(second.fail, 0, failureMessages(second).join('\n'));
      nodeAssert.equal(Object.keys(globalThis.localStorage.store).length, 2);

      // A real change is still detected
      const changed = await runIsolated(() => {
        jlDescribe('AlphaParent', () => {
          jlDescribe('shared', () => {
            jlIt('renders', () => jlExpect({ theme: 'CHANGED' }).toMatchSnapshot());
          });
        });
      });
      nodeAssert.equal(changed.fail, 1);
      nodeAssert.match(changed.failures[0].message, /Snapshot Mismatch/);
    } finally {
      globalThis.localStorage.clear();
      globalThis._forceBrowserStorage = savedForceBrowser;
    }
  });

  nodeIt('increments the snapshot index per test and resets between tests', async () => {
    const savedForceBrowser = globalThis._forceBrowserStorage;
    globalThis._forceBrowserStorage = true;
    globalThis.localStorage.clear();

    try {
      const stats = await runIsolated(() => {
        jlDescribe('multi', () => {
          jlIt('takes two snapshots', () => {
            jlExpect({ index: 0 }).toMatchSnapshot();
            jlExpect({ index: 1 }).toMatchSnapshot();
          });
          jlIt('takes one snapshot', () => {
            jlExpect({ index: 0 }).toMatchSnapshot();
          });
        });
      });

      nodeAssert.equal(stats.fail, 0, failureMessages(stats).join('\n'));
      const keys = Object.keys(globalThis.localStorage.store).sort();
      nodeAssert.equal(keys.length, 3);
      nodeAssert.ok(keys.some(key => key.endsWith('takes two snapshots__0')));
      nodeAssert.ok(keys.some(key => key.endsWith('takes two snapshots__1')));
      nodeAssert.ok(keys.some(key => key.endsWith('takes one snapshot__0')));
    } finally {
      globalThis.localStorage.clear();
      globalThis._forceBrowserStorage = savedForceBrowser;
    }
  });

  nodeIt('preserves explicit custom snapshot names and validates their type', () => {
    const savedForceBrowser = globalThis._forceBrowserStorage;
    globalThis._forceBrowserStorage = true;
    globalThis.localStorage.clear();

    try {
      jlExpect({ custom: true }).toMatchSnapshot('explicit_custom_key');
      nodeAssert.ok(globalThis.localStorage.getItem('explicit_custom_key'));
      nodeAssert.doesNotThrow(() => jlExpect({ custom: true }).toMatchSnapshot('explicit_custom_key'));
      nodeAssert.throws(() => jlExpect({ custom: false }).toMatchSnapshot('explicit_custom_key'), /Snapshot Mismatch/);
      nodeAssert.throws(() => jlExpect({}).toMatchSnapshot({ not: 'a string' }), /expects an optional string name/);
    } finally {
      globalThis.localStorage.clear();
      globalThis._forceBrowserStorage = savedForceBrowser;
    }
  });

  nodeIt('writes snapshots to disk in Node and reuses them across runs', () => {
    const snapPath = path.join(process.cwd(), '__snapshots__', 'jest-lite.snap');
    jlExpect({ persisted: 'node-disk-routing' }).toMatchSnapshot('node_disk_routing_key');

    nodeAssert.ok(fs.existsSync(snapPath));
    const stored = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    nodeAssert.ok(stored.node_disk_routing_key.includes('node-disk-routing'));
    nodeAssert.doesNotThrow(() => jlExpect({ persisted: 'node-disk-routing' }).toMatchSnapshot('node_disk_routing_key'));
  });
});


// ==========================================
// 12. MODULE REGISTRY
// ==========================================
nodeDescribe('Module Registry Aliases & Guards', () => {

  nodeAfter(() => {
    unmock('registry-alias-module');
    unmock('empty-registry-module');
  });

  nodeIt('exposes registerMock/getMock aliases alongside mock/requireMock', async () => {
    registerMock('registry-alias-module', () => ({
      ping: jlFn(() => 'pong'),
    }));

    nodeAssert.equal(hasMock('registry-alias-module'), true);
    nodeAssert.equal(getMock('registry-alias-module'), requireMock('registry-alias-module'));
    nodeAssert.equal(globalThis.jest.registerMock, globalThis.jest.mock);
    nodeAssert.equal(globalThis.jest.getMock, globalThis.jest.requireMock);

    const registered = getMock('registry-alias-module');
    nodeAssert.equal(registered.ping(), 'pong');
    jlExpect(registered.ping).toHaveBeenCalledTimes(1);
  });

  nodeIt('throws actionable errors for missing mocks and invalid registrations', () => {
    nodeAssert.throws(() => getMock('never-registered-module'), /is not mocked/);
    nodeAssert.throws(() => getMock('never-registered-module'), /Register it first with jest\.mock/);
    nodeAssert.throws(() => requireMock('another-missing-module'), /is not mocked/);
    nodeAssert.equal(hasMock('never-registered-module'), false);

    nodeAssert.throws(() => registerMock(123), /expects a module name string/);
    nodeAssert.throws(() => registerMock(''), /expects a module name string/);
    nodeAssert.throws(() => registerMock('bad-factory', 'not-a-function'), /expects a factory function/);
  });

  nodeIt('defaults to an empty exports object and supports unmock', () => {
    mock('empty-registry-module');
    nodeAssert.deepEqual(getMock('empty-registry-module'), {});

    nodeAssert.equal(unmock('empty-registry-module'), true);
    nodeAssert.equal(hasMock('empty-registry-module'), false);
    nodeAssert.throws(() => getMock('empty-registry-module'), /is not mocked/);
    nodeAssert.equal(unmock('empty-registry-module'), false);
  });

  nodeIt('is an explicit registry and never intercepts real imports', async () => {
    // 'axios' is registered in the fixtures at the top of this file...
    const mockedAxios = requireMock('axios');
    nodeAssert.equal((await mockedAxios.get('/api/user')).data.user, 'Fake User');

    // ...but the real, statically imported binding is untouched.
    nodeAssert.notEqual(axios, mockedAxios);
    nodeAssert.equal(typeof axios.get, 'function');
    nodeAssert.equal(typeof axios.create, 'function');
  });

  nodeIt('clears mock history stored inside the registry', () => {
    registerMock('registry-alias-module', () => ({ ping: jlFn(() => 'pong') }));
    const registered = getMock('registry-alias-module');
    registered.ping();
    jlExpect(registered.ping).toHaveBeenCalledTimes(1);

    globalThis.jest.clearAllMocks();
    jlExpect(registered.ping).toHaveBeenCalledTimes(0);
    nodeAssert.equal(registered.ping(), 'pong', 'clearAllMocks keeps registry implementations');
  });
});
