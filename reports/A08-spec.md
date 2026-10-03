# A08 spec (round 2 patch: A420, A426)

Spec-writer, cloud worker cloud-42f06c, 3 Oct 2026. Patch on the first spec (d2173aa, validated on main 7b5d6c9).

## Code base

The branch merges `origin/claude/A04` (round 4 build, b1bd533d) because checks 5 and 11 need A04's runner, `InboxFileSchema` and `OutboxFileSchema`. Validated on main 6f3ce664 (merged after the spec commit; no code changed on main since c98b7541, where the full suite was run).

## Tests: 84 (82 unit, 2 db); was 71

- `src/modules/ai/project/project.acceptance.test.ts`: 82 tests (was 69).
- `src/pipeline/ai-project.acceptance.db.test.ts`: 2 tests (check 11, through F06's queue).

## What changed in this round

| Change | Why |
|---|---|
| `stampFromJob` in the harness builds the expected stamp from `Object.keys(versionStampSchema.shape)`; the hand-listed `stampOf` is gone, in both files | A426: contract tables derive from the contract's shape |
| New: the clean stamp parses with `versionStampSchema`, its keys are exactly the shape's keys, no `ordersVersion` and the orders hash appears nowhere in the outbox file | card step 4 and check 5 (A426) |
| New: one test per stamp part (`test.each(Object.keys(versionStampSchema.shape))`, 7 rows): a planted value in the job (or new inputs for `inputHash`) must reach the outbox stamp | AI-10, A426 (no part copied from a constant) |
| Replaced: the per-job `stamp.json` test (the old amber) by "the run log carries the orders version" (a `sink` line holds sha256 of ORDERS.md bytes then settings.json bytes); `npm run ai:once` prints it too, even on a run where every job is refused | card step 4 and check 5 now put the orders version in the run log |
| New: A420, an `fs.watch` on `outbox/` during a full run sees only `<job id>.json` names (sentinel: it must see the clean and unredacted results), plus a rule test that a temp file written in `outbox/` and renamed is caught | Lead note A420 |
| New unit twin of check 11 (A391, step 4b): A04's `createAiRunner` with the `project` engine and the launcher on one temp folder, no database: the clean job comes back `{ ok: true, output, stamp }` with the full F04 stamp (so A04's runner accepts it); the unredacted job is refused by A04 with "inputs not redacted", no inbox file, no call | check 5 ("A04's runner accepts it"), check 11 |
| New fixture test: every inbox fixture but `c01-unredacted` parses with A04's `InboxFileSchema`, its `schema` equals `z.toJSONSchema(aiStepSchemas.finding)` today and its `inputHash` matches its inputs | the fixtures had a stale JSON Schema (from before NonBlankSchema); all 13 regenerated |

## Clauses

| Clause | Tests (by name prefix) |
|---|---|
| ARC-22 | one pass, golden files, call order, before-and-after listings, A420 outbox watch, skip existing, second run, CLI, approved triple, A04 twin, decision 0010 refusals, late job, timer grep, package.json, RUNNING.md |
| AI-1 | golden run, not-JSON, schema-breaking (F04's problems), four never-repaired forms |
| AI-4, AI-5, AI-6, AI-7, AI-8 | ORDERS.md headings and no tax rule (with planted faults); settings allow Read only (with planted faults); the call's flags, folder and fresh folder; planted instruction only inside the data wrapper |
| AI-9, SEC-5 | no stamp, blank stamp, planted SIN (three spellings, in a field), no false alarm on a failed check digit, date of birth (text and key), bank account shape |
| AI-10 | stamp parts from the shape, versionStampSchema parse, per-part table, model id the CLI reports, a different or missing model id refused, orders version in the run log |
| SEC-10 | `../escape`, slash, backslash, drive letter, absolute path |
| SEC-11 | `is_test` false, `is_test` missing |
| ARC-6, ARC-20, END-8 | off without or with a blank `AI_EXCHANGE_DIR` (API and CLI), runs against the fake, three key settings refused by name only (API and CLI), exchange folder inside the repo refused |

## Fails first

All 84 fail now, for the right reason: `src/modules/ai/project/index.ts` does not exist, so both files fail at import (`Cannot find module './index'`). `npm run typecheck` shows only those two TS2307 lines; `npm run lint` shows only the three `no-unsafe-call`/`no-unsafe-return` errors those missing imports cause. The rest of the suite is green on this branch: unit 116 of 117 files (2725 tests), db 10 of 11 files (550 tests), the one failing file in each being A08's.

## Step 6b sweep

A throwaway stub (launcher, ORDERS.md, settings.json, RUNNING.md, an `ai:once` script with a small resolve hook) passed all 82 unit tests; the whole suite then ran green (unit 117 files, 2807 tests; db 11 files, 552 tests). No other test failed: none retired. Planted faults against the stub were each caught: a temp file in `outbox/` (A420 test), `ordersVersion` in the stamp (stamp tests, golden, A04 twin), one part hard-coded (that part's row), no orders-version log line (run-log and CLI tests). The stub worktree is removed; nothing of it was committed.

## Mutation notes for the build

- The per-part table and the A420 watch target the two likeliest survivors: a stamp part copied from a constant, and a temp file written inside `outbox/`.
- The A04 twin waits at most 10 s for A04 to accept the outbox file, so a bad stamp fails by name ("A04's runner never accepted the launcher's outbox file") rather than by the test timeout.

## For the Lead

- Finding (not a Paths gap for this card's checks): A04's `OutboxFileSchema` is `{ jobId, output, stamp }` strict, so A04 ignores the launcher's refusal file `{ jobId, refusal }` and keeps the job running until its 24-hour lease ends. The card says the refusal is written "so A04 fails the job with that reason instead of waiting"; that needs A04 (or a follow-up card) to read the refusal shape. No test here asserts it, since it needs product edits outside A08's Paths (A414). Check 11's unredacted case passes because A04 refuses that job itself before writing the inbox.
- Amber: the orders version is logged at the start of every run (a run where every job is refused still names it), as one run-log line; the test asks only that some `sink` line, and the CLI output, hold the 64-character hex.
- Amber kept from round 1: the refusal shape `{ jobId, refusal: { reason, problems } }`; the `<data ...>` wrapper with `<` escaped; the reason texts in the EXPECTED table.
- Files the spec owns: the two test files, `__fixtures__/` (fake-claude.mjs, harness.ts, 13 inbox jobs) and `__golden__/` (2 outbox files, unchanged this round).
