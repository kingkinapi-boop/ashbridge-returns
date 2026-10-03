# FX3 Rule defects in landed code (found by SC)

Phase 0. Size M. Deps: SC. Where: cloud.
Tags: core (permissions and citations: schemas, append-only tables, blank rules).
Paths: db/schema/**, src/contracts/ids.ts, src/contracts/checks.ts, src/contracts/records.ts, src/contracts/jobs.ts, src/contracts/ai.ts, src/modules/gaps/index.ts, src/modules/gaps/bank/index.ts, src/modules/jobs/queue.ts, src/modules/bridge/run.ts, tools/test/__fixtures__/schema-contract/known.json
Clauses: SEC-7, EV-1, ARC-10, EV-5, FLOW-1, ARC-15
Read: `reports/SC-build.md` on claude/SC (every run), `plan/cards/SC.md`, `plan/cards/F01.md`, `plan/cards/F06.md`, `plan/cards/F07.md`, `src/contracts/text.ts` (the one blank rule, BL0).
Spec commit: 06469ba4 (validated on main b66f8428; reports/FX3-spec.md). Two deleted db entries (R42 and R43 on returns.client_handoff) cannot pass inside FX3: a Lead rule decision, see the report.

## Goal
SC's rules fail on main for defects in files owned by cards that already landed (F01, F09/F01 records, G10/G11 gaps, F05 ai.ts, F06, F07). SC lands with these listed in KNOWN (owner FX3); this card fixes each and deletes its KNOWN entry, so the rule then holds on main.

## The defects (from reports/SC-build.md)
1. F01 schema: R12 `returns.returns` refuses UPDATE and DELETE but not TRUNCATE; R15 `returns.exceptions.status` has no CHECK list; R43 `*_id` columns that point at unbuilt tables are missing from FUTURE_POINTERS; R13, R42, R44 db reasons (itemise them from the SC db run first).
2. records.ts: R15 `ExceptionRecordSchema.status` is not an enum of a list; R23 stray keys accepted at the top level in about 22 schemas (use `.strict()`), and samples missing from R23_SAMPLES.
3. gaps: R18 `gaps/index.ts` lacks `// @mutate`; R41 `gaps/bank/index.ts` uses `.trim()` and `z.string().min(1)` (use text.ts).
4. ai.ts: R41 `.trim()` and `z.string().min(1)`.
5. F06: R16 two `order by created_at, id` queries in jobs/queue.ts with no identity seq first; R23 JobSchema accepts a stray top-level key.
6. F07: R41 a `.trim()` blank rule in bridge/run.ts (go through text.ts).

## Spec
None new: SC's rules are the tests. The spec job removes one KNOWN entry per defect as this card fixes it.

## Build
Fix each defect at its source; never weaken a rule or widen KNOWN (A329). A new migration for the schema changes; no edit of a landed migration.

## Check
A checker who did neither: SC's rules all green with KNOWN empty of FX3 entries, `npm test`, the db suite, an Opus read of the schema changes.

## SC KNOWN entries (3 Oct, A407)
SC lands with exact KNOWN entries owned by this card (reports/SC-findings.md, fix list step 3). Each defect fixed here deletes its entry; never widen an entry or weaken a rule (A329).
