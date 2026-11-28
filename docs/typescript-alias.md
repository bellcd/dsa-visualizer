# Why `typescript` is TypeScript 6

`package.json` installs two TypeScripts under swapped names:

```json
"@typescript/native": "npm:typescript@7.0.2",
"typescript": "npm:@typescript/typescript6@6.0.2"
```

- `tsc` is TypeScript 7. Only `@typescript/native` declares a `tsc` command, so `npm run typecheck` and the pre-commit hook run the Go compiler.
- `import "typescript"` gets TypeScript 6. `@typescript/typescript6` is Microsoft's compatibility package for tools that still use the JavaScript API, which TypeScript 7 dropped. It adds only a `tsc6` command.

Stryker is the reason. Outside in-place mode, it copies the project into `.stryker-tmp/` and rewrites `tsconfig.json` paths with `ts.parseConfigFileTextToJson`, which TypeScript 7 doesn't have. In-place mode avoids that call but mutates the real source files, and a killed run leaves them mutated, where an agent can commit them. With TypeScript 6 under the `typescript` name, Stryker runs in its sandbox and the working tree is never touched.

Don't set `typescript` back to 7 or turn on `inPlace` until Stryker supports TypeScript 7.

## When to undo it

Watch [stryker-js#6111](https://github.com/stryker-mutator/stryker-js/issues/6111) (stop using TypeScript's API for tsconfig parsing) and its fix, [stryker-js#6231](https://github.com/stryker-mutator/stryker-js/pull/6231). Once a Stryker release includes the fix:

1. Upgrade `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`.
2. Set `"typescript": "7.x.y"` and delete `@typescript/native`.
3. Run `npm run typecheck` and a full Stryker run, then delete this doc and its line in `CLAUDE.md`.
