# FX5 F02 move inside a caller transaction (for T08)

Phase 3. Size S. Deps: F02. Where: cloud.
Tags: core (a return's state moves; approval voids).
Paths: src/contracts/lifecycle.ts, src/modules/lifecycle/**
Clauses: FLOW-4, EV-1, LL-1
Read: `reports/phase3-card-review-2026-10-03.md` (fix 2), `plan/cards/F02.md`, `plan/cards/T08.md`, `src/modules/lifecycle/index.ts` (the move and its own `db.transaction`).
Spec commit: ad79731d

## Goal
T08 approves a return in one transaction: the state move, the facts it accepts (L00) and the version it saves (N00). F02's move opens its own transaction and takes no caller's, so T08 cannot be built. This card gives the move an optional caller transaction and changes nothing else. L00 and N00 do the same in their own builds (A397).

## Spec
- The move given a caller transaction runs inside it: a caller that rolls back leaves the return in its old state and writes no event row.
- The move given no transaction behaves exactly as today (F02's acceptance tests stay green, unchanged).
- Refusals (a move blueprint 02 does not allow) throw inside the caller transaction without committing anything.

## Build
One optional parameter on the move; no other behaviour change. Mutation 100 on the changed `@mutate` file.

## Check
A checker who did neither: the three cases above on PGlite, F02's tests unchanged and green, scope clean.
