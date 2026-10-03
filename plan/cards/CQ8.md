# CQ8 next.mjs names path holds; the Lead can reopen a check

Phase 0. Size S. Deps: CQ5. Where: local or cloud.
Tags: none (queue tooling).
Paths: tools/next.mjs, tools/claim.mjs, tools/test/next-paths.test.mjs
Clauses: ARC-15
Read: `tools/next.mjs`, `tools/claim.mjs` (next: busyFor, NEEDS_LEAD), `plan/cards/CQ3.md`.
Spec commit: 01c1194 on claude/CQ8, validated on main 0e39bb0 (CQ5 build branch merged in).

## Goal
On 3 Oct 07:30Z next.mjs printed START for A04, FX10 and W00c while claim.mjs offered nothing: reported builds (FX2, W16) held overlapping Paths. The SC check sat as "needs Lead" with no Lead command to reopen a check (A439).

## Spec
- next.mjs and claim.mjs agree: a build whose Paths overlap a reported or working build of another card is listed as "waiting on paths: <card>", never START. Planted: two cards sharing `src/core/env.ts`, one with a reported build.
- `claim.mjs update <card> check reopened --worker lead` clears needs Lead and offers the check again; other workers cannot reopen.
- A worker whose name starts `local-` is never offered a job of a card whose Where line says only `cloud`; next.mjs prints such jobs as "cloud only". Planted: FX10 (Where: cloud) offered to local-1 at 08:05Z on 3 Oct, released twice and handed straight back (A440).

## Build
Both changes; nothing else.

## Check
A checker who did neither: the new tests and every tools test pass; scope clean.
