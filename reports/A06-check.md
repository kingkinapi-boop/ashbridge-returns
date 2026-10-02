# A06 check (round 2), cloud-ad4518, branch claude/A06 at b39dcb5

PASS

- typecheck, lint, deps:check clean (Node 24.21).
- npm test: unit 2462/2462, db 545/545 (PGlite). test:flake: 5 of 5 runs ok.
- Spec files unchanged since f5c82fcc; scope OK (16 files, all inside the card's paths).
- Mutation: canary 100 (10 killed); mutate:changed A06 covers env.ts only, 22/22 killed (engine.ts is not a money/tax/CSV/citation file).
- Opus adversarial read of the round 2 diff against the clauses and findings fix list 1 to 5: PASS (row lock before every check and write, nothing on `db` inside a transaction, unique code-once index, one scrypt per attempt, null user_id for unknown users, blank AUTH_ENGINE refused in production).
- Opus security review: nothing medium or higher. Lows for the Lead: scrypt cache costs two runs on the first attempt per real user per process (precompute at engine start); unknown user skips the transaction; "signed in" log line written before the session insert can outlive a rollback; real-staff check and seeding not in one transaction; code compared with `===`; scryptSync blocks the event loop. Info: the new foreign key means staff users are never deleted (note for V00 and GL1).
- Not run: Postgres 16 parity (no PG16 service started in this box) and `npm run e2e` (card has no screens). The build report also lists PG16 parity as pending.

Permission gaps: none. Model: Sonnet 5.5 (checker); Opus 5.5 subagent for the adversarial read and security review.
