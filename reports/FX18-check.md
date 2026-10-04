# FX18 check (round 2 build), cloud-c7a694, 4 Oct 2026

Result: FAIL (one item, Opus read). Everything else passed.

Passed: typecheck, lint, deps:check; `npm test` 3568 of 3569 (the one failure, tools/test/claim-wait-check "SC11b: no Where line", is on main and not this card's); spec files unchanged since 6e1bff63; `node tools/scope.mjs FX18` clean; mutate:canary 100; mutate:changed FX18 100 on safe-read.ts, engines.ts, runner.ts, schemas.ts, index.ts. No db files touched, so no pg16 run.

## Failure
1. src/modules/ai/runner/engines.ts:212 (lookAtStranger): the cap exemption is `name.startsWith(`${jobId}.`)`, so every `<id>.*` name is exempt, not the one waited-id other-extension file B4 means. An outbox writer can plant `<id>.1`, `<id>.2`, ... and each is logged and added to the per-wait set with no limit, defeating seenMax (R104, L4) and allowing log flooding. The R104 marker at :357 ("exempt, and counted once") is false. The builder listed this choice as amber.
   Fix: exempt only the first `<id>.*` name met in a wait. Test to add: seenMax + 3 strangers plus two `<id>.*` names; only one of the two is logged past the cap.
Rule candidate: any "exempt from a cap" test plants two exempt names, not one.

## Lows (card or SC12, not failures)
- engines.ts:213 JSON.stringify leaves U+2028, U+2029, U+202E, U+200B in a logged stranger name (L5 cleans only last_error).
- engines.ts:279 chmodSync follows symlinks after the realpath check (narrowing only, same-owner folder).
- schemas.ts:35, :41, :53 disable reasons claim import-failure kills; say why they survive instead.
- engines.ts:43 EngineContext.seen comment is stale (holds recordings only).

Security review (Opus read on the diff): no medium or higher finding beyond item 1.
Permission gaps: none. Model: Sonnet checker; Opus subagent for the adversarial read and security read.
