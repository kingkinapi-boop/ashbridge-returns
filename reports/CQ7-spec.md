# CQ7 spec (cloud-d98b06, 3 Oct)

- Spec commit f62e90f, validated on main c98b754 (merged into claude/CQ7, which sits on claude/CQ5's build). Tests: tools/test/claim-race-update.test.mjs, 5 ARC-15 tests (3 fail first: update and beat clobber the Lead's note, beat on a job released in between; 2 guard a move on another job being kept).
- Same planted race as CQ5 (preload after A's first git ls-tree, rival = the Lead via update --worker lead), generalised by RACE_CMD.
- Step 6b: stub (update and beat pass decidedTip to writeClaims) passes all 5; tools 284 of 284 green; no test retired. Typecheck and lint clean.
- Amber: a refused write returns 'retry' and the loop re-reads and re-decides, so "refused as RACE" is tested as the outcome (the other worker's fields survive), not an exit code. Build needs CQ5's tools/claim.mjs (claude/CQ5) in its base.
- Permission gaps: none. Model: Sonnet 5.5 (card not core).
