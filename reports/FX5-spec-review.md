# FX5 spec review (Opus, cold, 3 Oct)

Spec: `src/modules/lifecycle/lifecycle-caller-tx.acceptance.db.test.ts` on claude/FX5 (ad79731, 8 tests). Read against plan/cards/FX5.md, F02's move (`src/modules/lifecycle/index.ts`), FLOW-1, FLOW-2, FLOW-4, EV-1, LL-1 and `.claude/rules/testing.md`.

## Verdict: GAPS (7). Build stays held until a spec round closes them.

The surface (optional fifth argument, the caller's PGlite `Transaction`, reads and writes through it) is right, and tests 2 and 3 (rollback after an ok move; the move sees the caller's uncommitted return) are the core of the card. The gaps below are about failure quality, class coverage and the one case that can lose data silently.

## On the timeout question
A timeout is the right defect but an unsound failure. Today the assertions never run: six tests hang 6 s each on PGlite's transaction mutex, so "fails first for the right reason" cannot tell a correct test from a broken one (a test whose assertions are wrong also "fails by timeout"). It is also slow (36 s) and the message names nothing. Fail fast by assertion instead (gap 1).

## Gaps (each with the test to add)
1. **Fail fast, by assertion.** Give `createLifecycle` a guarded `db`: a test-side wrapper around the PGlite instance (third-party, not our module) with a flag the test sets around its own `db.transaction(...)`; any `query`, `exec` or `transaction` on the guarded db while the flag is set throws `FX5: the move used db, not the caller transaction`. Plus `expect(lc.move.length).toBe(5)` (an optional TS parameter compiles to a plain one). Today every caller-tx test then fails in milliseconds naming the defect; record the new fail-first reasons in reports/FX5-spec.md.
2. **"Kept or lost together" is weak.** The kept half asserts `eventRows >= 1`: assert state `gaps` and exactly 2 events. The lost half makes only one move: make two (intake to evidence to gaps) and roll back: state `intake`, 0 events.
3. **A database error inside the caller transaction (the silent-loss case).** Plant F02's trigger (`raise exception` on the update to the target state) and move inside a caller transaction that wrote something first. Required: the move rejects (throws), the caller's transaction rolls back, nothing is kept, the caller's own write included. It must never return `{ ok: false }`: Postgres has aborted the transaction, and a caller that then returns normally gets `COMMIT` turned into a silent `ROLLBACK`, so T08 would believe its approval was saved. Second test: no partial event row survives.
4. **Event content inside the transaction.** Today only counts. Assert the row written with a caller transaction equals the row written without one (from, to, actor, reason, `occurred_at` = the pinned clock), id aside (FLOW-1).
5. **Every move, by class.** Loop over `MOVES`: insert a return in `from`, move to `to` inside a caller transaction; committed gives `to` and one event, rolled back gives `from` and none. Covers `review` to `approved`, the move T08 makes; today only intake to evidence and evidence to gaps.
6. **Every refusal kind inside the transaction, and the transaction still usable after each.** Add: an unknown return id; a guard not built (missing from `guards`); after the guard refusal (test 6), a caller write that is kept. Each: `{ ok: false, reason }` with the reason text, no event.
7. **Clause names.** The behaviour is FLOW-1 (one event per move, who, when, why) and FLOW-2; LL-1 (what is saved for every return) and EV-1 (append-only records) do not describe it, and FLOW-4 only motivates it. Rename the tests to FLOW-1 and FLOW-2 (keep FLOW-4 on the commit-together cases) once the card's clause line is fixed.

## For the Lead (amber)
- The card says "Refusals ... throw inside the caller transaction"; the spec chose "a refusal returns `{ ok: false }` and never throws" (consistent with F02). Recommended split: rule refusals (table, guard, blank who or why, unknown return) return `{ ok: false }`; database errors throw (gap 3). Put that line in the card and in T08's Build ("T08 throws on a refused move so its transaction rolls back").
- Card clauses: FLOW-1, FLOW-2, FLOW-4 instead of FLOW-4, EV-1, LL-1 (gap 7); the matrix otherwise counts LL-1 and EV-1 as covered by FX5.
- `index.ts` carries `Stryker disable all` (db glue), so "mutation 100" is vacuous for FX5: these db acceptance tests are the only guard, which is why gaps 3, 5 and 6 matter.

## Not gaps
Clock pinned; no randomness; F02's own tests untouched; one PGlite clone per test, so a hang does not leak across tests.
