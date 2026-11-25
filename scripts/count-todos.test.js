import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

const script = new URL("./count-todos.sh", import.meta.url).pathname;

function repo(files, { track = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "count-todos-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  if (track) execFileSync("git", ["add", "-A", "-f"], { cwd: dir });
  return dir;
}

const run = (cwd) => spawnSync("bash", [script], { cwd, encoding: "utf8" });

test("prints path: count, sorted, skipping files without TODO", () => {
  const dir = repo({
    "src/b.ts": "// TODO one\n// TODO two\n",
    "src/a/z.ts": "// TODO\n",
    "src/clean.ts": "nothing\n",
  });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "src/a/z.ts: 1\nsrc/b.ts: 2\n");
});

test("ignores files outside src/", () => {
  const dir = repo({ "src/a.ts": "TODO\n", "docs/x.md": "TODO\n" });
  assert.equal(run(dir).stdout, "src/a.ts: 1\n");
});

test("skips untracked and ignored files", () => {
  const dir = repo({ "src/a.ts": "TODO\n", ".gitignore": "src/ignored.ts\n" });
  writeFileSync(join(dir, "src/ignored.ts"), "TODO\n");
  writeFileSync(join(dir, "src/untracked.ts"), "TODO\n");
  assert.equal(run(dir).stdout, "src/a.ts: 1\n");
});

test("handles spaces in file names", () => {
  const dir = repo({ "src/my file.ts": "TODO\n" });
  assert.equal(run(dir).stdout, "src/my file.ts: 1\n");
});

test("prints nothing when no file has a TODO", () => {
  const result = run(repo({ "src/a.ts": "ok\n" }));
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("exits non-zero when src/ is missing", () => {
  const result = run(repo({ "README.md": "TODO\n" }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src\//);
});
