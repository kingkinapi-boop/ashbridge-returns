# SC4 build report
Branch claude/SC4. Worker cloud-fd4d7f. Rules-only card (paths are tests and fixtures), so the build is the main merge and no product code change.
- tools/test/reading-rules.test.mjs: 17 of 17 pass (R67 to R70, R74, R56 exemption); all of tools: 214 pass; typecheck, lint clean; scope OK (15 files).
- KNOWN list (owner FX4) is checked both ways: stale entries fail, so it matches current main.
- Mutation: not applicable (no @mutate files changed).
- Ambers: none. Permission gaps: none (built in a separate worktree because the main checkout holds the hook-modified plan/ledger.jsonl).
Model: Sonnet 5.5.
