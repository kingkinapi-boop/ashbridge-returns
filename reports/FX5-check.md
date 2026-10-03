# FX5 check

PASS. Worker cloud-dfeb44, branch claude/FX5 at 90e1c9ae (main 164d8d66 merged in).

- typecheck, lint, deps:check: clean.
- Unit: 2729 of 2730 pass. The one failure (SC R18: `src/modules/auth/testusers/engine.ts` and `src/modules/jobs/runner.ts` lack `// @mutate`) fails identically on origin/main and touches no FX5 file: not this card's. Owner to be found by the Lead.
- db: 621 of 621 pass (PGlite). test:flake 5 of 5 ok (3 + 2 runs, slowest boot 2601 ms). No pg16 harness has landed (DB16), so no `select version()` to print.
- Spec files unchanged since bd0e2fe2. `node tools/scope.mjs FX5`: 5 files, all in paths.
- Mutation: canary kills 10 of 10 (tool sound); `mutate:changed` has no `@mutate` file on this card (index.ts is outside Stryker).
- Adversarial read (Opus): PASS. Refusal writes nothing, DB errors rethrow, no-tx path unchanged.
- known.json: FX5's three entries (order by identity seq, two plain z.object contracts) are not fixed by this card's spec and stay valid.

## Carry to T08 (not an FX5 defect)
The guard call (`index.ts` line 74) gets no caller transaction (`GuardContext` has no tx). A guard reading through `db` while the caller's PGlite transaction is open hangs; on Postgres it would miss the caller's uncommitted writes. Add an optional `tx` to `GuardContext` before the first guard that reads the database.

## Permission gaps
None.

## Model
Sonnet 5.5, with one Opus subagent for the adversarial read.
