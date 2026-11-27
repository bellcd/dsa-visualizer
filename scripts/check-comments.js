#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MESSAGE =
  'A comment earns its place only for a why the code can\'t express, and it must start with "NOTE:". Otherwise delete it, or rename and extract until it is unnecessary.';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.stryker-tmp']);
const REGEX_PRECEDERS = /[)\]}\w$]/;

function advance(scan, to) {
  for (; scan.i < to; scan.i++) if (scan.source[scan.i] === '\n') scan.line++;
}

function scanLineComment(scan) {
  const { source, i, line } = scan;
  let end = source.indexOf('\n', i);
  if (end === -1) end = source.length;
  scan.found.push({ line, text: source.slice(i + 2, end) });
  advance(scan, end);
}

function scanBlockComment(scan) {
  const { source, i, line } = scan;
  let end = source.indexOf('*/', i + 2);
  end = end === -1 ? source.length : end + 2;
  scan.found.push({
    line,
    text: source.slice(i + 2, end - 2),
    jsdoc: source[i + 2] === '*' && end - i > 4,
  });
  advance(scan, end);
}

function scanString(scan, quote) {
  const { source } = scan;
  let j = scan.i + 1;
  while (j < source.length && source[j] !== quote && source[j] !== '\n') {
    j += source[j] === '\\' ? 2 : 1;
  }
  advance(scan, j + 1);
  scan.lastSignificant = quote;
}

function scanTemplate(scan, closesExpression) {
  const { source, templateDepths } = scan;
  if (closesExpression) templateDepths.pop();
  let j = scan.i + 1;
  let opensExpression = false;
  while (j < source.length && source[j] !== '`') {
    if (source[j] === '\\') j += 2;
    else if (source[j] === '$' && source[j + 1] === '{') {
      opensExpression = true;
      break;
    } else j++;
  }
  if (opensExpression) templateDepths.push(scan.braceDepth);
  advance(scan, opensExpression ? j + 2 : j + 1);
  scan.lastSignificant = opensExpression ? '{' : '`';
}

function scanRegex(scan) {
  const { source } = scan;
  let j = scan.i + 1;
  let inClass = false;
  while (j < source.length && source[j] !== '\n') {
    if (source[j] === '\\') j++;
    else if (source[j] === '[') inClass = true;
    else if (source[j] === ']') inClass = false;
    else if (source[j] === '/' && !inClass) break;
    j++;
  }
  advance(scan, j + 1);
  scan.lastSignificant = '/';
}

function scanOther(scan, c) {
  if (c === '{') scan.braceDepth++;
  if (c === '}') scan.braceDepth--;
  if (!/\s/.test(c)) scan.lastSignificant = c;
  advance(scan, scan.i + 1);
}

function scanNext(scan) {
  const c = scan.source[scan.i];
  const next = scan.source[scan.i + 1];
  const closesExpression =
    c === '}' &&
    scan.templateDepths[scan.templateDepths.length - 1] === scan.braceDepth;

  if (c === '/' && next === '/') scanLineComment(scan);
  else if (c === '/' && next === '*') scanBlockComment(scan);
  else if (c === '"' || c === "'") scanString(scan, c);
  else if (c === '`' || closesExpression) scanTemplate(scan, closesExpression);
  else if (c === '/' && !REGEX_PRECEDERS.test(scan.lastSignificant)) {
    scanRegex(scan);
  } else scanOther(scan, c);
}

function findComments(source) {
  const scan = {
    source,
    found: [],
    templateDepths: [],
    braceDepth: 0,
    line: 1,
    lastSignificant: '',
    i: 0,
  };
  while (scan.i < source.length) scanNext(scan);
  return scan.found;
}

export function violations(source) {
  return findComments(source).filter(
    ({ text, jsdoc }) =>
      !jsdoc && !text.replace(/^[\s*]+/, '').startsWith('NOTE:'),
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
