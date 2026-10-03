# A06 build, round 2 (cloud-c29b25)

Branch claude/A06, main merged in. Fixes 1 to 5 of reports/A06-findings.md; fix 6 (card wording) is the Lead's.
- index.ts: production with AUTH_ENGINE unset or blank is refused naming it; testusers refuses to start (no row written) when staff_users holds an is_test = false row.
- engine.ts: startSignIn and finishSignIn run in db.transaction under `for update` on the user row; success event written before the session (unique index backstop, 23505 becomes `code reused`); one scrypt per attempt (dummy hash for unknown and non-test users); unknown user: null user_id, no userId in the log.
- 15_auth.sql: unique index sign_in_events_code_once; foreign key on sign_in_events.user_id.
Files: 3 product files, no test edited. Acceptance: src/modules/auth 73 of 73 pass (PGlite); src/contracts + src/core 1730 pass; typecheck, lint, deps:check clean; scope OK (16 files).
Not run: Postgres 16 parity (the cloud check runs it), full suite, fresh /security-review (Lead's next step, card says before boarding).
Amber: none. Permission gaps: none. Model: Sonnet 5.5.
Note for V00 and GL1: staff users are never deleted now (foreign key); switch them off instead. Journeys that start the server in production must set AUTH_ENGINE.
