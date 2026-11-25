import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = new URL("./check-exact-deps", import.meta.url).pathname;

function check(pkg) {
  const dir = mkdtempSync(join(tmpdir(), "exact-deps-"));
  const file = join(dir, "package.json");
  writeFileSync(file, JSON.stringify(pkg));
  return spawnSync("node", [script, file], { encoding: "utf8" });
}

test("passes when every version is exact", () => {
  const result = check({
    dependencies: { a: "1.2.3" },
    devDependencies: { b: "10.0.21" },
  });
  assert.equal(result.status, 0);
});

test("passes with no dependencies", () => {
  assert.equal(check({}).status, 0);
});

for (const version of ["^1.2.3", "~1.2.3", ">=1.2.3", "1.2", "1.x", "latest", "*", "1.2.3-beta.1"]) {
  test(`fails on ${version}`, () => {
    const result = check({ devDependencies: { a: "1.2.3", b: version } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`b@${version.replace(/[.*^~]/g, "\\$&")}`));
  });
}

test("checks every dependency section", () => {
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    assert.equal(check({ [section]: { a: "^1.0.0" } }).status, 1, section);
  }
});
