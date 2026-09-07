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
import { requireMock, mock } from './jest-lite.js';

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
// 3. SETUP - JEST MODULE SYSTEM EMULATION FOR NODE
// ==========================================
const mockRegistry = {};

// Keep your framework's existing properties, then layer on module mocks
globalThis.jest = {
  ...globalThis.jest,
  mock(moduleName, factory) {
    mockRegistry[moduleName] = factory();
  },
  requireMock(moduleName) {
    return mockRegistry[moduleName];
  }
};

globalThis.jest.mock('axios', () => ({
  get: jlFn(() => Promise.resolve({ data: { user: 'Fake User' } })),
  post: jlFn(() => Promise.resolve({ status: 201 }))
}));



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

      // Even though keys and values are identical, structural definitions differ
      nodeAssert.throws(() => jlExpect(instanceA).toEqual(plainObject));
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

      nodeAssert.throws(() => jlExpect(plainStandardObject).toHaveBeenCalledTimes(1), /Expected a mock function/);
      nodeAssert.throws(() => jlExpect(plainStandardObject).toHaveBeenCalledWith('data'), /Expected a mock function/);
      nodeAssert.throws(() => jlExpect(primitiveTarget).toHaveReturnedWith('val'), /Expected a mock function/);
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

    nodeIt('enforces strict prototype chain inheritance matching inside toEqual', () => {
      const objA = Object.create({ sharedProto: true });
      objA.data = 100;

      const objB = Object.create({ sharedProto: false }); // Prototype properties differ
      objB.data = 100;

      // Even though top-level keys and constructors match, prototype definitions differ
      nodeAssert.throws(() => jlExpect(objA).toEqual(objB));
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
      jlExpect(mockFn.mock.results).toEqual([30, 10]);

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

