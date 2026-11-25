#!/usr/bin/env bash
# NOTE: counts every line, blank and comment-only included; VS-14 leaves that open.
set -euo pipefail

if [[ ! -d src ]]; then
  echo "line-counts.sh: src/ does not exist" >&2
  exit 1
fi

git ls-files -z -- src | while IFS= read -r -d '' file; do
  count=$(wc -l < "$file")
  echo "${count//[[:space:]]/} $file"
done
