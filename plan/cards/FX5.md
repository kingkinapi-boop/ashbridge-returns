# FX5 F02 move inside a caller transaction (for T08)

**Lead note, 3 Oct (A410): round 2 spec bd0e2fe2 reviewed GO (reports/FX5-spec-review-2.md). Build to it: rule refusals return `{ ok: false }`, database errors throw.**

Phase 3. Size S. Deps: F02, SC. Where: cloud.
Tags: core (a return's state moves; approval voids).
Paths: src/contracts/lifecycle.ts, src/modules/lifecycle/**
Clauses: FLOW-1, FLOW-4
Read: `reports/phase3-card-review-2026-10-03.md` (fix 2), `plan/cards/F02.md`, `plan/cards/T08.md`, `src/modules/lifecycle/index.ts` (the move and its own `db.transaction`).
Spec commit: bd0e2fe2

## Goal
T08 approves a return in one transaction: the state move, the facts it accepts (L00) and the version it saves (N00). F02's move opens its own transaction and takes no caller's, so T08 cannot be built. This card gives the move an optional caller transaction and changes nothing else. L00 and N00 do the same in their own builds (A397).

## Spec
- The move given a caller transaction runs inside it: a caller that rolls back leaves the return in its old state and writes no event row.
- The move given no transaction behaves exactly as today (F02's acceptance tests stay green, unchanged).
- Rule refusals (a move blueprint 02 does not allow) return `{ ok: false }` with the reason inside the caller transaction and write nothing; a database error throws, so the caller's transaction rolls back.

## Build
One optional parameter on the move; no other behaviour change. `index.ts` is outside Stryker (its paths are database-bound), so the bar is the 61 spec tests, every one failing before the build and passing after; no mutation score is claimed.

## Check
A checker who did neither: the three cases above on PGlite, F02's tests unchanged and green, scope clean.

## SC KNOWN entries (3 Oct, A407)
SC lands with exact KNOWN entries owned by this card (reports/SC-findings.md, fix list step 3). Each defect fixed here deletes its entry; never widen an entry or weaken a rule (A329).
