#!/usr/bin/env bash
set -euo pipefail

nvmrc="$(dirname "${BASH_SOURCE[0]}")/../.nvmrc"

if [[ ! -f "$nvmrc" ]]; then
  echo "node-version.sh: .nvmrc not found" >&2
  exit 1
fi

cat "$nvmrc"
