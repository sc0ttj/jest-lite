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
    describe('browser runtime', () => {
      test('exposes module and global APIs', () => {
        expect(typeof jest.fn).toBe('function');
        expect(typeof window.jest).toBe('object');
        expect(typeof window.describe).toBe('function');
      });

      test('uses browser snapshot storage', () => {
        expect({ runtime: 'browser' }).toMatchSnapshot('browser_smoke_snapshot');
      });
    });

    const passing = await run({ silent: true, setExitCode: false });

    describe('browser failure reporting', () => {
      test('records a failed assertion', () => expect(1).toBe(2));
    });
    const failing = await run({ silent: true, setExitCode: false });

    return {
      passing,
      failing,
      snapshot: localStorage.getItem('browser_smoke_snapshot'),
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

  assert.equal(result.passing.pass, 2);
  assert.equal(result.passing.fail, 0);
  assert.equal(result.failing.pass, 0);
  assert.equal(result.failing.fail, 1);
  assert.match(result.snapshot, /browser/);

  console.log('Browser smoke test passed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
