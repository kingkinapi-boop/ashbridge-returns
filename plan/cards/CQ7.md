# CQ7 claim.mjs: update and beat write on the tip they read

Phase 0. Size S. Deps: CQ5. Where: local or cloud.
Tags: none (queue tooling).
Paths: tools/claim.mjs, tools/test/claim-race-update.test.mjs
Clauses: ARC-15
Read: `reports/CQ5-spec.md` on claude/CQ5 (amber 2), `plan/cards/CQ5.md`, `tools/claim.mjs`.
Spec commit: f62e90f

## Goal
CQ5 fixes the claims race for `next` only. `update` and `beat` also read the claims and re-read them before writing, so a report or heartbeat can overwrite another worker's change made in between (A431).

## Spec
CQ5's race harness (a rival worker run from a preload script) applied to `update` and `beat`: a write decided on tip T while the remote moved to T' with a change to the same job is refused as RACE; a change to another job is kept. Plants as CQ5.

## Build
`update` and `beat` pass the tip they read to the write, as CQ5 does for `next`. Nothing else.

## Check
A checker who did neither: the new tests and every tools test pass; scope clean.
