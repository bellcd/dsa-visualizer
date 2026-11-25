#!/usr/bin/env bash
# Usage: scripts/list-scripts.sh [path/to/package.json]
set -euo pipefail

file="${1:-package.json}"

if [[ ! -f "$file" ]]; then
  echo "list-scripts: $file not found" >&2
  exit 1
fi

node -e '
const { readFileSync } = require("node:fs");
const scripts = JSON.parse(readFileSync(process.argv[1], "utf8")).scripts ?? {};
const names = Object.keys(scripts).sort();
if (names.length === 0) {
  console.error("list-scripts: no scripts in " + process.argv[1]);
  process.exit(1);
}
for (const name of names) console.log(name + ": " + scripts[name]);
' "$file"
