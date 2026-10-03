# FX5 spec report (round 2, A402)

Worker local-2 (laptop). Model: Opus 5.5 (local worker). Branch claude/FX5, origin/main 58b0bec6 merged in. Round 1 (cloud-7e015b, ad79731d) had 8 tests that failed by a 6 s timeout; reports/FX5-spec-review.md found 7 gaps. This round closes all 7.

## Files
- `src/modules/lifecycle/lifecycle-caller-tx.acceptance.db.test.ts` (rewritten, 34 tests, PGlite).
- `src/modules/lifecycle/lifecycle-caller-tx.acceptance.test.ts` (new, 27 tests, unit twin with a fake db and a fake caller transaction; testing rule 4b for core cards).

## Gaps closed
1. Fail fast: the lifecycle gets a guarded db (a Proxy over the PGlite clone); while the test is inside its own transaction, any `query`, `exec`, `sql` or `transaction` on it rejects with `FX5: the move used db, not the caller transaction` and is recorded; every caller-tx test asserts the record is empty. Unit twin: `move.length` is 5.
2. Kept: state `gaps`, exactly the 2 events intake->evidence, evidence->gaps. Lost: two moves then rollback: `intake`, 0 events.
3. Database error: a planted trigger on the return update, and one on the state event insert, inside a caller transaction that renamed the return first: the move throws (the planted message in the error or its cause chain), never returns a result; the caller's transaction rejects; state, events and the caller's rename are all gone. A follow-up test drops the trigger and moves again: exactly one event (nothing pending).
4. Event content: the row written with a caller transaction equals the row written without one: from, to, actor, reason, `occurred_at` = the pinned clock.
5. Every move in `MOVES` (17), committed and rolled back, each with the event content checked.
6. Every refusal kind inside the caller transaction (blank actor, blank reason, unknown return, table refusal, guard not built, guard says no): `{ ok: false }` equal to the reason the same move gives without a transaction (the guard's own text exactly), no state change, no event, the caller's later write kept; plus an ok move after a refused one in the same transaction.
7. Clause names: FLOW-1 and FLOW-4 only (the card's clause line); LL-1, EV-1 and FLOW-2 dropped from names.

## Fail first (on the current build)
- Unit: 25 of 27 fail in milliseconds: `expected 4 to be 5` (the fifth parameter) and `FX5: the move used db, not the caller transaction`. 2 pass by design (blank actor, blank reason: refused before any database use).
- Db: 31 of 34 fail, each in under 1 s (the clone), every one by the FX5 misuse message or `expected [ 'query' ] to deeply equal []`. 3 pass by design (blank actor, blank reason, the no-transaction path).
- No timeouts.

## Validation (validated on main 58b0bec6)
- `tsc --noEmit` and `npm run lint`: clean except the known laptop gap (exceljs, pdfjs-dist missing from the main checkout's node_modules: src/modules/ocr and src/modules/sheets only).
- tools/test rule tests (197) green.
- Full `npm test` not run on the laptop (the same gap fails ocr and sheets tests); nothing outside src/modules/lifecycle imports the lifecycle module.

## 6b sweep
A throwaway stub in index.ts (an optional `tx`; reads through `tx ?? db`; with tx: lock, event, update through it, no catch), never committed, reverted with `git checkout`: lifecycle unit 63 of 63 and db 111 of 111 green (F02's own tests included). Tests retired: none.

## Amber
- Refusal split (the review's recommendation; the card says refusals "throw"): rule refusals (blank who or why, unknown return, table, guard not built, guard says no) return `{ ok: false, reason }` and leave the caller's transaction usable; database errors throw so the caller's transaction rolls back. T08's Build should say "T08 throws on a refused move so its transaction rolls back" (Lead: put that line on T08). Reverse: change the 6 refusal cases to expect a rejection.
- Unit twin fake reads SQL loosely (any select on returns.returns is the state read; an insert into returns.state_events is the event; an update of returns.returns is the move). A builder who reads the state through another table or view would trip it; reverse: widen the fake's patterns.
- `index.ts` carries `Stryker disable all`, so the card's "mutation 100" is vacuous for FX5; these tests are the guard.

## Permission gaps
None.
