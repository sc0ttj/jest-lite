import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const workDir = mkdtempSync(path.join(tmpdir(), 'jest-lite-package-'));

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', workDir],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = path.join(workDir, filename);

  const metadata = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(metadata.type, 'module');
  assert.ok(metadata.exports['.'].import);

  execFileSync('npm', ['init', '-y'], { cwd: workDir, stdio: 'ignore' });
  execFileSync('npm', ['install', '--ignore-scripts', tarball], { cwd: workDir, stdio: 'ignore' });

  const smoke = `
    import jest, { describe, expect, fn, run, test } from '@sc0ttj/jest-lite';
    if (typeof jest !== 'object' || typeof describe !== 'function' || typeof test !== 'function') {
      throw new Error('Package exports are incomplete');
    }
    const mock = fn(value => value * 2);
    mock(4);
    expect(mock).toHaveReturnedWith(8);
    describe('installed package', () => {
      test('runs through the public package export', () => expect(2 + 2).toBe(4));
    });
    const stats = await run({ silent: true, setExitCode: false });
    if (stats.pass !== 1 || stats.fail !== 0) throw new Error(JSON.stringify(stats));
  `;

  execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', smoke],
    { cwd: workDir, stdio: 'inherit' }
  );

  console.log('Package smoke test passed.');
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
