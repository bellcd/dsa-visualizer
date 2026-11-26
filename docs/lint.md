# Lint rule sets

- `npm run lint:strict` runs `biome.json`. CI (through `npm run check`) and the pre-commit hook enforce it. Biome auto-discovers this file, so the editor uses it too.
- `npm run lint:all` runs `lint-all/biome.json`, which extends `biome.json` and adds rules that do not pass yet. It exits non-zero while any fail. Nothing in CI or the hook runs it, so it never blocks a commit or a merge.

## Promote a rule

When a rule in `lint-all/biome.json` has no failures left, move it: add it to `linter.rules` in `biome.json` and delete it from `lint-all/biome.json`. `lint:strict` now enforces it, and `lint:all` inherits it by extending `biome.json`.

## Why `lint-all/` is excluded in `biome.json`

Biome rejects a nested root configuration, and `--config-path` only takes a directory inside the project. So the all-config lives in its own directory, which `biome.json` leaves out of `files.includes`.
