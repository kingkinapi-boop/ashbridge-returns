# SC3 spec report (patch A452, Opus, 3 Oct)

Spec commit d69c50b1 on claude/SC3, validated on main 46ab96ea (merged): typecheck and lint clean; `npm test` unit 2635 pass, db 565 pass. The build needs nothing: every test passes now, live mismatches are KNOWN entries.

Tests: tools/test/security-rules.test.mjs 36 (unit; R62, strict tags, create* inventory, LANDING, KNOWN shape, and unit twins of R63 to R66) and src/contracts/security-rules.db.test.ts 20 (db). Rule functions and reviewed lists live in tools/test/__fixtures__/security-rules/harness.ts, imported by both. Clauses SEC-11, ARC-6, ARC-20, FLOW-1, ARC-15.

All 10 findings items are in. Each new plant failed on the old rule first (a scratch run, not committed). Old R66: missed the other-guard table, the two-column neighbour, `!~`, `NOT (~)`, the domain, domain[], varchar[] and char(n), and falsely flagged an is_handoff_id column. Old R62: missed the destructured, template and concatenated reads, and never tried ''. Old tags: read `* @limit bare` as a tag and silently skipped the rest. Old walker: did not read .mts or .js files. There was no inventory before.

Append-only set on main (15): adjusting_entries, approvals, bridge_ops_items, client_handoff, client_refs, entry_lines, events, facts, gifi_mappings, jobs, judgment_inputs, sign_in_events, state_events, version_cells, versions. holds and staff_sessions are not in it.

freeTextColumns on main gives 36 columns. 22 are on FREE_TEXT. 14 are KNOWN: L00 has 7 facts columns, B05 has 2, FX17 has 5 (fix file db/schema/94_actor_keys.sql). The output matched the findings' prediction exactly.

Retired: none (only SC3's own tests rewritten).

Amber:
- The shared harness is a .ts file in the fixtures folder, because only that folder is in Paths. SC7 and SC9 can move it to tools/test/lib.
- The tests read schema files through harness readSchema, as db-rules does, to keep ARC-4 R4.
- A CHECK vouches for a column only through its operand or a format-function argument, even on a single-column CHECK. LIKE (`~~`) does not count.
- A format function counts if it calls a listed one (handoff_ids_ok calls is_handoff_id).
- Append-only also needs the pair of guards. A guard function on a table without the pair is named by the sentinel check.

For the Lead:
- L00, B05 and FX17 must delete their KNOWN entries in harness.ts when they land. That file is outside their Paths, so add it to their spec Paths or card lines.
- Kept on FREE_TEXT, but they could be listed or formatted: approvals.fingerprint (sha256), sign_in_events.reason (fixed sentences; 15_auth.sql has no open owner) and events.record_table.
- Item 10's SC9 move list is card text, so it is not edited here.
