# F01 check: FAIL
Worker cloud-329cd2 (check). Branch claude/F01 @ 7e83251. Node 24.

Passed: typecheck, lint, deps:check; db project 65 of 65 (63 acceptance + 2); test:flake 5 of 5 cold runs; canary ran; spec file unchanged since ea1e06e; mutate:changed has no targets (SQL only).

## Failures
1. `npm test` red: tools/test/db-rules.test.mjs "ARC-4 rule: no file outside src/core/db constructs PGlite" flags src/contracts/records.acceptance.db.test.ts (new PGlite()). Spec defect (builder may not edit): spec job must use createTemplate/clone from src/core/db. Because `npm test` is unit && db, the db project does not run in the cloud script until this is fixed.
2. `node tools/scope.mjs F01`: the spec file is outside the card Paths (expected; add it to the card Paths).
3. Adversarial read (Opus), real gaps against the card, none covered by a test:
   - EV-1/SEC-7: append-only triggers are row-level only; TRUNCATE bypasses them (20_ledger.sql:64, 30_books.sql:54, 50_returns.sql:28, 60_versions.sql:28-33). Needs before-truncate triggers.
   - TB-2: sources check only counts array length, so `[null]` or `[""]` passes (30_books.sql:70); one 0-cent line passes "has lines and nets to zero" (30_books.sql:73-79).
   - EV-5: source_page/source_box not required with a document pointer, and allowed with another pointer kind (20_ledger.sql:10-12,24-29).
   - FLOW-1: "latest state event" ordered by caller-settable created_at, then text id ('se-2' > 'se-10'), so a back- or future-dated event licenses a move (50_returns.sql:38-39). state_events.from_state/to_state have no CHECK to the 16 states (50_returns.sql:20-21); a return can be inserted in any state with no event.
   - EV-1: events.actor/reason have no non-blank CHECK, unlike state_events (20_ledger.sql:58,62).
   - Card says entries and judgment inputs change by new version row (FLOW-4 fingerprints id and version): adjusting_entries and judgment inputs have no version_no (30_books.sql:26-43, 112-121).
   - ARC-10: version stamp check accepts any non-empty object, e.g. {"x":null} (00_schema.sql:15, records.ts:31).
   - Minor: gifi_mappings.return_id not tied to account return_id; RLS enabled, not FORCEd (meets card as written).
4. No secrets, no table missing is_test or RLS, nothing built beyond the card. Note: test entity name "Maple Grove Dental Professional Corporation (Test)" (spec file:203) might match a real business; spec job should pick a clearly made-up name.

Rule candidates: (a) every append-only table also refuses TRUNCATE; (b) every "has a source/reason" check rejects blank and null array members; (c) every event table: non-blank actor and reason.

Permission gaps: none (Node 24 via /opt/nvm needed on PATH). Model: claude-sonnet-5-5 (adversarial read: Opus subagent).
