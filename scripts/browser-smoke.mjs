import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = path.resolve(import.meta.dirname, '..');

const html = `<!doctype html>
<meta charset="utf-8">
<title>jest-lite browser smoke</title>
<script type="module">
  import jest, { describe, expect, run, test } from '/jest-lite.js';

  window.smokePromise = (async () => {
    const RealDate = window.Date;
    const realPerformanceNow = window.performance.now;

    describe('browser runtime', () => {
      test('exposes module and global APIs', () => {
        expect(typeof jest.fn).toBe('function');
        expect(typeof window.jest).toBe('object');
        expect(typeof window.describe).toBe('function');
      });

      test('uses browser snapshot storage', () => {
        expect({ runtime: 'browser' }).toMatchSnapshot('browser_smoke_snapshot');
      });

      test('snapshots outerHTML after an interaction', () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Save';
        button.addEventListener('click', () => {
          button.disabled = true;
          button.textContent = 'Saved';
        });
        document.body.appendChild(button);

        button.click();

        expect(button.outerHTML).toMatchSnapshot('browser_html_snapshot');
      });

      test('advances Date and performance.now with fake timers', () => {
        jest.useFakeTimers();
        const wallClockStart = Date.now();
        const monotonicStart = performance.now();
        let callbackTime;

        setTimeout(() => {
          callbackTime = Date.now();
        }, 125);
        jest.advanceTimersByTime(125);

        expect(callbackTime).toBe(wallClockStart + 125);
        expect(new Date().getTime()).toBe(wallClockStart + 125);
        expect(Math.abs(performance.now() - monotonicStart - 125) < 0.001).toBe(true);
      });

      test('automatically restores browser clock globals', () => {
        expect(window.Date).toBe(RealDate);
        expect(window.performance.now).toBe(realPerformanceNow);
      });
    });

    const passing = await run({ silent: true, setExitCode: false });

    describe('browser snapshot updates', () => {
      test('re-records an existing snapshot for one run', () => {
        expect({ runtime: 'browser-updated' }).toMatchSnapshot('browser_smoke_snapshot');
      });
    });
    const updated = await run({
      silent: true,
      setExitCode: false,
      updateSnapshots: true,
    });

    describe('browser failure reporting', () => {
      test('records a failed assertion', () => expect(1).toBe(2));
    });
    const failing = await run({ silent: true, setExitCode: false });

    return {
      passing,
      updated,
      failing,
      snapshot: localStorage.getItem('browser_smoke_snapshot'),
      htmlSnapshot: localStorage.getItem('browser_html_snapshot'),
    };
  })();
</script>`;

const server = createServer(async (request, response) => {
  if (request.url === '/jest-lite.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    response.end(await readFile(path.join(repoRoot, 'jest-lite.js')));
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}`);
  const result = await page.evaluate(() => window.smokePromise);

  assert.equal(result.passing.pass, 5);
  assert.equal(result.passing.fail, 0);
  assert.equal(result.updated.pass, 1);
  assert.equal(result.updated.fail, 0);
  assert.equal(result.failing.pass, 0);
  assert.equal(result.failing.fail, 1);
  assert.match(result.snapshot, /browser-updated/);
  assert.equal(
    JSON.parse(result.htmlSnapshot),
    '<button type="button" disabled="">Saved</button>'
  );

  console.log('Browser smoke test passed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
