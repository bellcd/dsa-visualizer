import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

const script = new URL("./largest-files.sh", import.meta.url).pathname;

function repo(files, { ignore = "" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "largest-files-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir });
  git("init", "-q");
  if (ignore) writeFileSync(join(dir, ".gitignore"), ignore);
  for (const [path, size] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), "x".repeat(size));
  }
  git("add", "-A", "-f", "--", "src");
  if (ignore) git("add", ".gitignore");
  return dir;
}

const run = (cwd) => spawnSync("bash", [script], { cwd, encoding: "utf8" });

test("lists files largest first as `size path`", () => {
  const dir = repo({ "src/a.ts": 5, "src/b/c.ts": 50, "src/d.ts": 20 });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "50 src/b/c.ts\n20 src/d.ts\n5 src/a.ts\n");
});

test("prints only the 10 largest", () => {
  const files = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`src/f${i}.ts`, i + 1]));
  const lines = run(repo(files)).stdout.trim().split("\n");
  assert.equal(lines.length, 10);
  assert.equal(lines[0], "12 src/f11.ts");
  assert.equal(lines[9], "3 src/f2.ts");
});

test("skips untracked and ignored files, and files outside src/", () => {
  const dir = repo({ "src/a.ts": 1, "other.ts": 99 }, { ignore: "src/ignored.ts\n" });
  writeFileSync(join(dir, "src/ignored.ts"), "x".repeat(500));
  writeFileSync(join(dir, "src/untracked.ts"), "x".repeat(400));
  assert.equal(run(dir).stdout, "1 src/a.ts\n");
});

test("exits non-zero when src/ is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "largest-files-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src\//);
});
