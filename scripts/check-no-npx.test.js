import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const script = new URL('./check-no-npx.js', import.meta.url).pathname;
const packageJsonPath = new URL('../package.json', import.meta.url).pathname;
const MESSAGE =
  'Do not shell out through npx or npm exec: it downloads an unpinned package when the tool is not installed. Call ./node_modules/.bin/<tool> or an npm run script.';

function check(name, content) {
  const file = join(mkdtempSync(join(tmpdir(), 'no-npx-')), name);
  writeFileSync(file, content);
  const result = spawnSync('node', [script, file], { encoding: 'utf8' });
  return { result, file };
}

test('check-no-npx fails and names file, line and the local bin form for a spawnSync npx call', () => {
  const { result, file } = check(
    'probe.js',
    "import { spawnSync } from 'node:child_process';\nspawnSync('npx', ['biome', 'lint']);\n",
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toBe(`${file}:2: ${MESSAGE}\n`);
});

test('check-no-npx fails on an npx shell string in a hook', () => {
  const { result, file } = check('pre-commit', 'echo hi\nnpx vitest run\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toBe(`${file}:2: ${MESSAGE}\n`);
});

test('check-no-npx fails on an npx step in a workflow', () => {
  const { result } = check('ci.yml', '      - run: npx stryker run\n');
  expect(result.status).toBe(1);
});

test('check-no-npx fails on npm exec in a shell string', () => {
  const { result } = check('run.sh', 'npm exec biome -- lint\n');
  expect(result.status).toBe(1);
});

test('check-no-npx fails on npm exec passed to spawnSync', () => {
  const { result } = check(
    'probe.js',
    "spawnSync('npm', ['exec', 'biome']);\n",
  );
  expect(result.status).toBe(1);
});

test('check-no-npx fails on npx passed to exec', () => {
  const { result } = check('probe.js', 'exec("npx vitest run");\n');
  expect(result.status).toBe(1);
});

test('check-no-npx passes on a call to a local binary', () => {
  const { result } = check(
    'probe.js',
    "spawnSync('./node_modules/.bin/biome', ['lint']);\n",
  );
  expect(result.status).toBe(0);
});

test('check-no-npx passes on npm run and a local binary in a shell string', () => {
  const { result } = check(
    'run.sh',
    'npm run check\n./node_modules/.bin/vitest run\n',
  );
  expect(result.status).toBe(0);
});

test('check-no-npx passes on the repository', () => {
  const result = spawnSync('node', [script], { encoding: 'utf8' });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});

test('the check script runs check-no-npx', () => {
  const { scripts } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  expect(scripts.check.split(' && ')).toContain('npm run check-no-npx');
});
