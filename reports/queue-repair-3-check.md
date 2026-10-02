# Queue repair 3: check

FAIL (one gap; everything else passes)
- Ran: npm ci ok; `vitest run tools/test` 4 files, 59 passed, 0 failed, 0 errors. Diff vs merge-base bb57e03 touches only tools/ and the build report. claim.mjs command shapes unchanged (--validated is optional).
- Mutated by hand, restored (tree clean): items 1 (recheck), 6 (no-sha refit) and 5 (A253 pattern) each make a test fail. Item 4 has no execFileSync/spawnSync left in tools/test (grep).
- GAP, item 3: next.mjs `const specReported = ...` set to false (build gate for a reported spec) leaves all tests green. Only the "spec reported (commit in the claim)" label is tested, not that the card is treated as buildable by the gate (tools/next.mjs). Add a test: reported spec + dep reported but not merged, card must not show as waiting on deps for spec.
- Item 2 had no code change (behaviour already existed); its test is a regression guard only.
Docs that must change when it lands: worker.md spec report must pass `--validated <sha of origin/main used>` (after landing, a spec reported without it is offered again as "toolchain refit", so an old-docs spec worker loops until updated); dispatch skill (spec jobs merge main, run typecheck, lint, tests first); src/core/egress-rules.acceptance.test.ts still has its own old shellProblems (spec job, build amber a).
Heavy slot waits were long (npm ci about 4 min here, tests 268 s; the tools suite is slow).
