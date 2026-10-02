# A06 spec report (cloud-7f8978, 2 Oct 2026)

- Tests: 73 in 3 files (`src/contracts/auth.acceptance.test.ts`, `src/modules/auth/rules.acceptance.test.ts`, `src/modules/auth/auth.acceptance.db.test.ts`). Clauses: SEC-1, SEC-6, SEC-7, SEC-10, SEC-11, ARC-6, ARC-20, END-8. Spec commit 8af6557, validated on main 31ee347 (branch based on claude/F01C for the schema, main merged in).
- Stub run (throwaway worktree, removed): all 73 pass; full suite there: only two other failures, both caused by the stub (env.ts lost `// @mutate`; a schema-folder mention in a test comment, fixed in the spec). Step 6b retired tests: none.
- The shape the tests fix is written at the top of each file: `createAuth({ db, env, clock, sink })`, `AUTH_ENGINE` optional in env.ts (unset stays undefined so F00T's exact-equality tests hold; keep `// @mutate` on env.ts), tables `staff_users(id, display_name, roles)`, `staff_sessions` (token sha256 hex), `sign_in_events(user_id, outcome, reason, created_at from the clock)`, event reasons `signed in`, `wrong password`, `wrong code`, `code reused`, `locked`, `not a test user`.
- Amber: (1) "eight users, two per role, plus one dual" read as nine users; (2) `live` engine refuses at `createAuth` (as A05 does); (3) lock counted from the fifth failure and not extended by later refused attempts; (4) a stale or reused code counts as a failed attempt; (5) gitleaks test runs the real binary only when installed, otherwise the built-in secret-shape scan covers it (the box has none); (6) typecheck and lint fail on the card's own missing modules until the build exists.

## Permission gaps
None.

## Model
Sonnet 5.5 (card is `security`, not `core`, so no Opus subagent).
