#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MESSAGE =
  'A comment earns its place only for a why the code can\'t express, and it must start with "NOTE:". Otherwise delete it, or rename and extract until it is unnecessary.';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.stryker-tmp']);
const REGEX_PRECEDERS = /[)\]}\w$]/;

function findComments(source) {
  const found = [];
  const templateDepths = [];
  let braceDepth = 0;
  let line = 1;
  let lastSignificant = '';
  let i = 0;

  const advance = (to) => {
    for (; i < to; i++) if (source[i] === '\n') line++;
  };

  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    if (c === '/' && next === '/') {
      let end = source.indexOf('\n', i);
      if (end === -1) end = source.length;
      found.push({ line, text: source.slice(i + 2, end) });
      advance(end);
    } else if (c === '/' && next === '*') {
      let end = source.indexOf('*/', i + 2);
      end = end === -1 ? source.length : end + 2;
      found.push({ line, text: source.slice(i + 2, end - 2) });
      advance(end);
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== '\n') {
        j += source[j] === '\\' ? 2 : 1;
      }
      advance(j + 1);
      lastSignificant = c;
    } else if (
      c === '`' ||
      (c === '}' && templateDepths[templateDepths.length - 1] === braceDepth)
    ) {
      if (c === '}') templateDepths.pop();
      let j = i + 1;
      let opensExpression = false;
      while (j < source.length && source[j] !== '`') {
        if (source[j] === '\\') j += 2;
        else if (source[j] === '$' && source[j + 1] === '{') {
          opensExpression = true;
          break;
        } else j++;
      }
      if (opensExpression) {
        templateDepths.push(braceDepth);
        advance(j + 2);
        lastSignificant = '{';
      } else {
        advance(j + 1);
        lastSignificant = '`';
      }
    } else if (c === '/' && !REGEX_PRECEDERS.test(lastSignificant)) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n') {
        if (source[j] === '\\') j++;
        else if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        else if (source[j] === '/' && !inClass) break;
        j++;
      }
      advance(j + 1);
      lastSignificant = '/';
    } else {
      if (c === '{') braceDepth++;
      if (c === '}') braceDepth--;
      if (!/\s/.test(c)) lastSignificant = c;
      advance(i + 1);
    }
  }
  return found;
}

export function violations(source) {
  return findComments(source).filter(
    ({ text }) => !text.replace(/^[\s*]+/, '').startsWith('NOTE:'),
  );
}

function listTypeScriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : listTypeScriptFiles(path);
    }
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

function main(args) {
  const files =
    args.length > 0
      ? args.filter((f) => f.endsWith('.ts'))
      : listTypeScriptFiles('.');
  let failed = false;
  for (const file of files) {
    for (const { line } of violations(readFileSync(file, 'utf8'))) {
      console.error(`${file}:${line}: ${MESSAGE}`);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) main(process.argv.slice(2));
