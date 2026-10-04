# A04 findings review (round 3; check FAIL at ee1e5bfb, one finding)

Inputs: reports/A04-check.md (round 3), card A04 (main), runner.ts, schemas.ts, engines.ts, runner.acceptance.test.ts, src/contracts/ai.ts, ai-exchange.acceptance.db.test.ts, cards A08, I00, I40, ocr/recorded (main). Round 1 review: git show 6a7d6c6b:reports/A04-findings.md. Nothing here is red.

## Root cause
**RC1. The stamp compare lists its parts by hand instead of deriving them from the stamp contract, and the spec copied the runner's list.** runner.ts:101-110 builds `expected` from 4 keys and `wrong` iterates only those, so `ocrEngine`, `ocrEngineVersion`, `mappingRelease` from the answer are stored unchecked (AI-10, card "as the caller gives them"). The spec's `PARTS` (runner.acceptance.test.ts:746 and 1285) has the same 4. Mutation cannot find it (a missing compare has no code to mutate); two spec reviews read the list, not the contract. Where else it bites:
- **A08 (carded, not spec'd):** Build step 4 and check 5 list the stamp by hand too: they omit `ocrEngineVersion` and add an "orders version" that `versionStampSchema` (strict, 7 keys) refuses. As written, A08's clean result fails F04 in A04's runner and A08 check 11 (the joint run) cannot pass.
- **I40 (carded):** Build line 17 compares "model id or prompt version" by hand; it should rely on A04's refusal, not a second partial list.
- **I00, E01, A02 and every AI step card's `__recordings__/`:** once the fix lands, a recording whose OCR or mapping parts differ from its job is refused; their spec writers must copy those parts from the job.
- **A03 ocr/recorded/index.ts (main, low):** `load` never compares `rec.result.engine` with `rec.sourceEngine`; the output takes `sourceEngine`, so two provenance fields in one file may disagree unflagged.
- Checked, no fault: engines.ts:97 (the recorded key is ARC-16's three parts by design); jobs/runner.ts:35 stores handler versions on the job row while the AI stamp travels in the result (as the card says).

## Fix list (round 4, in order)
1. Lead (amber): run this as a narrow patch round, not a park or split. The defect is ~6 lines in the runner's core compare; splitting the exchange engine off does not touch it, and parking blocks A08, I00, I40, E01, A02.
2. Spec patch (Opus, `runner.acceptance.test.ts` only): replace both hand `PARTS` tables with one derived from `Object.keys(versionStampSchema.shape)` (tests below). Assert the named parts as an exact set parsed from the refusal, never by regex: `/ocr ?engine/` also matches `ocrEngineVersion`, so the "no other part" assertion would misfire.
3. Build (runner.ts only): `const expected: VersionStamp = { ...7 parts, inputHash: inputHashOf(job.inputs), others from job }` (typed as the full stamp, so a part added to F04 later fails typecheck until the job carries it); `wrong` iterates `Object.keys(versionStampSchema.shape)`; export `STAMP_PARTS_FROM_JOB` (all 7) and `STAMP_PARTS_FROM_ANSWER` (empty) for the tests. Reason wording unchanged. No fixture changes: all 7 jobs and 7 recordings and the db test carry `ocr-stand-in`, `0.0.0-test`, `mapping-2026.10-test`.
4. Lead, card A08 before its spec (amber): stamp = exactly F04's 7 parts, `ocrEngine`, `ocrEngineVersion`, `mappingRelease` copied from the inbox file (A118); the orders version goes to the launcher's run log, not the stamp (smaller, reversible). If it must ride in the stamp, A08 adds it to `src/contracts/ai.ts` and to `STAMP_PARTS_FROM_ANSWER`, and every recording gains it.
5. Lead, card I40: "an output whose stamp differs from the job is refused by A04 (AI-10)"; drop its own partial list.
6. Lead, spec-writer.md and checker.md: a test table over a contract's fields is derived from the contract's shape; the checker's adversarial read compares every compare-list with its schema.

## Tests to add
**A04 acceptance (spec job):** for every key K of `versionStampSchema.shape`, a F04-valid answer whose stamp differs from the job only at K is refused naming exactly {K} (no value printed), through the recorded engine, the project engine and the handler (21 cases; today 9 fail: 3 parts x 3 paths). Meta: `STAMP_PARTS_FROM_JOB` plus `STAMP_PARTS_FROM_ANSWER` equal the shape's keys exactly and are disjoint (planted: a table missing `mappingRelease` fails). Liveness: the own-stamp answer still runs; two differing OCR parts are both named.
**Rule tests for everywhere (SC card, next free R numbers):**
- R74: every `src/**/__recordings__/*.json` with a `stamp` that parses with `versionStampSchema` and matches a job fixture by key agrees with that job on every part in `STAMP_PARTS_FROM_JOB`, unless its file name is on that folder's planted-mismatch list. Planted: a copy of finding-c01-good with `ocrEngine: "other-ocr"`.
- R75: a recording that carries two provenance fields for one fact (OCR `sourceEngine` and `result.engine`) agrees on both. Planted: a C01 OCR recording with a different `result.engine.version`. Known owner: A03 code (FX card; never patched here).

## Risks and re-test
- The derived loop changes runner.ts, a `@mutate` file: rerun `mutate:changed -- A04`, 100 on runner.ts; the meta test kills a mutant that empties the key list.
- Typing `expected` as `VersionStamp` couples runner.ts to F04: a future stamp part breaks A04's typecheck by design (the point), so the card adding it owns the runner line.
- Late results (check 11, db test) and the golden inbox are unaffected (same values; inbox untouched); rerun `ai-exchange.acceptance.db.test.ts` and the golden.
- Re-run: A04 unit (106 plus new), db 5, typecheck, scope, mutation, then the fresh security review (card is `security`).
