# CQ3 Queue: no build while its spec is open, and "wait:" holds

Phase 0. Size S. Deps: CQ2. Where: local or cloud.
Tags: none (queue tooling).
Paths: tools/claim.mjs, tools/test/claim-wait.test.mjs, tools/test/claim.test.mjs
Clauses: ARC-15
Read: `plan/cards/CQ2.md`, `.claude/skills/dispatch/SKILL.md`, `tools/claim.mjs`.
Spec commit: 2f1a4298 (tools/test/claim-wait.test.mjs, 30 tests; retires 2 CQ1 wait-lift tests in tools/test/claim.test.mjs, rewrites 1), validated on main a50769da

## Goal
On 3 Oct the queue handed out DB16's build twice (a cloud worker, then local-3) while the Lead had reopened DB16's spec and released the build with a "wait:" note (A411, A416). Workers lose time and a build can land on old tests.

## Spec
- `next` never offers a card's build while that card's spec job is reopened or working, nor its check while its build is.
- A job released with a note starting "wait:" is not offered again until the Lead reopens it (`update <card> <role> reopened --worker lead`); any other release behaves as today.
- Both by class: every role pair (spec before build, build before check) and every "wait:" release, through a table of claim histories, never one example.

## Build
The two filters in `next`; nothing else.

## Check
A checker who did neither: the new tests and every existing tools test pass; scope clean.
