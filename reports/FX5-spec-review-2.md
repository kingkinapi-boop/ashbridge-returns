# FX5 spec review, round 2 (Opus, cold, 3 Oct)

Spec: claude/FX5 at bd0e2fe (card line b26392a): `lifecycle-caller-tx.acceptance.db.test.ts` (34, PGlite) and the new unit twin `lifecycle-caller-tx.acceptance.test.ts` (27). Read against reports/FX5-spec-review.md (7 gaps), reports/FX5-spec.md (round 2), plan/cards/FX5.md and `.claude/rules/testing.md`.

## Verdict: GO, after one card line the Lead fixes (below). Every test gap is closed.

## Gap by gap
1. Fail fast: closed. A Proxy over the PGlite clone (third-party, not our module) rejects `query`, `exec`, `sql`, `transaction` with `FX5: the move used db, not the caller transaction` while the caller's transaction runs, and every caller-tx test asserts the misuse record is empty; the unit twin asserts `move.length` 5. Fails first: unit 25 of 27, db 31 of 34, each in under a second by name; no timeouts. The 5 that pass now (blank actor, blank reason, the no-transaction path) are refused before any database use: regression guards, rightly so.
2. Kept or lost together: closed. Committed: state gaps and exactly intake->evidence, evidence->gaps. Rolled back after two moves: intake, 0 events.
3. Database error must throw: closed, and well. Triggers planted on the return update and on the event insert, after a caller rename: the move never returns (`returned` undefined), the caller never finishes, the planted text is in the error or its cause chain, the caller's transaction rejects, state, events and the rename are all gone; a follow-up after dropping the trigger writes exactly one event. Unit twin covers both points too.
4. Event content: closed. With and without a transaction, from, to, actor, reason and `occurred_at` equal the pinned clock.
5. Every move: closed. `test.each` over all 17 `MOVES`, committed and rolled back, content checked; includes review to approved (T08's move).
6. Every refusal kind: closed. Blank actor, blank reason, unknown return, table, guard not built, guard says no: `{ ok: false }` equal to the no-transaction reason (the guard's text exactly), no state change, no event, the caller's later write kept; an ok move after a refused one in the same transaction is kept with one event.
7. Clause names: closed. FLOW-1 and FLOW-4, as the card's clause line now says.

## For the Lead (amber; do before the build opens)
- Card FX5 Spec, third bullet, still says refusals "throw inside the caller transaction"; the tests (rightly) split: rule refusals return `{ ok: false, reason }` and leave the transaction usable, database errors throw. Rewrite that bullet to the split, or the checker will read the card against the tests and fail it. Add to T08's Build: "T08 throws on a refused move so its transaction rolls back".
- `move.length` 5 forbids a default value on the new parameter (`tx = undefined` gives 4): say "a plain optional parameter" in the card's Build line.
- The unit twin's fake reads F02's SQL loosely (select, insert into state_events, update returns); a build that rewrites F02's statements could trip it. FX5 changes no SQL, so low risk; widen the fake if it does.
- `index.ts` carries `Stryker disable all`: these 61 tests are the only guard; no mutation score to paste for FX5.
