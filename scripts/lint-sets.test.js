import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

function lint(script) {
  return spawnSync('npm', ['run', '--silent', script], { encoding: 'utf8' });
}

test('npm run lint:strict exits 0', () => {
  expect(lint('lint:strict').status).toBe(0);
});

test('npm run lint:all exits non-zero on a rule missing from strict', () => {
  const result = lint('lint:all');
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain(
    'lint/complexity/noExcessiveCognitiveComplexity',
  );
});
