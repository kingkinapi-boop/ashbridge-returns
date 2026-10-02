# A06 security review

Card A06 (staff sign-in stand-in, two-factor, sessions and roles). Branch `claude/A06` at 291cbd4, diff against `origin/main`, plan/ and reports/ excluded. Reviewed 2 Oct 2026 by an Opus security reviewer. Nothing was fixed.

## Verdict: FINDINGS

1 MEDIUM, 4 LOW. No HIGH. No secret, key or real data in the diff; no SQL injection (every query is parameterised); session tokens are 32 random bytes, stored only as sha256, freshly issued at each sign-in (no fixation); idle and absolute expiry are enforced on every read; the challenge is single use; password hashes are compared with `timingSafeEqual`; roles are checked by the database and read fresh from `staff_users` on every session read; row-level security is on for all three tables with no policies and no grants; sign-in events refuse update, delete and truncate; the live engine fails closed.

## Findings

### M1 (MEDIUM) The stand-in is the default in every environment, and anyone with the repo can sign in as owner

- `src/core/env.ts:8` makes `AUTH_ENGINE` optional; `src/modules/auth/index.ts:18` falls back to `testusers` when it is unset, with no check of `NODE_ENV=production` or of any go-live switch.
- `src/modules/auth/testusers/credentials.ts:7,27-28`: every password and one-time code seed is `sha256(kind:userId:'ashbridge-returns-made-up-users')`, so both are computable by anyone who can read the repo (this is the card's design).
- `src/modules/auth/testusers/engine.ts:88` inserts the nine test users (including `owner-1`, `owner-2` and `cpa-owner-1`) into whatever database it is given, each time the adapter is created.
- Exploit: at go-live the database holds real returns. If the deploy omits `AUTH_ENGINE=live` (unset is the default and raises no error), `createAuth` silently runs the stand-in, seeds the test owners into the live database, and an attacker who has read the repo computes `cpa-owner-1`'s password and current code and gets an `owner` and `cpa` session, which SEC-2 lets see every return. SEC-11's "(Test)" name check does not help: the seeded users carry "(Test)".
- Fail-closed fix for the Lead to card (V00 or GL1): refuse `testusers` when `NODE_ENV=production` (or when the go-live switch is on), make `AUTH_ENGINE` required in production, and stop seeding users from the engine outside tests.

### L1 (LOW) Parallel attempts bypass the five-failure lock

- `src/modules/auth/testusers/engine.ts:148,151` and `:165`: the lock is read from the event log (`isLocked`), the attempt is checked, and only then is the failure written (`record`). Nothing serialises a user's attempts.
- Exploit: fire N `startSignIn` (or N `finishSignIn` on N challenges) for one user at once. PGlite queues all N user lookups and event reads before the first failure insert, so all N see zero failures and all N are evaluated: N guesses in one 15-minute window instead of five. Moot for the stand-in (its credentials are public) but the lock logic is the pattern GL1 will copy for real passwords. Fix: serialise check-then-record per user (a row lock on the user, or an in-process mutex keyed by user id).

### L2 (LOW) A one-time code can be used twice by racing

- `src/modules/auth/testusers/engine.ts:170-171`: the used-steps set is read from events, then the session is inserted and the success event written (`:176` onwards). Two `finishSignIn` calls with the same code on two challenges both read the used set before either success row exists.
- Exploit: an attacker who has the password and sees the user's code (shoulder-surfing, a phishing relay) submits it in parallel with the user; both get sessions, defeating "a code is accepted once" (SEC-1). Fix: a unique index on `(user_id, code_step)` for success events, written before the session is issued, so the second sign-in fails.

### L3 (LOW) Timing tells an attacker whether a user id exists and whether it is locked

- `src/modules/auth/testusers/engine.ts:147,148,150` return before the scrypt work at `:151`; a known, unlocked user costs one scrypt run (tens of milliseconds), an unknown, locked or non-test user costs none.
- Exploit: time `startSignIn` with a wrong password to enumerate valid staff ids and learn which accounts are locked, though the caller is told only "sign-in failed" (the card's "no telling which part was wrong"). Fix: always run one scrypt (against a dummy hash) before any early return.

### L4 (LOW) A password typed into the user-id box is logged and kept forever

- `src/modules/auth/testusers/engine.ts:147` records `userId.slice(0, 64)` for an unknown user; `record` writes it to `sign_in_events.user_id` (append-only, no delete, no truncate) and to the log under the key `userId`, which the logger in `src/core/log.ts` does not redact.
- Exploit: a staff member types their password into the user-id field (a common slip, usually followed by the right attempt); the password lands in plain text in the log and in an undeletable table, readable by anyone with log or database access (SEC-10). Fix: for an unknown user, record no user id (or a fixed marker or a keyed hash), not the typed text.

## Not findings (checked)

- `createLiveAuth` throws "live sign-in is off until go-live"; no key is read anywhere.
- The one-time code comparison at `engine.ts:168` is a plain `===`; with one guess per challenge and a space of a million, a timing attack is not practical.
- `testing.ts` is not exported from `index.ts`, and `rules.acceptance.test.ts` guards who imports it.
- Five wrong passwords lock a real person out (a denial of service by anyone who knows an id); the card asks for this rule.
