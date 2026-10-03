# A06 security review (round 2, fresh)

## Verdict: CLEAN

Branch `claude/A06` at 51837c8 (round 2 build b39dcb5), diff against `origin/main`, plan/ and reports/ excluded. Reviewed 2 Oct 2026 by a fresh Opus reviewer who did not spec, build or check A06. Nothing was fixed.

No HIGH or MEDIUM finding, and no exploitable or permission-changing issue left in the round 2 diff. The five issues of `reports/A06-security.md` (M1, L1 to L4) are each closed as the findings fix list asked.

## Verified

- [verified] `npx vitest run src/modules/auth src/core/env.settings.test.ts src/contracts/auth.acceptance.test.ts` (PGlite, Node 24.19 on the laptop): 4 files, 85 of 85 pass, including the production refusal, the real-staff refusal, the 8-way lock-out races, the code race and the equal-work count.

## Round 1 findings, closed (read against the code)

- M1: `src/modules/auth/index.ts:19-21` refuses production with `AUTH_ENGINE` unset or blank (blank becomes unset at `src/core/env.ts:8`), naming the setting, never a value; `engine.ts:96-97` refuses to start, before any insert, when `staff_users` holds an `is_test = false` row. Live fails closed (`live/index.ts:4-6`).
- L1: `engine.ts:167-171` and `:188-190` take `select ... for update` on the user row before the lock-out read and the event write, all on the transaction handle; no query on `db` inside a transaction.
- L2: `15_auth.sql:46-47` unique index on `(user_id, code_step)` for successes; `engine.ts:199-208` writes the success event before the session in one transaction; 23505 becomes `code reused`.
- L3: `engine.ts:165` runs one scrypt (dummy hash for unknown and non-test users) before any return.
- L4: `engine.ts:166` records a null user id for an unknown user and `:113` leaves `userId` out of the log line; `15_auth.sql:36` adds the foreign key, so typed text cannot land in `sign_in_events.user_id`.

## Also checked, nothing found

- Every query is parameterised; no string-built SQL.
- Session tokens: 32 random bytes, a fresh one per sign-in (no fixation), stored only as sha256 (`15_auth.sql:27` format check); idle and 12-hour caps enforced on every read (`engine.ts:140`, `:145`); roles read fresh from `staff_users` on each read; `signOut` deletes at once.
- Challenge: 32 random bytes, single use (deleted before any check, `engine.ts:181-182`), 5-minute life; the map grows only on a right password and is pruned on each success.
- Codes: RFC 6238, one step of drift each way; code compared with `===` (a million values, five guesses per 15 minutes: no practical timing attack).
- No key, password, code or token in a log line or an event row; `testing.ts` is not exported by `index.ts`; settings errors name settings, never values.
- Row-level security on for all three tables, no policies; sign-in events refuse update, delete and truncate.

## Residuals, not findings (already owned elsewhere; for the Lead's notes)

- Production with `AUTH_ENGINE=testusers` set on purpose still starts and seeds three public-credential owners when `staff_users` has no `is_test = false` row, even if other tables hold real data. This is the decided design (journeys run in production mode); R63 (stand-ins refuse a database with any real row in the tables they write) and GL1's go-live switch own the rest. Note: `is_test` defaults to true in every table, so a real staff row inserted without setting it would not trip the guard; GL1 should insert real users with `is_test = false` explicitly.
- The real-staff guard runs once at start; a real user added later whose display name contains "(Test)" would get the stand-in's derivable password. Needs a deliberate odd name; SEC-11 checks the name only, as the card says.
- [inferred] The lock-out serialisation relies on Postgres READ COMMITTED (each statement after the row lock sees the other transaction's committed events). Under REPEATABLE READ the snapshot predates the lock wait and parallel attempts could exceed five. PGlite serialises transactions anyway, so only the Postgres 16 parity run proves this; it has not been run (build and check reports both say so). The code-once rule does not depend on it (unique index).
- Unknown-user and `locked` refusals are written to an append-only table with no rate limit, and `eventsOf` reads a user's whole history under the row lock: a flood can grow storage and slow one user's sign-in. Rate limiting belongs to the sign-in screen (V00).

Model: Opus 5.5. Permission gaps: none.
