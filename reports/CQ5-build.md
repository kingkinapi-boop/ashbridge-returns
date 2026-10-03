# CQ5 build (cloud-5dde9a, 3 Oct)

- Branch claude/CQ5. Files: tools/claim.mjs only.
- `next` reads the claims tip once (decidedTip) and passes it to `writeClaims`. If the tip moved and the job's claim file changed in between, the write is refused ('retry', next loop re-fetches and picks again); a move on other jobs only is kept and the claim lands on top.
- Acceptance: tools/test/claim-race.test.mjs 3 of 3 pass; all tools tests 279 of 279 (16 files).
- typecheck clean, lint clean, deps:check clean, scope OK (3 files in paths). Not core: no mutate.
- Amber: `update` and `beat` keep the read-then-re-read pattern (card covers `next` only); the Lead may card it. Reversible: drop the third argument.
- Permission gaps: none. Model: Sonnet 5.5.
