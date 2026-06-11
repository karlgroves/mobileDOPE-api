# 5. Keep CommonJS module settings

## Status

Accepted

## Context

Issue #2 provides a `tsconfig.json` template tuned for an ESM/Vite frontend:
`"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"verbatimModuleSyntax"`,
`"isolatedModules"`, and DOM libs.

This API compiles with `tsc` to CommonJS (`"module": "commonjs"`,
`"moduleResolution": "node"`), runs on Node via `ts-node`/compiled `dist`, and uses
`tsconfig-paths` for path aliases. Adopting the bundler/ESM settings would break the
build and the runtime.

## Decision

Keep the existing CommonJS-oriented compiler options. From #2's "Foundations"
section, adopt only the parts that fit a CommonJS backend:

- Added `noImplicitOverride` (findings fixed).
- Kept existing strictness already present: `strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`.
- Added `@total-typescript/ts-reset` via `src/reset.d.ts`.
- Deferred `exactOptionalPropertyTypes` (see ADR-0004).
- Did **not** change `module`, `moduleResolution`, or add `verbatimModuleSyntax` /
  `isolatedModules` / DOM libs.

## Consequences

- The build and runtime behaviour are unchanged.
- ESLint config is `eslint.config.mjs` (`.mjs` so flat config loads as ESM inside a
  CommonJS package).
