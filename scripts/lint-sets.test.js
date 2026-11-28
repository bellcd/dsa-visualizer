import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function lint(script) {
  return spawnSync('npm', ['run', '--silent', script], { encoding: 'utf8' });
}

test('npm run lint:strict exits 0', () => {
  expect(lint('lint:strict').status).toBe(0);
});

test('npm run lint:all exits 0 while no rule is waiting for promotion', () => {
  expect(lint('lint:all').status).toBe(0);
});

function lintSource(source) {
  const directory = mkdtempSync(join(process.cwd(), 'lint-probe-'));
  try {
    const file = join(directory, 'probe.ts');
    writeFileSync(file, source);
    return spawnSync('./node_modules/.bin/biome', ['lint', file], {
      encoding: 'utf8',
    });
  } finally {
    rmSync(directory, { recursive: true });
  }
}

const ARRAY_MESSAGE =
  'Write an array of an inline object, union or function type as `Array<T>`, not `T[]`.';

test('strict lint set rejects an array of an inline object type and names Array<T>', () => {
  const result = lintSource('export type X = { a: string }[];\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(ARRAY_MESSAGE);
});

test('strict lint set rejects an array of a union type', () => {
  const result = lintSource('export type X = (string | number)[];\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(ARRAY_MESSAGE);
});

test('strict lint set rejects an array of a function type', () => {
  const result = lintSource('export type X = (() => void)[];\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(ARRAY_MESSAGE);
});

test('strict lint set accepts Array<{ a: string }>', () => {
  expect(lintSource('export type X = Array<{ a: string }>;\n').status).toBe(0);
});

test('strict lint set accepts string[]', () => {
  expect(lintSource('export type X = string[];\n').status).toBe(0);
});

test('strict lint set accepts User[]', () => {
  const source = 'interface User { id: string }\nexport type X = User[];\n';
  expect(lintSource(source).status).toBe(0);
});

const TR_MESSAGE =
  'Do not name a declaration `tr`: it is ambiguous. Spell it out, e.g. `recordedTrace` for a trace.';

test('strict lint set rejects a variable named tr', () => {
  const result = lintSource('export const tr = 1;\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(TR_MESSAGE);
});

test('strict lint set rejects a parameter named tr', () => {
  const result = lintSource('export const f = (tr: number) => tr;\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(TR_MESSAGE);
});

test('strict lint set rejects a destructured binding named tr', () => {
  const result = lintSource('export const { tr } = { tr: 1 };\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(TR_MESSAGE);
});

test('strict lint set rejects a loop variable named tr', () => {
  const result = lintSource('for (const tr of [1]) { console.log(tr); }\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(TR_MESSAGE);
});

test('strict lint set rejects a catch binding named tr', () => {
  const result = lintSource('try { f(); } catch (tr) { console.log(tr); }\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(TR_MESSAGE);
});

test('strict lint set accepts variables named trace and trackIds', () => {
  const source = 'export const trace = 1;\nexport const trackIds = 2;\n';
  expect(lintSource(source).status).toBe(0);
});
