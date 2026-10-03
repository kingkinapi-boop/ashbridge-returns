# FX10 spec report

Worker local-2 (laptop), Opus 5.5. Spec commit 0f8e76f6 on claude/FX10, validated on main 1f88585c (no src or vitest config change since the base the load runs used, 430c418c). One file: `src/modules/auth/auth.acceptance.db.test.ts`, 57 tests before, 76 now. Clauses ARC-6, SEC-1.

## Cause, named
A timeout in the test, not a race in sign-in. The failing test made four worlds in one body; each world is one `cloneTestDb()` (about 0.85 s on the laptop, measured: clone 804 to 913 ms, createAuth 20 to 32 ms, startSignIn 93 to 184 ms, finishSignIn 18 to 32 ms). Alone it took 3.8 s, in a plain full db run 4.4 s, and under load 6.9 to 7.6 s against the db project's 6 s budget. Reproduced: the file under 16 CPU burners, 2 runs, 3 failures, all Vitest timeouts at line 610 (the four-world test twice, "ARC-6 the engine is testusers by default and by name" once). No assertion failed in any run.

## The split (every assertion kept, each test with its own world and pinned clock)
- "ARC-6 in production AUTH_ENGINE=testusers set by name works, and outside production unset still means testusers" becomes 4: production by name, and NODE_ENV development, test, unset.
- "ARC-6 the engine is testusers by default and by name" becomes 3 (one per setting); "ARC-6 in production an unset or blank AUTH_ENGINE is refused" becomes 2.
- "SEC-1 a code one step either side is accepted" and "two steps away is refused" become 2 each (one per drift).
- "SEC-1 the right password then the right code gives a session with exactly the user roles" (nine sign-ins in one body, 4.2 s in a full run, 5.7 s under load) becomes 9 (one per user) plus "SEC-1 there are nine made-up users" so the set cannot shrink silently.

## Rule against the class (in this file)
- Every database comes from `freshDb()`; `afterEach` fails any test that made more than one ("FX10 one database per test"). Planted: a two-world test failed with that message (run once, removed).
- "ARC-6 every database in this file comes from freshDb" scans the file through `readOwnSource`: exactly one direct clone call; a planted second one is counted.

## Runs
- File alone: 76 of 76 pass. Under 16 burners after the split: 3 runs, 2 green; run 1 had 3 timeouts in the single-world lockout tests (6 scrypt calls each, 6.5 to 9.3 s), during heavy outside load as well (that run took 237 s against 148 s and 154 s for the other two).
- Full db project (564 tests) under 8 burners, 2 runs: both green; the slowest auth test 4.1 s ("a mix of wrong passwords and wrong codes").
- Unit project: 2548 tests, 3 fail, the known laptop-only ones (design/basis RV-52 timing; storage real-parent ARC-6 two symlink tests). Typecheck and eslint clean.
- Fail first: this is a test-only fix, so the new tests pass on main's code; the proof is the old file's timeouts under load. The build job has no product change to make (the cause is not product code); it confirms the 76 pass.

## 6b
No product change, so no stub. Tests retired: none; the 6 multi-world tests are replaced by their 22 per-world parts in the same file.

## Amber
- The every-user test was split too (not named on the card): nine sign-ins in one body ran 5.7 s under load, the same budget problem.
- The guard lives in this file only (card Paths). Reverse: drop `freshDb` and the afterEach.

## For the Lead (outside FX10's Paths)
- The same class bites elsewhere. Under load (full db plus 8 burners): bridge "END-1 a year end the client never confirmed" 6.0 s, jobs "ARC-16 two runs of the same scenario" 5.7 s and "ARC-5 both runners" 4.6 s, core/db "ARC-4 a database is created from the schema folder" 5.1 s, records "ARC-10 figures accepts a stamp" 4.4 s, all against 6 s. A project-wide rule fits in `src/core/db/vitest-setup.ts` (`closeClones` already knows each test's clone count) plus a fix card per file.
- `vitest.config.ts` counts this laptop as a cloud box (16 CPUs is more than 4), so the db project runs 8 workers here, not 2; its comment says the laptop budget is "not yet measured". The single-world lockout tests (5 to 6 scrypt calls) stay at 3 to 4 s under load, and up to 9 s when the laptop is oversubscribed. The 6 s budget for laptop runs needs a measured value; that is a config card, not this one.
- Check note: "20 db runs green under load" is a cloud check (the card says Where: cloud); on the laptop, keep the load at or below one full db run plus 8 burners.
