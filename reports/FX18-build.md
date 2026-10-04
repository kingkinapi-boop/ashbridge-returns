# FX18 build, round 2 (B1 to B8)

Branch claude/FX18, worker cloud-1916ac. Spec tip 6e1bff63 (A537 patch) merged with main fb3354ce.

- Files: src/modules/ai/runner/engines.ts, runner.ts, schemas.ts, exchange-limits.build.test.ts (B4 rewrite of :239, plus one vanished-entry test).
- B1 attempt() exported, try/catch on separate lines, one next-line BlockStatement disable (placed as the catch clause's leading comment: a comment after `return` is not read by Stryker). B2 relIsInside(rel, p = path), insideRepo disable gone. B3 schemas.ts range gone: five next-line disables on static import-time mutants 647 to 654 (REPO_ROOT '..' segments, strictObject shape, data path segments), ids named in the comments.
- B4 strangers: per-wait Set in projectRun, name-only keys, `<id>.*` exempt from the cap; recordings keep the runner-wide set (line plus content). B5 lastErrorLine drops Cc, Cf, Zl, Zp then cuts by code points. B6 staging unlinked in a finally (errors ignored). B7 chmod 0700 after realFolder(make), failure gives the fixed not-real sentence. B8 SEC11_TEST_ONLY shared by runner and engine.
- Numbers (Node 24.21): typecheck, lint, deps:check clean; scope OK; unit 3568 of 3569 pass; db with TEST_DB=pg16 745 pass, 1 skipped; mutate:changed FX18 main --force: 100.00 on engines.ts, runner.ts, schemas.ts (one extra equivalent survivor, line 76 moreKey ArrayDeclaration, has a next-line disable with reason).
- The one unit failure is not FX18's: tools/test/claim-wait-check.test.mjs "ARC-15 on main" reports "SC11b: no Where line" (main's card, Lead's).
- Amber: B4's cap exemption matches by `<jobId>.` prefix; reverse by exact-name set. The `String(ctx.jobId)` form avoids an unreachable undefined branch.
- Left: Opus read and fresh security review (security card); the pg16 db run did not hit the 57P01 flake.
Permission gaps: none. Model: Sonnet 5.5.
