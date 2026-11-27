import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { violations } from './check-comments.js';

// NOTE: biome flags a literal dollar-brace in a quoted string, so tests write @{ for it.
const dollar = (source) => source.replaceAll('@{', '${');
const script = new URL('./check-comments.js', import.meta.url).pathname;

test('a NOTE: line comment passes', () => {
  expect(violations('// NOTE: because x\nconst a = 1;')).toEqual([]);
});

test('a restating line comment fails with its line number', () => {
  expect(violations('const a = 1;\n// set a to 1\n')).toEqual([
    { line: 2, text: ' set a to 1' },
  ]);
});

test('block comments need NOTE:', () => {
  expect(violations('/* NOTE: ok */')).toEqual([]);
  expect(violations('/* nope */')).toHaveLength(1);
});

test('JSDoc blocks pass without NOTE:', () => {
  expect(violations('/** Throws when x. */\n/**\n * Multi.\n */')).toEqual([]);
});

test('comment markers inside strings, templates and regexes are ignored', () => {
  const source = [
    "const a = 'http://x';",
    'const b = "/* y */";',
    'const c = `// @{1 + 1} /* @{`// nested`} */`;',
    'const d = /\\/\\/[/]/;',
    'const e = 4 / 2; const f = 8 / 2;',
  ].join('\n');
  expect(violations(dollar(source))).toEqual([]);
});

test('a comment after a template expression is still found', () => {
  expect(violations(dollar('const a = `@{b}`; // bad'))).toHaveLength(1);
});

function run(source) {
  const dir = mkdtempSync(join(tmpdir(), 'check-comments-'));
  const file = join(dir, 'a.ts');
  writeFileSync(file, source);
  return spawnSync('node', [script, file], { encoding: 'utf8' });
}

test('the script exits non-zero and prints the guidance on a bad comment', () => {
  const result = run('// restates\nconst a = 1;\n');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('a.ts:1');
  expect(result.stderr).toContain('delete it, or rename and extract');
});

test('the script exits zero on clean files', () => {
  expect(run('// NOTE: why\nconst a = 1;\n').status).toBe(0);
});

test('an unterminated block comment is reported once', () => {
  const found = violations('const a = 1;\n/* never closed');
  expect(found.map(({ line }) => line)).toEqual([2]);
});

test('a comment after a nested template expression is found on its own line', () => {
  const source = dollar('const a = `x@{`y@{1}`}`;\n// restates\n');
  expect(violations(source).map(({ line }) => line)).toEqual([2]);
});

test('a quote inside a regex character class does not open a string', () => {
  expect(violations('const r = /[\'"]/;\n// restates\n')).toEqual([
    { line: 2, text: ' restates' },
  ]);
});
