# Why `typescript` is TypeScript 6

```json
"@typescript/native": "npm:typescript@7.0.2",
"typescript": "npm:@typescript/typescript6@6.0.2"
```

`tsc` is TypeScript 7, and `import "typescript"` gets TypeScript 6. Stryker's sandbox calls `ts.parseConfigFileTextToJson`, which TypeScript 7 dropped. The alternative, `inPlace`, leaves mutated source in the working tree when a run is killed.

Undo it once a Stryker release fixes [stryker-js#6111](https://github.com/stryker-mutator/stryker-js/issues/6111) (fix in [#6231](https://github.com/stryker-mutator/stryker-js/pull/6231)): set `typescript` back to 7, delete `@typescript/native`, this doc and its line in `CLAUDE.md`.
