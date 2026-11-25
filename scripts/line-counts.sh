#!/usr/bin/env bash
# Print every tracked file under src/ as "count path", one per line.
# Counts every line, blank and comment-only lines included.
set -euo pipefail

if [[ ! -d src ]]; then
  echo "line-counts.sh: src/ does not exist" >&2
  exit 1
fi

git ls-files -z -- src | while IFS= read -r -d '' file; do
  count=$(wc -l < "$file")
  echo "${count//[[:space:]]/} $file"
done
