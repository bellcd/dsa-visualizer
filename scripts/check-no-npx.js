#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MESSAGE =
  'Do not shell out through npx or npm exec: it downloads an unpinned package when the tool is not installed. Call ./node_modules/.bin/<tool> or an npm run script.';

const SCAN_DIRS = ['scripts', 'test', 'src', '.husky', '.github/workflows'];
const SKIP_DIRS = new Set(['node_modules']);
const OWN_FILES = new Set([
  'scripts/check-no-npx.js',
  'scripts/check-no-npx.test.js',
]);

const SHELL_NPX = /(^|[\s;&|(`'"])npx($|[\s'"`])/;
const SHELL_NPM_EXEC = /(^|[\s;&|(`'"])npm\s+exec($|[\s'"`])/;
const SPAWN_NPM_EXEC = /['"`]npm['"`]\s*,\s*\[\s*['"`]exec['"`]/;

function usesNpx(line) {
  return (
    SHELL_NPX.test(line) ||
    SHELL_NPM_EXEC.test(line) ||
    SPAWN_NPM_EXEC.test(line)
  );
}

function findNpxLines(source) {
  const found = [];
  const lines = source.split('\n');
  for (const [index, text] of lines.entries()) {
    if (usesNpx(text)) found.push(index + 1);
  }
  return found;
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : listFiles(path);
    }
    return OWN_FILES.has(path) ? [] : [path];
  });
}

function main(args) {
  const files = args.length > 0 ? args : SCAN_DIRS.flatMap(listFiles);
  let failed = false;
  for (const file of files) {
    for (const line of findNpxLines(readFileSync(file, 'utf8'))) {
      console.error(`${file}:${line}: ${MESSAGE}`);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) main(process.argv.slice(2));
