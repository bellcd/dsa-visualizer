#!/usr/bin/env bash
# Print the 10 largest tracked files under src/, largest first, as "size path".
# Size is in bytes. Run from the repository root.
set -euo pipefail

if [[ ! -d src ]]; then
  echo "largest-files: src/ not found" >&2
  exit 1
fi

while IFS= read -r -d '' file; do
  [[ -f $file ]] || continue
  printf '%s %s\n' "$(wc -c <"$file" | tr -d '[:space:]')" "$file"
done < <(git ls-files -z -- src) | sort -k1,1nr -k2 | head -n 10
