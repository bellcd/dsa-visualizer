import { spawnSync } from 'node:child_process';
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
