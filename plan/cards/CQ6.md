# CQ6 Mutation gate: core from slices.json and a Lead-kept harness list

Phase 0. Size S. Deps: CQ4. Where: local or cloud.
Tags: none (queue tooling).
Paths: tools/mutate-changed.mjs, tools/test-homes.json, tools/test/mutate-harness.test.mjs
Clauses: ARC-15
Read: `reports/DB16-findings.md` on claude/DB16 (item 4), `.claude/rules/testing.md`, `tools/mutate-changed.mjs`.
Spec commit: f5a17f0 (validated on main a4c7991)

## Goal
The mutation gate demands `@mutate` on every file a core card touches, including test harness code Stryker can never reach (DB16's global-setup.ts and index.ts; FX7's test-no-network.ts). It also misses cards tagged "security, core" (B04) and gates no family card (A430).

## Spec
- core comes from `plan/slices.json` `core` or `core` anywhere in the Tags line; planted: a card tagged `security, core`.
- A Lead-kept `harness` list in `tools/test-homes.json` (src/core/db/index.ts, src/core/db/global-setup.ts, vitest-setup.ts, src/core/test-no-network.ts, src/core/testing/read-own-source.ts) is skipped by the core-marker rule and printed "harness, not mutated".
- The tool fails when a non-test module outside the list imports a listed file; planted: a product module importing global-setup.ts.

## Build
The three rules in mutate-changed.mjs and the list; nothing else. Data, not a marker a builder can type.

## Check
A checker who did neither: the new tests and every tools test pass; `mutate:changed -- DB16` prints the two harness lines; scope clean.
