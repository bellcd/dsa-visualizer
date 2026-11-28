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

const SLICING_MESSAGE =
  'Do not count from the end with `.at(-n)` or `.slice(-n)`. Take the last element as `items[items.length - 1]` and a trailing subarray as `items.slice(items.length - n)`.';

test('strict lint set rejects .at(-1) and names length indexing', () => {
  const result = lintSource('export const x = [1].at(-1);\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(SLICING_MESSAGE);
});

test('strict lint set rejects .at(-2)', () => {
  const result = lintSource('export const x = [1].at(-2);\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(SLICING_MESSAGE);
});

test('strict lint set rejects .slice(-1)', () => {
  const result = lintSource('export const x = [1].slice(-1);\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(SLICING_MESSAGE);
});

test('strict lint set rejects .slice(-3)', () => {
  const result = lintSource('export const x = [1].slice(-3);\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(SLICING_MESSAGE);
});

test('strict lint set accepts length-based last element and trailing slice', () => {
  const source =
    'const items = [1, 2, 3];\nexport const last = items[items.length - 1];\nexport const tail = items.slice(items.length - 2);\n';
  expect(lintSource(source).status).toBe(0);
});

const INDEXED_MESSAGE =
  "Do not reach for a type by indexed access, e.g. `Operation['op']`. Use the named type, exporting it where it is defined, or inline it, e.g. `'a' | 'b'`.";

test('strict lint set rejects an indexed-access type', () => {
  const source =
    "interface Operation { op: string }\nexport type X = Operation['op'];\n";
  const result = lintSource(source);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(INDEXED_MESSAGE);
});

test('strict lint set rejects an indexed-access type by number', () => {
  const source =
    "declare function f(): { items: string[] };\nexport type X = ReturnType<typeof f>['items'][number];\n";
  const result = lintSource(source);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(INDEXED_MESSAGE);
});

test('strict lint set accepts value indexing with a literal', () => {
  expect(
    lintSource('const items = [1];\nexport const x = items[0];\n').status,
  ).toBe(0);
});
