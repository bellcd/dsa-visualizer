import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = new URL("./line-counts.sh", import.meta.url).pathname;

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "line-counts-"));
  git(dir, "init", "-q");
  return dir;
}

function run(cwd) {
  return spawnSync("bash", [script], { cwd, encoding: "utf8" });
}

test("line-counts.sh prints count and path for each tracked file under src/", () => {
  const dir = repo();
  mkdirSync(join(dir, "src/sub"), { recursive: true });
  writeFileSync(join(dir, "src/a.ts"), "one\ntwo\nthree\n");
  writeFileSync(join(dir, "src/sub/b.ts"), "x\n\n// c\n");
  writeFileSync(join(dir, "outside.ts"), "ignored\n");
  git(dir, "add", ".");
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "3 src/a.ts\n3 src/sub/b.ts\n");
});

test("line-counts.sh leaves out untracked and ignored files", () => {
  const dir = repo();
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, ".gitignore"), "src/ignored.ts\n");
  writeFileSync(join(dir, "src/tracked.ts"), "a\n");
  writeFileSync(join(dir, "src/untracked.ts"), "a\n");
  writeFileSync(join(dir, "src/ignored.ts"), "a\n");
  git(dir, "add", "src/tracked.ts");
  assert.equal(run(dir).stdout, "1 src/tracked.ts\n");
});

test("line-counts.sh handles paths with spaces", () => {
  const dir = repo();
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/my file.ts"), "a\nb\n");
  git(dir, "add", ".");
  assert.equal(run(dir).stdout, "2 src/my file.ts\n");
});

test("line-counts.sh exits 1 with a message on stderr when src/ is missing", () => {
  const result = run(repo());
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "line-counts.sh: src/ does not exist\n");
});
