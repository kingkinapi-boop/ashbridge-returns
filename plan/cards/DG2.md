# DG2 Mutation gate covers testworld and every core card

Phase 0. Size S. Deps: DG. Where: cloud.
Tags: none (build tooling).
Paths: tools/mutate-changed.mjs, vitest.mutate.config.ts, stryker.config.mjs, tools/test/done-gate.test.mjs, tools/test/__fixtures__/done-gate/**
Clauses: ARC-15
Read: `reports/findings-W00-r1.md` (RC2, T1, T1b, risks), `plan/cards/DG.md`, `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Goal
A core card's code is mutation-tested wherever it lives. Today `mutate-changed.mjs:35` keeps only `src/**/*.ts` and passes a core card with "no mutation targets changed", so W00's `testworld/` code (and W01 to W13 later) is never scored.

## Spec
1. A core-card fixture whose Paths are only under `testworld/` with no `// @mutate` marker fails the gate, naming the files (planted: the W00 tree as it is now).
2. On a core card, zero marked targets inside the card's Paths is a failure, not "no mutation targets".
3. Marked `testworld/**/*.ts` files (never test files, fixtures or goldens) are Stryker targets, and `vitest.mutate.config.ts` runs the testworld tests.
4. `npm run mutate:canary` still scores 100; one `src/` core card (F05M) scores as before.

## Build
Widen the target pattern to `src/**/*.ts` and `testworld/**/*.ts` minus tests, fixtures and goldens; the zero-target rule for core cards; the testworld test globs in the mutate config.

## Check
A checker who did neither: `tools/test/done-gate.test.mjs`, `mutate:canary` 100, F05M's score unchanged, `npm test`, `test:flake` 5 of 5.
