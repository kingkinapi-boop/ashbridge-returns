# A06 check (cloud-dea37c, 2 Oct, branch claude/A06 with origin/main merged)

PASS.
- typecheck, lint, deps:check clean. `npm test`: unit 1713/1713, db 397/397. mutate:canary 100.
- Spec files (spec(A06) 8af6557) unchanged by the build.
- Diff read against SEC-1/6/7/10/11, ARC-6/20, END-8: scrypt passwords, one-time codes once only, token stored as sha256, append-only events, lock-out from events, "(Test)" gate, AUTH_ENGINE read by name with no key. Nothing extra built; no client sentence, no secret.
- Scope: `node tools/scope.mjs A06` reports src/core/env.ts and env.settings.test.ts outside the paths because plan/slices.json still lists only auth/**, contracts/auth.ts and 15_auth.sql. The card file already names them (A378). Lead: add both to the A06 `paths` in slices.json before boarding.
- Not run: mutate:changed (card is security, not core; no money/tax/CSV/citation file); a separate /security-review pass (diff read by hand only).
Permission gaps: none. Model: Sonnet 5.5.
