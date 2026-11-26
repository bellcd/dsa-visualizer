import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

function lint(script) {
  return spawnSync('npm', ['run', '--silent', script], { encoding: 'utf8' });
}

test('lint:strict passes', () => {
  expect(lint('lint:strict').status).toBe(0);
});

test('lint:all fails on a rule that is not in the strict set', () => {
  const result = lint('lint:all');
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain(
    'lint/complexity/noExcessiveCognitiveComplexity',
  );
});
