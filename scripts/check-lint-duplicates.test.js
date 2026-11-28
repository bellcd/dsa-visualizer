import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const script = new URL('./check-lint-duplicates.js', import.meta.url).pathname;

function check(params) {
  const dir = mkdtempSync(join(tmpdir(), 'lint-duplicates-'));
  const strictPath = join(dir, 'strict.json');
  const allPath = join(dir, 'all.json');
  writeFileSync(strictPath, JSON.stringify(params.strict));
  writeFileSync(allPath, JSON.stringify(params.all));
  const result = spawnSync('node', [script, strictPath, allPath], {
    encoding: 'utf8',
  });
  return { result, strictPath, allPath };
}

const strict = {
  linter: {
    rules: {
      preset: 'recommended',
      complexity: { noExcessiveCognitiveComplexity: 'error' },
    },
  },
};

test('check-lint-duplicates fails and names the rule when the all-config repeats a strict rule at another severity', () => {
  const { result, strictPath, allPath } = check({
    strict,
    all: {
      linter: {
        rules: { complexity: { noExcessiveCognitiveComplexity: 'warn' } },
      },
    },
  });
  const expected = `complexity/noExcessiveCognitiveComplexity is already set in ${strictPath}. Delete it from ${allPath}.\n`;
  expect(result.status).toBe(1);
  expect(result.stderr).toBe(expected);
});

test('check-lint-duplicates passes when the all-config holds a rule absent from strict', () => {
  const { result } = check({
    strict,
    all: { linter: { rules: { complexity: { noForEach: 'error' } } } },
  });
  expect(result.status).toBe(0);
});

test('check-lint-duplicates passes when the same rule name sits in a different group', () => {
  const { result } = check({
    strict,
    all: {
      linter: {
        rules: { style: { noExcessiveCognitiveComplexity: 'error' } },
      },
    },
  });
  expect(result.status).toBe(0);
});

test('check-lint-duplicates passes when the all-config sets no rules', () => {
  const { result } = check({ strict, all: { extends: ['../biome.json'] } });
  expect(result.status).toBe(0);
});

test('check-lint-duplicates passes on the repository configs', () => {
  const result = spawnSync('node', [script], { encoding: 'utf8' });
  expect(result.status).toBe(0);
});
