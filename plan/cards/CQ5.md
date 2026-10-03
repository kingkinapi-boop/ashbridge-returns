# CQ5 claim.mjs: a claim is written on the tip it was decided on

Phase 0. Size S. Deps: CQ3. Where: local or cloud.
Tags: none (queue tooling).
Paths: tools/claim.mjs, tools/test/claim-race.test.mjs
Clauses: ARC-15
Read: `reports/CQ3-check.md` on claude/CQ3 (the race note), `plan/cards/CQ3.md`, `tools/claim.mjs`.
Spec commit: 756760ac (validated on main 50fcaf43)

## Goal
On 3 Oct 05:56Z local-3's W16 spec claim (0ec70d0a) overwrote cloud-03268d's claim made 7 seconds earlier (3ba6da28) with no RACE warning: `next` picks from one claims tip, but `writeClaims` re-reads `refs/remotes/origin/claude/claims`, which another local worker's fetch can move in between (worktrees share refs). Two workers can then hold one job (A428).

## Spec
- A claim decided on tip T and written when the remote tip is T' (T' moved after the decision, with a claim on the same job) is refused as RACE and the worker picks again; nothing is overwritten.
- A claim on a different job made between T and T' is kept, and the new claim lands on top of it.
- Planted: two simulated workers sharing one refs directory, as in the 05:56Z case.

## Build
`writeClaims` takes the tip the decision was made on and pushes with that parent only, or re-checks the claim file on the new tip before writing. Nothing else.

## Check
A checker who did neither: the new tests and every tools test pass; scope clean.
