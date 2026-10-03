# GL3 spec: toolchain refit (cloud-cb16ff, 3 Oct 2026)

Existing spec 9da00fbd (54 tests: 29 unit, 25 db), validated on main f9da8e52. Refit: merged origin/main 164d8d66 into claude/GL3 (on top of the build, head 2395f0c2) and repeated step 6.

## Result
- Validated on main 164d8d66 (old sha f9da8e52).
- `npm run typecheck`: clean. `npm run lint`: clean.
- Unit project: 2743 passed, 2 failed, neither in a GL3 acceptance file:
  - `tools/test/schema-contract-rules.test.mjs` "ARC-15 R18 every core file ... carries // @mutate": names `src/modules/auth/testusers/engine.ts` and `src/modules/jobs/runner.ts`. Fails the same on a clean origin/main 164d8d66 worktree: not GL3's; a finding for the Lead.
  - `tools/test/schema-contract-rules.test.mjs` "EV-1 R41 one blank definition": names `src/modules/golive/bridge/manifest.ts` (a `z.string().min(1)` rule; use `NonBlankSchema`). That file is the build's product code, not the spec's (the spec fixture `__fixtures__/views-manifest.ts` is not flagged): a build fix for the GL3 build round, which the spec writer may not make.
- Db project (PGlite): 612 passed. GL3's three files (both acceptance files and the build's unit tests): 67 passed.
- Postgres 16: not run; the DB16 harness is not on main yet (train 26e84345 checking).
- Acceptance tests and spec fixtures unchanged since 9da00fbd (git diff empty). No assertion changed; no spec file edited.

## Step 6b
Refit only (no new tests): no test contradicts the spec; tests retired: none.

## Permission gaps
None met.

## Model
Opus 5.5 (cloud worker cloud-cb16ff).
