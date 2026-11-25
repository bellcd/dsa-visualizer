#!/usr/bin/env bash
# Print each tracked file under src/ that contains TODO, with its count of
# matching lines, as "path: count", sorted by path. Exits non-zero if src/ is missing.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ ! -d src ]]; then
  echo "count-todos: src/ not found" >&2
  exit 1
fi

git ls-files -z -- src | while IFS= read -r -d '' file; do
  [[ -f $file ]] || continue
  count=$(grep -c -a -- 'TODO' "$file" || true)
  if [[ $count -gt 0 ]]; then
    printf '%s: %s\n' "$file" "$count"
  fi
done | LC_ALL=C sort
