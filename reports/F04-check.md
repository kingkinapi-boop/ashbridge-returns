# F04 check (cloud-d2cfdd, 2 Oct 2026)

FAIL (2 findings, 1 clash for the Lead).

Passed: typecheck, lint, deps:check, npm test (33 files, 755 tests), spec file unchanged since the refit ec29150, scope clean, mutation 86.5 on ai.ts (threshold 70), `// @mutate` present.

## Failures
1. AI-1 / acceptance check 5: an unknown key inside a document citation's `box` is accepted and silently dropped. `src/contracts/ai.ts:13` uses `BoxSchema` from `src/contracts/reading.ts:14-22`, a non-strict `z.object().refine()`. Confirmed by a probe (since deleted): `citationSchema.safeParse({source:'document', documentId:'d', quote:'q', box:{page:1,left:0,top:0,width:.5,height:.5,figureKey:'x'}})` returns success, data without `figureKey`. The check-7 JSON Schema test cannot see this. The fix is a strict box at its source (reading.ts, outside F04's paths: an F09 follow-up or a widened scope), or a strict wrapper in ai.ts that keeps the one box shape.
2. AI-5: `ai.ts:56` lets a "missing" finding cite any kind, so one citing only a ledger record passes. AI-5 says it cites "a document, a page or a return cell".

## For the Lead
3. Clash between AI-5 and AI-4: AI-5 allows citing a document or page for a missing item, but `ai.ts:13` always requires a box and a non-empty quote, and a missing item has no words to quote. Needs an amber or a spec decision before the fix.

Rule candidate: every contract schema, and every schema a contract imports, rejects unknown keys at runtime, tested by a property test that adds a stray key at every nesting depth (not only through z.toJSONSchema).

Note: the Opus read could not run tests; finding 1 was confirmed by me by running it. Findings 2 and 3 are from reading only.

## Permission gaps
Opus subagent could not run vitest or tsx (heavy.mjs timed out).

## Model
Worker Sonnet 5.5; adversarial read by an Opus subagent.
