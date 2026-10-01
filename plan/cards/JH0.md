# JH0 Journey harness: load a kind, run the pipeline

Phase 0. Size M. Deps: W00, F01. Where: cloud (journeys); the unit-level parts run anywhere.
Tags: security (SEC-11: the harness loads only test-world data and refuses a live database).
Paths: e2e/_harness/**, package.json
Clauses: END-9, ARC-4, ARC-16, ARC-21, SEC-11
Read: blueprint 00 (END-9), 09 (ARC-4, ARC-8, ARC-16, ARC-21), `.claude/rules/testing.md`, `plan/cards/W00.md`, `plan/cards/F01.md`, `plan/cards/SK0.md` (its first user).
Spec commit: (spec-writer fills)

## Goal
One harness every journey uses: load a test-world client or kind into a fresh database, run the pipeline steps that exist, and compare what came out with the known right answers, so END-9 ("all thirteen kinds pass on every merge") is one command and grows by itself as cards land.

## Build
- `e2e/_harness/load.ts`: `loadIntoDb(db, clientOrKindId)` writes the client's records from W00's model into schema `returns` (every row `is_test = true`) on PGlite in unit runs and Postgres 16 in cloud journeys (ARC-4). It refuses to run when the database URL is not a local or test-cloud one, or when any row would have `is_test = false`.
- `e2e/_harness/pipeline.ts`: a step register (intake, read, books, figures, import file, simulator round trip, trace, checks). Each card that builds a step registers it here; a step not yet built returns "not built" and the journey reports it as such, never as a pass.
- `e2e/_harness/expect.ts`: compares the pipeline's results with the kind's expected answers (figures in cents, flags, exceptions) and prints a short difference list on failure.
- `e2e/_harness/fixtures.ts`: the shared Playwright fixtures: the clock pinned (`America/Toronto`, `en-CA`), a fixed seed, a fresh database per test, the app started from the production build (ARC-21), and the one shared axe check every journey calls (RV-54 is tested through it by the screen cards).
- `e2e/_harness/kinds.spec.ts`: one journey per sample client (C01 to C10, always present) and per built kind from W00's register (a built one that fails is a failure). Kinds not built yet are not silently skipped: the run prints them as "not built", and with `--require-all` (the END-9 gate, used at phase gates and from go-live on) any not-built kind fails the run. Without the flag the train stays green while kinds are still being written.
- `package.json`: the `dev:testworld` script now loads a chosen sample client into a local PGlite database and starts the app on it (replacing F00's placeholder); only that script line changes.

## Acceptance checks
1. END-9: loading sample client C01 into a fresh PGlite database writes its accounts, transactions and adjusting entries, and every row has `is_test = true`.
2. SEC-11: the loader refuses a database URL that is not local or a test-cloud database, and refuses a record with `is_test = false`, each with the reason and nothing written.
3. END-9: a pipeline with no steps registered reports every step "not built" and the journey fails with that list; registering a stub step that returns the expected figure for C01 makes that step pass.
4. `expect.ts`: a figure one cent off fails with the figure key, the expected and the actual cents; a missing expected flag fails with its id.
5. ARC-16: two runs on the same client with the same seed and clock give identical results; the fixture's clock reads the pinned time.
6. ARC-21: the Playwright fixture starts `next start` on a production build and the smoke page loads through it with no axe violation.
7. ARC-4: the same load test passes on PGlite locally and on Postgres 16 in the cloud run.
8. END-9: `kinds.spec.ts` runs the ten sample clients and every built kind, and prints the not-built kinds by name; with `--require-all` the run fails while any of K1 to K13 is not built; a run that finds zero built kinds fails (a pass with zero tests is a failure).

## Not in this card
Any pipeline step (each card registers its own). The kinds (W01 to W13). The walking skeleton (SK0). Screens.
