# 1. Keep Jest instead of switching to Vitest

## Status

Accepted

## Context

Issue #2 proposes Vitest as the unit/integration test runner. This repository
already uses Jest with `ts-jest`, a working `jest.config.js`, path-alias mapping,
and an existing test suite under `tests/`.

The issue's own ground rules state: "Do not replace anything that already exists
in this project unless the new proposal leads to a demonstrably higher quality
outcome."

## Decision

Keep Jest. The existing setup is functional, the test suite passes, and there is
no demonstrable quality, performance, or maintenance win from migrating a small
backend test suite to Vitest. The Vitest-specific items in issue #2 (the
`vitest/globals` types, `v8` coverage provider wiring) are therefore not adopted.

## Consequences

- `npm test` / `npm run test:coverage` continue to run Jest.
- If the project later adds an ESM/Vite-based surface, revisit this decision.
