import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const script = new URL('./check-exact-deps', import.meta.url).pathname;

function check(pkg) {
  const dir = mkdtempSync(join(tmpdir(), 'exact-deps-'));
  const file = join(dir, 'package.json');
  writeFileSync(file, JSON.stringify(pkg));
  return spawnSync('node', [script, file], { encoding: 'utf8' });
}

function rejected(version) {
  const result = check({ devDependencies: { a: '1.2.3', b: version } });
  return {
    status: result.status,
    names: result.stderr.includes(`b@${version}`),
  };
}

test('check-exact-deps passes when every version is exact', () => {
  const result = check({
    dependencies: { a: '1.2.3' },
    devDependencies: { b: '10.0.21' },
  });
  expect(result.status).toBe(0);
});

test('check-exact-deps passes with no dependencies', () => {
  expect(check({}).status).toBe(0);
});

const failed = { status: 1, names: true };
test('check-exact-deps fails on a caret range', () => {
  expect(rejected('^1.2.3')).toEqual(failed);
});
test('check-exact-deps fails on a tilde range', () => {
  expect(rejected('~1.2.3')).toEqual(failed);
});
test('check-exact-deps fails on a comparator range', () => {
  expect(rejected('>=1.2.3')).toEqual(failed);
});
test('check-exact-deps fails on a two-part version', () => {
  expect(rejected('1.2')).toEqual(failed);
});
test('check-exact-deps fails on an x-range', () => {
  expect(rejected('1.x')).toEqual(failed);
});
test('check-exact-deps fails on a dist-tag', () => {
  expect(rejected('latest')).toEqual(failed);
});
test('check-exact-deps fails on a wildcard', () => {
  expect(rejected('*')).toEqual(failed);
});
test('check-exact-deps fails on a prerelease version', () => {
  expect(rejected('1.2.3-beta.1')).toEqual(failed);
});

test('check-exact-deps fails on a caret in dependencies', () => {
  expect(check({ dependencies: { a: '^1.0.0' } }).status).toBe(1);
});
test('check-exact-deps fails on a caret in devDependencies', () => {
  expect(check({ devDependencies: { a: '^1.0.0' } }).status).toBe(1);
});
test('check-exact-deps fails on a caret in optionalDependencies', () => {
  expect(check({ optionalDependencies: { a: '^1.0.0' } }).status).toBe(1);
});
test('check-exact-deps fails on a caret in peerDependencies', () => {
  expect(check({ peerDependencies: { a: '^1.0.0' } }).status).toBe(1);
});
