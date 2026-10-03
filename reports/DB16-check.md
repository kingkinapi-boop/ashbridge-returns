# DB16 check (round 4 build, cloud-54d8a4, 3 Oct 2026)

**FAIL**: Opus read finds four medium findings (roles and settings across pooled connections). Everything else passes.

Passed: typecheck, lint, deps:check; `npm test` 2623 passed; `TEST_DB=pg16 --project db` 565 passed, 1 skipped (see note); canary 100; `mutate:changed DB16` target.ts 78 of 78 killed (100); spec files identical to d69ac55 (only reports/DB16-spec.md changed after it, a report); host guard held (no path reaches a non-local or live database, no password in url or error). test:flake runs 1 and 2 ok (278 s, 250 s); runs 3 to 5 not awaited because the card already fails.

Scope: `scope.mjs DB16` fails only on the spec job's own commits (b14182c wip tests, 49cd785 and 8924d4e spec report): the known CQ4 gap, not a build edit.

## Failures (Opus read, src/core/db/index.ts)
1. :155-171, :201-202 Roles/settings are set for the session before `begin` and cleaned with `reset role; reset all`, not `set local` as A419 directs. If cleanup fails the error is swallowed and the connection returns to the pool (no `release(true)`), so role/settings leak to the next transaction.
2. :201 `reset all` does not reset `session_authorization`; a transaction that runs `set session authorization` returns its connection still as that user.
3. :169-171 The role is copied only when `current_user` differs from `session_user`; with `set session authorization` on the handle the transaction connection may stay superuser and bypass row-level security.
4. :133 The `tracked()` regex misses `set_config($1, ...)` with a parameterised name, so such `app.*` settings never reach transaction connections (fails closed; no current use in src, testworld or tools).

Rule candidate: any pooled-connection state copy must be transaction-local or destroy the connection on a failed reset; add a test that a poisoned reset discards the connection.
Permission gaps: none. Model: Sonnet checker; Opus 5.5 subagent for the adversarial read.
