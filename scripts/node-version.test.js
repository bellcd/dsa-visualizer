import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./node-version.sh', import.meta.url).pathname;
const repoNvmrc = new URL('../.nvmrc', import.meta.url).pathname;

// NOTE: the script finds .nvmrc relative to itself, so it is copied to control whether one exists.
function scratchRepo(t, nvmrc) {
  const root = mkdtempSync(join(tmpdir(), 'node-version-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  const copy = join(root, 'scripts', 'node-version.sh');
  copyFileSync(script, copy);
  chmodSync(copy, 0o755);
  if (nvmrc !== undefined) writeFileSync(join(root, '.nvmrc'), nvmrc);
  return copy;
}

test('node-version.sh prints the version from .nvmrc', (t) => {
  const result = spawnSync(scratchRepo(t, '24\n'), { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '24\n');
});

test('node-version.sh exits non-zero when .nvmrc is missing', (t) => {
  const result = spawnSync(scratchRepo(t, undefined), { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});

test("node-version.sh prints this repo's .nvmrc version", () => {
  const result = spawnSync(script, { encoding: 'utf8' });
  const expected = readFileSync(repoNvmrc, 'utf8');
  const actual = result.stdout;
  assert.equal(result.status, 0);
  assert.equal(actual, expected);
});
