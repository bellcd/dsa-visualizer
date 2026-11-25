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

test.each([
  '^1.2.3',
  '~1.2.3',
  '>=1.2.3',
  '1.2',
  '1.x',
  'latest',
  '*',
  '1.2.3-beta.1',
])('check-exact-deps fails on %s and names the dependency', (version) => {
  const result = check({ devDependencies: { a: '1.2.3', b: version } });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`devDependencies: b@${version}`);
});

test.each([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
])('check-exact-deps checks %s', (section) => {
  expect(check({ [section]: { a: '^1.0.0' } }).status).toBe(1);
});
