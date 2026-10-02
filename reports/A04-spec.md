# A04 spec report (cloud-43b472, 2 Oct 2026)

Spec commit 9d97dd0 on `claude/A04`. Validated on main 3df2e9b, with `claude/F06` (89a8a7a, check PASS, not yet landed) merged into the branch by a merge commit: A04 needs F06's `src/contracts/jobs.ts` and its queue for the job-state checks. A04 cannot land before F06.

## Tests
- `src/modules/ai/runner/runner.acceptance.test.ts` (unit, 46 tests): checks 1 to 4, 5 (golden inbox, ignored outbox files), 6 (refusal through the engine), 7 to 10, 11 (handler kind and 24-hour lease), a planted-instructions document (no effect; an answer that obeys it is refused), the ARC-7 "no import of the jobs module" scan, and a planted-fault test for the vendor-name check.
- `src/pipeline/ai-exchange.acceptance.db.test.ts` (db, 5 tests): checks 5, 6 and 11 through F06's real queue and in-process runner (job stays `running` until the outbox file appears, then `done`; unknown and second outbox files ignored and logged by name only; an F04-failing result stores no output; a late result after the 24-hour lease accepted on a matching input hash, refused otherwise).
- Fixtures: `__fixtures__/jobs.json` (seven C01 finding jobs, Maple Ridge Consulting Inc. (Test)), `__fixtures__/harness.ts` (fake Claude project polling a temp exchange folder, atomic outbox writer, helpers), `__recordings__/` (7 recordings: good, broken, stray key, three incomplete stamps, planted note), `__golden__/inbox-finding-c01.json`.
- Clauses: AI-1, AI-9, AI-10, AI-11, ARC-6, ARC-16, ARC-20, ARC-22, END-8, SEC-11 (plus ARC-5 and ARC-7 where the queue and boundary are touched).
- Without the build both files fail at import (`../index`, `../modules/ai/index` missing): the right reason. typecheck and lint errors are only in these two files, from the missing module. With a throwaway stub (never committed): typecheck, lint, deps:check, unit 1736 and db 381 all green; six planted faults in the stub (no redaction check, no approved check, no is_test check, no input-hash check, content in the log, no refusal count) were each caught. gitleaks 8.28.0 finds nothing in the new files.
- Step 6b sweep: no existing test failed with the stub; none retired.

## Amber (choices the card left open; reverse by editing the spec)
- A1 Placement: the queue tests live in `src/pipeline/` (F10's composition root), because dependency-cruiser (ARC-7, run in CI) forbids a test under `src/modules/ai/` from importing `src/modules/jobs/`. The file imports only the two modules' `index.ts`, `src/core` and `src/contracts` (F10's future rule allows that) and reads fixture JSON by path, never importing module inner files.
- A2 API: `createAiRunner({ recordingsDir, approvedPath?, env?, sink?, pollMs? })` returning `engine()`, `useEngine(name)`, `runAiStep(job, { jobId? })`, `refusals(stepType)`; result `{ ok: true, output, stamp } | { ok: false, reason, problems }`; `aiEngines.{recorded,project}.run` called at call time (so spies count calls, check 3); `createAiStepHandler(stepType, runner)`; `AI_JOB_LEASE_MS`, `AI_SETTING_NAMES`, `inputHashOf`, `InboxFileSchema`, `ApprovedListSchema`. Full shape at the top of the unit test file.
- A3 The settings come from an `env` option (default `process.env`), as A05 did; the card says "through `src/core/env.ts`" but env.ts is not in A04's Paths, so no test pins env.ts.
- A4 Input hash: sha256 hex of the canonical JSON of `inputs` (keys sorted at every depth, no whitespace), so recordings and the golden can carry literal hashes.
- A5 Recording file: `{ modelId, promptHash, inputHash, output, stamp }`, one per `*.json` in the recordings folder; the stamp is the recorded one (so an incomplete stamp, check 2, is testable).
- A6 Approved list: `{ "triples": [ { stepType, promptVersion, modelId } ] }`, strict; the shipped `data/ai/approved.json` parses to `{ triples: [] }`.
- A7 Inbox file adds `jobId`, `promptHash`, `inputHash` and `ocrEngineVersion` to the card's list (A08 copies them into the stamp, A118); camelCase keys (`isTest` for the return's is_test). The golden compares the canonical form (sorted keys), so key order and spacing are free; content is fixed.
- A8 Outbox file: `{ jobId, output, stamp }`. Not one JSON object (unparseable or an array) is ignored and logged; one object that fails F04 or whose stamp input hash differs fails the job. A second result for a job already done is ignored and logged by name.
- A9 A refused AI job through F06 is a thrown error, so F06 retries it with backoff; the tests assert "not done, no result, the problems in last_error", not a specific status.
- A10 The project engine refuses a call with no job id (the inbox file is named by the F06 job id).
- A11 The SEC-11 refusal reason contains "SEC-11"; the refused-engine reason contains "AI runs only through the Claude project (decision 0008)"; a refused switch to the project names `AI_EXCHANGE_DIR`, never its value.

## Permission gaps
None.

## Model
Opus 5.5 (card is core and security).
