# FX10 security review (3 Oct 2026)

Verdict: **CLEAN** (no finding medium or higher).

Scope: `git diff origin/main...origin/claude/FX10 -- src` (one file, `src/modules/auth/auth.acceptance.db.test.ts`), read as /security-review would, against A329 (never weaken a security check). Model: Opus 5.5.

## What was checked

- **Every former assertion kept, same meaning.** Each of the 6 multi-world tests is now one test per world with the same body and the same `expect` lines:
  - Nine-user sign-in (SEC-1): the loop moved from the body to `for (const u of listTestUsers())`; roles, userId and signedInAt assertions unchanged. A new test pins the set at 9 users, so an empty or shrunk list cannot make the split pass vacuously.
  - Drift one step accepted (-1, +1) and two steps refused (-2, +2): same values, same `toBe(true)` / `toEqual(FAILED)`.
  - Engine testusers by default, by name and blank: same three envs, `isLive` false and sign-in ok each.
  - Production unset or blank AUTH_ENGINE refused naming AUTH_ENGINE, staff_users empty: same two envs, both assertions kept.
  - Production `AUTH_ENGINE=testusers` by name works; outside production (development, test, unset) unset still means testusers: same assertions, one world each.
- **Live engine and production refusals untouched.** ARC-20, END-8 (planted key never printed), SEC-11 (production with live refused; testusers refuses a real `is_test = false` user) only swap `cloneTestDb()` for `freshDb()`; assertions unchanged.
- **No timeout or retry added.** No `retry`, `timeout`, `testTimeout`, `skip`, `only` or `todo` in the file; no vitest config change in the diff. The cause was budget (clone cost times four worlds), fixed by splitting, not by raising a timeout, so a real race in sign-in would still fail.
- **New guard is additive.** `afterEach` fails any test that makes more than one database; the self-test counts direct `cloneTestDb(` calls (exactly one, inside `freshDb`) and catches a planted second. It cannot pass a test that would otherwise fail.
- **Fixtures.** No new fixture data. Existing planted strings (`PLANTED-live-key-4d2e`, `PLANTED-engine-77`) and the made-up "Jordan Real" row are pre-existing, not secrets, not real people. No host, URL or key in the diff.

## Notes (low, no action needed)

- The nine sign-ins no longer share one database, so the per-user test no longer shows nine sessions coexisting. Cross-user isolation is still covered by "SEC-1 the lock is per user: another user signs in while one is locked" (line 302).
- The check ran `test:flake` 5 times under load, not the card's 20. A process gap for the Lead, not a security finding.
