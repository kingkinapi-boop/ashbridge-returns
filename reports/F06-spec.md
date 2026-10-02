# F06 spec report (cloud-b4ebfa, 2 Oct 2026)

Tests: 26 db tests (`src/modules/jobs/jobs.acceptance.db.test.ts`) and 5 unit tests (`src/contracts/jobs.acceptance.test.ts`). Clauses: ARC-5, ARC-10, ARC-16, SEC-6. Card checks 1 to 12 all covered.
Validated on main 8e8fba1 with F01 (claude/F01 at 559610587) merged in a scratch tree: typecheck, lint, unit 986 and db 194 green with a throwaway stub of the card (never committed). Without the build the tests fail because `./index` and `contracts/jobs` do not exist (right reason). F01 must be merged before F06 builds (the card already says dep F01).
Step 6b sweep: no existing test retired; the stub broke none.

## Amber (choices the card left open; reverse by editing the spec)
- Module API names: `createJobQueue(db, clock)`, `createRunner` and `createSyncRunner({queue, handlers, clock, workerId?})`, handlers a map kind to Handler; `runOnce(): Promise<boolean>`, `runUntilIdle(): Promise<number>`.
- `Handler` carries `versions` (the ARC-10 stamp); the runner passes it to `complete`. A handler with a blank stamp cannot finish a job.
- `claim(workerId, kinds?, leaseMsFor?)`: the lease length reaches the queue through a lookup function the runner passes from its handlers.
- `fail(id, error, { retry? })`: retry false ends `failed` (used for an unknown kind); default requeues with backoff 1, 4, 16 minutes (16 after that) or `dead` at max attempts.
- Lease expiry keeps attempts; the re-claim counts one more. created_at, finished_at, lease and run_after come from the injected clock.
- `statusForReturn` shape: `counts[kind]` has all five statuses; `dead[]` of {id, kind, last_error}; `oldestOpen[kind]` absent when none is open.
- Table: DELETE and TRUNCATE refused via F01's `refuse_change` ("append-only"); the done-needs-a-stamp constraint has "stamp" in its name; kind must look like `<module>:<step>`.

## Permission gaps
None.
## Model
Sonnet 5.5 (card is not core).
