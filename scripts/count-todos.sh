#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ ! -d src ]]; then
  echo "count-todos: src/ not found" >&2
  exit 1
fi

git ls-files -z -- src | while IFS= read -r -d '' file; do
  [[ -f $file ]] || continue
  # NOTE: -a counts TODOs in files grep would otherwise treat as binary.
  count=$(grep -c -a -- 'TODO' "$file" || true)
  if [[ $count -gt 0 ]]; then
    printf '%s: %s\n' "$file" "$count"
  fi
done
