import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./list-scripts.sh', import.meta.url).pathname;

function list(pkg) {
  const dir = mkdtempSync(join(tmpdir(), 'list-scripts-'));
  const file = join(dir, 'package.json');
  if (pkg !== undefined) writeFileSync(file, JSON.stringify(pkg));
  return spawnSync(script, [file], { encoding: 'utf8' });
}

test('list-scripts.sh prints name: command lines sorted by name', () => {
  const result = list({ scripts: { test: 'node --test', build: 'tsc', lint: 'eslint .' } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'build: tsc\nlint: eslint .\ntest: node --test\n');
});

test('list-scripts.sh exits non-zero when package.json is missing', () => {
  assert.notEqual(list(undefined).status, 0);
});

test('list-scripts.sh exits non-zero when package.json has no scripts key', () => {
  assert.notEqual(list({}).status, 0);
});

test('list-scripts.sh exits non-zero when package.json has an empty scripts object', () => {
  assert.notEqual(list({ scripts: {} }).status, 0);
});

test('list-scripts.sh reads ./package.json when given no argument', () => {
  const result = spawnSync(script, { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname });
  assert.equal(result.status, 0);
  assert.notEqual(result.stdout, '');
});
