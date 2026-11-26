# Mechanical standards

A husky pre-commit hook runs on the staged files, in parallel:
`biome check --staged`, `tsc --noEmit`, `scripts/check-comments.js` and `vitest related --run`.
CI runs the same Biome plugin and comment check on every file (`npm run check`), because the hook can be skipped.

- `as` type assertions are banned by `biome-plugins/no-type-assertion.grit`; `as const` is allowed.
- Every comment in a `.ts` file starts with `NOTE:`.
- `scripts/*.js` are not comment-checked, since the check covers `.ts` files only.
