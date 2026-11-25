import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = new URL("./node-version.sh", import.meta.url).pathname;

// Copies the script into a scratch repo so .nvmrc can be present or absent.
function scratchRepo(nvmrc) {
  const root = mkdtempSync(join(tmpdir(), "node-version-"));
  mkdirSync(join(root, "scripts"));
  const copy = join(root, "scripts", "node-version.sh");
  copyFileSync(script, copy);
  chmodSync(copy, 0o755);
  if (nvmrc !== undefined) writeFileSync(join(root, ".nvmrc"), nvmrc);
  return copy;
}

test("prints the version from .nvmrc", () => {
  const result = spawnSync(scratchRepo("24\n"), { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "24\n");
});

test("exits non-zero when .nvmrc is missing", () => {
  const result = spawnSync(scratchRepo(undefined), { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
});

test("prints this repo's version", () => {
  const result = spawnSync(script, { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^\d/);
});
