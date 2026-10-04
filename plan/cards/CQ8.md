# CQ8 next.mjs names path holds; the Lead can reopen a check

**Lead directive, 3 Oct 13:51Z (A482): round 2 from reports/CQ8-findings-1.md (on claude/CQ8). Spec patch first, then build round 2, then a check by a worker who wrote neither.** Rule 3 stays on CQ8 and gets its tests here (A473's test half reversed). In `tools/test/next-paths.test.mjs`, "ARC-15 CQ8 rule 3" (about 8 tests): local-1 gets NOTHING for the spec, build and check of a card whose Where line is "cloud." and of a card whose Where line is "cloud (Postgres 16)."; a cloud-* worker gets each; a card whose Where line is "local or cloud." and a card with no Where line go to local-1; a cloud-only card is skipped and the next one taken; next.mjs tags only the cloud card "cloud only". Do not pin mixed wordings (CQ11 rules them). The refusals fail on main. Build round 2: merge the spec and run; change claim.mjs or next.mjs only if a new test fails (none expected).

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
