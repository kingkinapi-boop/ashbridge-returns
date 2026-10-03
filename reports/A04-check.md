# A04 check, round 3 (local-3, Opus, 3 Oct 2026)

**FAIL** on claude/A04 at ee1e5bfb (spec 6fa39bb1, build by cloud-88d9d7). One finding, from the adversarial read; every mechanical step passed.

## Finding
- **AI-10, card Build "the stamp ... OCR engine and version and mapping release as the caller gives them".** `src/modules/ai/runner/runner.ts:101-110` compares only `modelId`, `promptVersion`, `promptHash` and `inputHash` of the answer's stamp with the job. An answer (a recording, or a project outbox result) stamped with another `ocrEngine`, `ocrEngineVersion` or `mappingRelease` passes F04 (the stamp is complete) and is returned and stored with the answer's values, not the caller's: the output records an OCR engine and mapping release that did not produce its inputs, with no flag. Shown by reading: `wrong` iterates the four keys of `expected` only; `validateAiOutput` takes no job. Fix: add the job's three values to `expected` (the recordings and fixtures already carry matching values, so no spec file changes). Spec gap: the round 3 table `PARTS` (runner.acceptance.test.ts:1285) has 4 parts; it needs the other 3, through both engines and the handler.
- Rule candidate: every field of `versionStampSchema` that the job carries is compared with the answer's stamp, by a table over the schema's keys (never a hand list), so a field added to the stamp later is checked by default.

## Passed
- typecheck, lint, deps:check (205 modules, no violations).
- Tests: unit `src/modules/ai src/core` 212 of 212 (runner acceptance 106 of 106); db `src/pipeline/ai-exchange.acceptance.db.test.ts` 5 of 5; rule tests (tools db/shell/toolchain rules 44, src/contracts plus auth and ocr rules 1342) all pass. Every acceptance check 1 to 11 has passing tests named with its clause.
- Spec files untouched: `git diff 6fa39bb1 HEAD` over every file of the six `spec(A04)` commits is empty.
- `node tools/scope.mjs A04`: SCOPE OK, 23 files.
- Mutation (laptop, full run, no incremental file): canary exit 0; `npm run mutate:changed -- A04` 100 on env.ts (21 killed, 1 timeout), engines.ts (151, 2), runner.ts (148, 1), schemas.ts (27); no survivor.
- Security read (no `/security-review` tool on a local worker; done by hand): no key, no vendor SDK, AI-9 gate before any engine, SEC-11 gate before any inbox write, the exchange folder read once at switch-on, outbox files logged by name only, job ids come from the jobs table (no path from user input). No finding at medium or above besides the AI-10 one.
- Not run here (cloud only): the full `npm test`, Postgres 16, e2e (A04 has no screens).
