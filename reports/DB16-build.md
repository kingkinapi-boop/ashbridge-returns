# DB16 build, round 5 (A441)
Branch claude/DB16 (spec 71dc7af, main merged). Worker cloud-feb1e6. Changed: src/core/db/index.ts only.
- transaction: begin first; inside it set local session authorization, set local role, set_config(name, value, true) for session settings and tracked custom names (items 2).
- release: rollback then discard all; any failure destroys the connection (release(err)). A transaction that ran a custom-setting statement also destroys its connection (RESET leaves the name as '' not null, which T1 caught) (item 3).
- tracked: set_config($n) names come from params; a non-literal, non-$n name marks the handle opaque and the next transaction is refused naming the statement (item 4).
- dropOwnedRoles: reset session authorization and role first; a failed drop fails close() naming the role, after connections end (item 5).
- Numbers: pg16 db project 571 passed, 1 skipped; PGlite db project 566 passed, 1 expected fail, 5 skipped; typecheck, lint, deps:check clean; mutate:changed target.ts 100 (78 killed, 0 survived). Spec tests untouched. scope.mjs lists only old spec-commit reports (known tool gap).
- Not run: test:flake 5 of 5 (left to the checker), full npm test beyond the db project.
- Note: discard all drops temp tables and prepared statements; no caller names a statement. Needs a superuser login (set local session authorization): the local postgres user is.
- Amber: destroy-on-custom-setting rather than always release(true), to keep connection churn low. Reverse: always release(true).
- Permission gaps: none. Model: Sonnet 5.5.
