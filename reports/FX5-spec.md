# FX5 spec report

Worker cloud-7e015b. Branch claude/FX5 (origin/main). One new file: src/modules/lifecycle/lifecycle-caller-tx.acceptance.db.test.ts (8 tests, PGlite).

- 6 fail on the current build: commit with the caller, rollback leaves no state or event, the move sees the caller's uncommitted return, two moves kept or lost together, a refused table move and a refused guard inside the caller transaction. They fail by the 6 s timeout: today the fifth argument is ignored and the move opens a second PGlite transaction while the caller's holds the connection, so it waits forever. That is the defect the card names.
- 2 pass today by design (blank actor or reason refused before any write; no transaction behaves as before). They guard the builder against regressions.
- F02's own tests are untouched.
- Validated on origin/main: typecheck and lint green. Full npm test not re-run for a one-file addition; 6b stub sweep not run (the tests only add a fifth argument).

## Amber
- Surface: move(returnId, to, actor, why, tx?) with the caller's PGlite Transaction as the optional fifth argument (the card says "optional parameter on the move"). With a transaction the move does not commit or roll back; a refusal returns { ok: false, reason }, never throws, and leaves the caller's transaction usable. The builder must read the state through the transaction too, not through db.

## Permission gaps
None.

## Model
Sonnet 5.5
