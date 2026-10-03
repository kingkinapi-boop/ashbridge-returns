# CQ8 spec (cloud-5dde9a, 3 Oct)

- Spec commit 01c1194, validated on main 0e39bb0 (claude/CQ5 merged in as the dep; typecheck, lint clean). Tests: tools/test/next-paths.test.mjs, 8 ARC-15 tests (5 rule 1, 3 rule 2); 3 fail on main for the right reason (next.mjs prints START for a held card; Lead reopen of a check exits 6), the rest guard against over-fix.
- Retired (6b): queue.test.mjs "a role other than build or spec is still refused" used check as the refused role; CQ8 supersedes it, so it now uses role deploy (retitled, same assertion).
- Amber: held line format is "<card> waiting on paths: <holder>"; holds apply to build-ready cards only (a card needing its spec still STARTs, as claim.mjs offers specs regardless of paths). Existing "waiting on paths in use" line (status-based) unchanged.
- No stub sweep of the full suite (tools-only card); queue.test.mjs 39 of 39, the only other file pinning the changed behavior.
- Permission gaps: none. Model: Sonnet 5.5 (not core).

## Refit (cloud-aab122, 3 Oct)
Validated on main 164d8d66 (merged). typecheck and lint clean; next-paths 3 fail first as designed. tools/test: 384 of 388 pass; the 4 failures are those 3 and schema-contract-rules R18 (other cards lack // @mutate). No assertion changed. Note for the Lead: the spec has no test for card rule 3 (local- workers never offered Where: cloud cards; grep shows 0 mentions of local- in the test file).

## Refit (cloud-0ac9e9, 3 Oct)
Merged origin/main 66de2c9; no assertion changed. Typecheck and lint clean; unit project 2783 of 2786 pass, the 3 failures are next-paths by name (rules 1 and 2). Old validated sha 164d8d66, new 66de2c9. Permission gaps: none. Model: Sonnet 5.5.
