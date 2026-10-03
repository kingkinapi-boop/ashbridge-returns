# A08 spec (round 3 patch: A446, A469, A498)

Spec-writer (Opus), 3 Oct 2026. Patch on the round 2 spec (84 tests). Validated on main f73707b8 (merged into claude/A08 at 4d774d56; A04 round 5c is on main).

## Tests: 121 (118 unit, 3 db); was 84

- `src/modules/ai/project/project.acceptance.test.ts`: 84 (was 82).
- `src/modules/ai/project/exchange-safety.acceptance.test.ts`: 34, new.
- `src/pipeline/ai-project.acceptance.db.test.ts`: 3 (was 2).

## What changed

| Change | Why |
|---|---|
| Every refusal must parse with A04's `OutboxRefusalSchema` (stage included) and name its file's own id; the EXPECTED table gains a stage per fixture (input: before the call; run: model id missing or different, timeout; output: not JSON, schema); the golden unredacted refusal gains `"stage": "input"` | A446: A08 adds `stage`; A04 reads the refusal |
| Answers parse with A04's `OutboxFileSchema`; the `dotdot-escape` exception is gone: its refusal's jobId is the file name's | A446, fix 9: the file name's id is used |
| Unit twin gains two tests: the planted-SIN job fails in A04 at once with "the Claude project refused the job: ...AI-9", not counted; the not-JSON answer fails with the launcher's problems, counted once | A04 now reads the refusal file (the round 2 finding is closed) |
| db check 11 gains the planted-SIN job ending failed in Returns without waiting for the lease | same, through F06 |
| `now` pinned on every `createAiRunner` the tests make (unit twin and db) | A469, reports/A04-findings-6.md |
| New file: id grammar from `AiJobIdSchema` (bad stems never used; a 24-hex id answered; a different content jobId refused), inbox entries that are not regular files (symlink, FIFO, folder) never opened and refused "not a file", every file made under the exchange folder created exclusively (pass-through spies), `CLAUDE_TIMEOUT_MS` and `claudeTimeoutMs` (a hung call stopped by its own PID, a decoy of the same program left running), A498 (E03-marked sin and birth_date facts in three forms, text after `restricted-provided`), a source rule (node:fs by its default import only; no pkill, killall or taskkill) | A446 and fix 9 (R96); A498 |
| The planted SIN is built in harness.ts from its three groups and filled into the fixture's slot at load time | SC rule R34 (on main) refuses a check-digit-valid nine-digit number in any test-data file; the jobs the tests see are unchanged |
| fake-claude.mjs logs its `pid` and can hang (`hangMs`) | the timeout test |

## Fails first

All 121 fail at import: `src/modules/ai/project/index.ts` does not exist. Typecheck: only those three TS2307 lines; lint: only the four unsafe-call errors the missing module causes. The rest is green on the branch: unit 135 of 137 files (3175 tests), db 14 of 15 files (PGlite).

## Step 6b sweep

A throwaway stub passed all 121 (three runs of the unit files, no stray process); with it the whole suite was green except rule failures in the stub's own text (R18 @mutate, R28 a `\d{3}` group, R41 `.trim()`), fixed in the stub, after which tools/test was green: unit 137 files, db 15 files on PGlite and on Postgres 16 (TEST_DB=pg16, 670 passed). No test retired. Planted faults each caught: writes without `wx`, no content-id check, `readFileSync` on the inbox, no field-named fact check, the timeout option ignored. The stub worktree is removed.

## Amber choices (for AMBER.md)

- Stage of a missing or different model id: `run` (an AI-10 stamp fault, not an AI-1 output fault; A04 counts only `output`).
- Every file the launcher makes under the exchange folder is created exclusively, not only the temp files (the per-job input copy included): a fresh folder costs nothing to write with `wx`.
- The timeout is `runAiProjectOnce`'s `claudeTimeoutMs` (default exported `CLAUDE_TIMEOUT_MS`, below A04's wait); its reason names the time limit, stage `run`.
- A498: the launcher refuses (never masks) a job carrying a marked fact as `{ key, value }`, `{ factKey, value }` or a field named by the key, or any text after `restricted-provided`; a bare `restricted-provided` is not tested.
- A stem outside `AiJobIdSchema` gets no outbox file and no log requirement; the inbox size cap is the builder's (untested).
- Builder notes: write the time limit as one number (`15 * 60 * 1000` matches the timer rule's cron pattern); a SIN scan written with `(\d{3})` groups trips SC R28.

Files the spec owns: the three test files, `__fixtures__/` (fake-claude.mjs, harness.ts, 13 inbox jobs) and `__golden__/` (2 outbox files).
