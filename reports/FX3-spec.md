# FX3 spec report

Worker cloud-22d057, 3 Oct 2026. Branch claude/FX3. Spec commit 06469ba4. Validated on main b66f8428.

## What the spec does

1. Deletes every FX3-owned entry from `tools/test/__fixtures__/schema-contract/known.json`: 36 unit entries, 59 db entries (the db side is now `[]`). No rule weakened, KNOWN not widened (A329). SC's rules now fail naming FX3's files: unit R15, R16, R18, R23, R41 (`tools/test/schema-contract-rules.test.mjs`); db R12, R13, R15, R42, R43, R44, R55 (`src/contracts/schema-rules.db.test.ts`).
2. Behaviour tests beside the source scans (testing.md: a scan proves shape only):
   - `src/contracts/fx3.acceptance.test.ts` (unit): ExceptionRecordSchema status enum from an exported list, lists equal to JOB_STATUSES and the bridge handoff status (R15); one *RecordSchema per table for the 7 tables (R42); every *RecordSchema and JobSchema strict, planted stray key refused (R23); FUTURE_POINTERS exported, frozen, each value names a card in plan/slices.json, planted key absent (R43); VersionStampSchema and sourcesAreReal refuse MAX_VALUE, -MAX_VALUE, 0 (from 1e-400) and 2^53 (R55), controls pass.
   - `src/modules/gaps/bank/fx3-blank.acceptance.test.ts` (unit): label, topic, slot name made only of invisible characters are refused with the field named; the sentence lint sees past trailing invisible characters; controls (EV-1, R41).
   - `src/modules/bridge/fx3-blank.acceptance.test.ts` (unit, PGlite by createTemplate, clock pinned): outstanding_years blank by text.ts raises no unfiled-years item; planted visible text between invisible characters still raises it; controls (EV-1, END-1, R41).
   - `src/modules/jobs/fx3-order.acceptance.test.ts` (unit, PGlite by createTemplate) and its db twin `fx3-order.acceptance.db.test.ts`, fixture `__fixtures__/fx3-order.ts`: jobs written at one instant are claimed and listed dead in written order, not id order (FLOW-1, R16); JobSchema refuses a stray key on a stored job (R23).

## Failing before the build (all for the right reason)

- Unit: 86 failed, all FX3's own: fx3.acceptance 53 (no enum, no lists, no record schemas, not strict, no FUTURE_POINTERS, R55 numbers accepted); gaps fx3-blank 21 (blanks accepted, sentence not caught); bridge fx3-blank 4 (item raised); jobs fx3-order 3 (id order, stray key accepted); SC unit rules 5.
- Db (PGlite): 9 failed, 601 passed: the 7 SC db rules plus 2 fx3-order. Postgres 16.14 (TEST_DB=pg16): the same 9.
- typecheck and lint green.

## Step 6b sweep (stub worktree, removed)

A stub passing every new test made one other test fail. Rewritten in the spec commit:

- `src/contracts/records.test.ts:100`, in "ARC-10 accepts strings and numbers, refuses blanks, null, objects, arrays and an empty stamp" (line 98): `ok({ a: 0 })` became `ok({ a: 1 })`. Superseded by SC R55 (now enforced for FX3 by the KNOWN deletion): SQL and JS must agree, `1e-400` parses to 0 in JS and is not a safe stamp number in SQL, so JS must refuse 0. The test still proves a number is accepted.

## For the Lead

- **Blocker, not fixable inside FX3 (Lead decision):** two of the deleted db entries cannot pass by any FX3 build:
  - R42 `returns.client_handoff: no record schema`: `tableFor` maps FooBarRecordSchema to `foo_bars`, so it can never reach the singular `client_handoff`. Renaming the table is red (shared table the client app reads, onboarding contract section 4).
  - R43 `returns.client_handoff.fact_id: returns.facts exists, but it is not a foreign key to it`: fact_id is a catalogue key in the shared handoff, not a row pointer.
  The Lead ordered every FX3 entry deleted; both were deleted. Options: re-own those two entries to an SC rule card that teaches R42/R43 about client_handoff, or an amber exemption by a rule card. FX3's build should not touch them.
- **Builder notes:** DB16's test (`pg16.acceptance.db.test.ts:214`) requires every truncate-guarded table to also refuse update and delete per row, so the returns.returns truncate refusal needs a delete refusal too. In the bank, a blank-refusing schema without `.min(1)` changes `data/question-bank/_schema.json` (bank.test.ts drift test), which is outside Paths; `NonBlankSchema.min(1)` keeps it unchanged.

## Amber choices

- Test file names follow FX4's lowercase `fx3-*.acceptance.test.ts`.
- FUTURE_POINTERS values must name a card in plan/slices.json (stronger than SC's regex; a pointer to a non-card is useless).
- db-bound modules (queue.ts, run.ts) get unit twins booted with createTemplate, so mutation reaches them (A04, A391, A465).
- SQL-only checks (R12, R13, R44, the R15 CHECK) have no unit twin: SQL is not mutated; their TS sides are twinned.
- ai.ts R41 is not in KNOWN (already clean); no test added.

## Permission gaps

None.

## Model

Opus 5.5.
