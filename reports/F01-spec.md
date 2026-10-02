# F01 spec: reported
Worker cloud-vm (spec by an Opus spec-writer subagent, core card). Branch claude/F01 (based on claude/F00), spec commit ea1e06e.
63 tests in src/contracts/records.acceptance.db.test.ts covering checks 1 to 12 (EV-1, SEC-7, TB-2 with a fast-check property, EV-5, EV-10, EV-8, TB-3, SEC-6, ARC-2, ARC-3, ARC-10, FLOW-1). 62 fail now (no schema or contracts); ARC-2 passes (standing rule). Validated against a throwaway reference schema: 63 pass, 7 planted faults caught.
Ambers: table and column names fixed by the tests (snake_case, text ids, source_* pointer columns, version_stamp jsonb, signed amount_cents, gifi_mappings table); state changes need a state_events row; append-only errors say "append-only"; no-grants role accepts permission denied or zero rows.
Note: the F00 PGlite cold-start flake will hit these per-test clones.
Permission gaps: none. Model: claude-sonnet-5-5 (spec by Opus subagent).
