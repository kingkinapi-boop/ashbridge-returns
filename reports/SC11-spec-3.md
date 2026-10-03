# SC11 spec patch, round 2 (A500; worker cloud-019852)

Validated on main 1146806 (merged in). DB16.md restored from origin/main.
- src/core/db/pool-rules.acceptance.test.ts (unit, new): R116 scan (every pg Pool/Client in src/** assigned to a named variable with a non-swallowing error listener, directly or through a listen/record/track/watch helper), R117 scan (no raw pool.end() outside `function endPool`); plants on __fixtures__/index-87066e33.ts (8 sites, 3 raw ends). 2 tests fail on the real index.ts, 4 pass.
- src/core/db/rules.acceptance.db.test.ts (appended, pg16): endPool closes every socket incl. release(true); bounded rejection; late error recorded not thrown and taken once; idle and checked-out kills with pg_terminate_backend reject naming database and 57P01; assertCleanClones reports takeLateErrors. 6 fail (exports missing; the kill tests show the unhandled 57P01).
- Chosen API (amber): index.ts exports openPool(config), endPool(pool), takeLateErrors().
- Not tested: the 5 s bound beyond "under 15 s"; a fake in-memory socket plant (the static plants cover it); full-suite sweep 6b not run (the new tests only add exports).
- Prettier has no repo config; files hand-formatted no-semi, single quotes, width 120.
Permission gaps: none. Model: Sonnet 5.5 (SC11 is security, not core).
