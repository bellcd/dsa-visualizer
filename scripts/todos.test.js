import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = new URL("./todos", import.meta.url).pathname;

function run(files) {
  const dir = mkdtempSync(join(tmpdir(), "todos-"));
  for (const [name, content] of Object.entries(files)) {
    const file = join(dir, name);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content);
  }
  const result = spawnSync("node", [script, dir], { encoding: "utf8" });
  const lines = result.stdout.split("\n").filter(Boolean);
  return { dir, status: result.status, lines };
}

test("prints TODO and FIXME comments as path:line: text", () => {
  const { dir, lines } = run({
    "a.ts": "const x = 1;\n// TODO: first\n/* FIXME second */\n",
  });
  assert.deepEqual(lines, [
    `${join(dir, "a.ts")}:2: TODO: first`,
    `${join(dir, "a.ts")}:3: FIXME second`,
  ]);
});

test("sorts by path, then by line", () => {
  const { dir, lines } = run({
    "b.ts": "// TODO b1\n",
    "a/z.ts": "// TODO z1\n\n// TODO z3\n",
    "a.ts": "// FIXME a1\n",
  });
  assert.deepEqual(lines, [
    `${join(dir, "a.ts")}:1: FIXME a1`,
    `${join(dir, "a/z.ts")}:1: TODO z1`,
    `${join(dir, "a/z.ts")}:3: TODO z3`,
    `${join(dir, "b.ts")}:1: TODO b1`,
  ]);
});

test("ignores lines without a TODO or FIXME comment", () => {
  const { lines } = run({
    "a.ts": 'const todo = "TODO";\n// nothing here\n// TODOS are not markers\n',
  });
  assert.deepEqual(lines, []);
});

test("prints nothing and succeeds when there are no files", () => {
  const { status, lines } = run({});
  assert.equal(status, 0);
  assert.deepEqual(lines, []);
});
