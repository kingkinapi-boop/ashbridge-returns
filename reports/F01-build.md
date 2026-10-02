# F01 build round 2 (cloud-d42547, 2 Oct)

Branch `claude/F01`; head: the commit that adds this file. Spec unchanged (records.acceptance.db.test.ts diff vs spec commit empty).
Files: db/schema 00, 20, 30, 50, 60, 70; src/contracts ids.ts, records.ts, index.ts, records.test.ts.
Numbers: typecheck, lint, deps:check clean; scope OK (20 files); `npm test` unit 960 and db 168 pass (acceptance 166 of 166); `test:flake` 5 of 5; `mutate:changed -- F01` ids.ts 100, records.ts 100 (index.ts re-exports only).
Built: before-truncate triggers on 9 tables; blank checks (events, state_events, judgment_inputs, approvals, holds, answers); member-wise sources check, 2+ lines and a non-zero line; stricter stamp (SQL and zod); pointer columns and CHECKs; source_box CHECK reusing F09 BoxSchema; version_no on entries and judgment inputs; column guards on facts (status only) and entries (explained only); judgment_inputs append-only; state_events.seq identity, returns.current_state_event_id set by the move, insert at intake only, state CHECKs.
Ambers: (1) truncate and DELETE also refused on facts and adjusting_entries (R12: every table that refuses delete refuses truncate); revert by dropping those two triggers. (2) approvals.approved_by, holds.holder, answers.author non-blank too (R13). (3) a licence is the earliest event after the last licence for that exact from/to (reverse: pick latest). (4) idKind collapsed into one shared `id` base in ids.ts with a Stryker disable on `.brand()` (type-only). (5) `// @mutate` added to index.ts (tool demands it on every file in Paths).
Not done: none. Permission gaps: none. Model: Sonnet 5.5, no subagents.
Later cards: facts/entries column guards must stay in L00 changeFact and B05.
