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

---

# A04 spec, rounds 2 and 3 (local-1, 3 Oct 2026)

Spec commit **fb82b8c** on `claude/A04` (round 2 was 439aa70; round 3 adds to it). Validated on main **b277a24** (merged into the branch at a3587ae). Round 3 answers the 7 gaps of reports/A04-spec-review-2.md and the Lead directive A410. File: `src/modules/ai/runner/runner.acceptance.test.ts` only (98 unit tests, was 75); the db test is unchanged (5 tests). Opus 5.5, by hand (local worker, no subagent tool).

## Fails first (on the round 1 build, b277a24 merged): 20 fail, 78 pass
Round 2, 10 fail first, each with its first failing assertion:
1-3. AI-11 approved list missing, malformed JSON, wrong shape: `toEqual({ ok: false, reason: 'not approved: the approved list cannot be read (AI-11)' })` gets the "run the evaluation set first" reason (fix 5).
4. ARC-16 SC R23 recording with a stray key: `res.ok` is true (RecordingSchema is `z.object`; fix 4).
5. ARC-20 env.ts reads AI_EXCHANGE_DIR: `readSettings` drops it (fix 2).
6. ARC-20 no `process.env` in the AI module: runner.ts:56 (fix 2).
7. ARC-20 setting cleared after the switch: refused, the runner re-reads the setting at run time (fix 2).
8. ARC-20 setting changed after the switch: the inbox file goes to the new folder (fix 2).
9. ARC-22 a folder named `x.json` in the outbox: not logged (the unreadable entry is skipped silently; fix 4).
10. ARC-22 no sink given: nothing reaches the core logger (default sink is a no-op; fix 4).

Round 2, 19 pass first; each kills a round 1 survivor (findings RC1): readable list without the triple (the reason literal, runner 77); recordings folder missing (engines 38); the clean twin of the stray-key test (liveness); four AI-10 stamp parts on the recorded engine (runner 104-106); own stamp runs (liveness); SEC-11 recorded engine with `isTest = false` runs (runner 81); `aiEngines.project.run` with no folder (engines 94); blank job id `'  '` (engines 93); `A.json` holding job B (engines 83); two jobs waiting (engines 72, the waiting set); second file for a done job (the `finally` delete, 127); `pollMs` default 1000 (runner 59); the log line exact (runner 127); handler versions (runner 143); the thrown message (runner 146); `inputHashOf` on nulls and arrays (schemas canonicalize).

Round 3, 24 tests (one replaces the round 2 no-folder engine test), 10 fail first:
- Gap 3, blank exchange folder at the engine, `''` and `'   '`: reason is `threw: PLANTED...` (the engine goes on to `mkdirSync`, which the test plants to throw so nothing reaches `./inbox`). The `undefined` case passes (kept from round 2).
- Gap 2, malformed recordings: `{` beside the good one, `{` alone, an empty file alone, and the handler on `{`: `JSON.parse` rejects the step (engines.ts:40). `null` alone and `[]` alone pass first (safeParse already refuses them), and so does "a notes.txt holding the good answer is never read".
- Gap 7, two recordings for one key (different answers; identical copies): `res.ok` is true (the first match wins). Passing guards: another job's duplicate key does not stop this job; the shipped recordings folder has no duplicate key.
- Gap 6, every name in `AI_SETTING_NAMES` through `readSettings`: `AI_EXCHANGE_DIR` reads as undefined.
- Survivor, a `notes.txt` in the outbox is logged once by name: not logged (the outbox loop filters `.json`; amber R3-2).
- Pass first (guards): gap 4, the four stamp parts through the project engine and the handler (the stamp check is engine-agnostic today); gap 5, a stranger outbox file logged once over many polls, not again for the same bytes, again for new content, by name only (fake timers); survivor tests: the F04 reason names AI-1, two wrong stamp parts each named apart, the handler message keeps reason and problems apart, and the shipped default approved list is read (exact "run the evaluation set first" reason, not the unreadable one).
- Dropped: `expect(LISTED_NOT_APPROVED).not.toBe(LIST_UNREADABLE)` (two constants; review round 2). Tightened: the dup test asserts each file name stands on its own.

## Mutation (`npm run mutate:changed -- A04`)
The round 1 build cannot be mutation-run with these tests: Stryker's dry run refuses any failing test, and 20 fail. So, per spec-writer step 6b, a throwaway stub (fixes 2 to 5 plus the round 3 behaviours on top of the round 1 build; never committed, files restored) passed all 98 unit tests and the 5 db tests, and was mutation-run. First run: 26 survivors, of which 6 were test gaps, now covered by the survivor tests above (dup names run together, a non-`.json` outbox file, the AI-1 reason, the stamp-part separator, the handler join, the default approved path). Second run, `--force`, on the stub: env.ts 22/22, schemas.ts 26/27, engines.ts 122/130, runner.ts 161/167, index.ts no mutants. The 15 left are equivalents of the stub's own shape, for the builder to remove by rewrite or a reasoned disable (none is a behaviour):
- engines: `existsSync ? readdir : []` to `["Stryker was here"]` (the per-file catch absorbs it); the three `catch { continue }` blocks emptied (the next safeParse refuses undefined); `'utf8'` to `''` twice (JSON.parse takes a Buffer); the `''` text key of an unreadable entry; the inbox file's trailing `'\n'`.
- runner: `catch { return 'unreadable' }` emptied; `'utf8'` to `''`; `s === undefined` in `blank` (never called with undefined); `if (x !== undefined)` before setting `jobId` and `exchangeDir` (pass them plainly, fix 3); `dir === undefined ||` before `blank(dir)`.
- schemas: `update(text, 'utf8')` to `''` (drop the argument).
**Toolchain note for the Lead:** with `incremental: true` (stryker.config.mjs), the second run reused stale "Survived" results for six static mutants (runner.ts:19-20, the default approved path) after the test that kills them changed; only `--force` re-ran them. A builder or checker seeing survivors on static lines should rerun with `--force` before writing a survivor up.

## Step 6b sweep (stub)
`npm test` with the stub: unit 2588 pass, 3 fail, all unrelated and Windows-only (design/basis RV-52 `ERR_UNSUPPORTED_ESM_URL_SCHEME` on a `c:` path; storage real-parent A05 two `symlink` EPERM); db 550 pass, including `src/pipeline/ai-exchange.acceptance.db.test.ts` 5/5 with the outbox filter dropped. No other test contradicts the spec; none retired. typecheck and `npm run lint` green. The stub ran in this worktree (files restored with `git checkout --`), not in a second worktree: a local worker cannot remove a second node_modules junction.

## Amber (round 3)
- R3-1 Duplicate recordings refuse (Lead's choice, A410), also for identical copies: the rule is about the key, so a person deletes one. The reason holds "two recordings for one key" and each file name on its own; it does not count against the step's refusal counter (not pinned either way).
- R3-2 A file in the outbox that is not `<job id>.json` and not a waiting job's file is logged once by name, whatever its extension (card: "files in outbox/ that match no running job ... are ignored and logged by name only"; tie-breaker: a flag for a person). The builder drops the `.json` filter on the outbox; the recordings folder keeps its `.json` filter (pinned by the notes.txt test there).
- R3-3 A malformed recording is skipped (fail closed: re-record if nothing else matches); it is not logged (not pinned either way).
- R3-4 Every refusal names its clause: the F04-failure reason now must name AI-1 (the other refusals already name AI-9, AI-10, AI-11, SEC-11).

## For the build
Fix list items 2 to 5 of reports/A04-findings.md, plus: the duplicate refusal, the malformed-recording skip, a blank folder at the engine refused, the outbox filter dropped, and the 15 equivalents removed. Then `mutate:changed -- A04` (with `--force` if a static line survives) at 100 on engines.ts, runner.ts, schemas.ts and env.ts, the db test on PGlite, and the fresh `/security-review`.
