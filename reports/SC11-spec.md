# SC11 spec: released (Paths gap, A414)

R90 needs a check on every idle pooled connection before the pool ends, failing by the name of the test that left it dirty. Pools are made and ended in src/core/db/index.ts (PgDb.close / closeClones); the per-test hook is src/core/db/vitest-setup.ts. Neither is in SC11 Paths. global-setup.ts cannot do it: it runs in the main process after worker pools have ended. R91 (global-setup.ts) and R92 (tools/test-homes.json) fit the Paths.

Fix for the Lead: add src/core/db/index.ts and src/core/db/vitest-setup.ts to Paths (harness, unmarked). Also choose the spec file name: rules.db.test.ts does not match the builder-lock pattern in .claude/hooks/protect-spec.mjs (`.acceptance.test.`), nor does DB16's pg16.acceptance.db.test.ts.
Plan once fixed: plants as a fixture copy of index.ts at 36672c88 that R92's scan skips; empty R92 allow list (DB16 round-5 index.ts has no `.catch(() => undefined)`).

## Permission gaps
None.
## Model
Opus 5.5 subagent (spec-writer); worker Sonnet 5.5. No tests written, nothing pushed.
