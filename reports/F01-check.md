# F01 check (round 2): FAIL

Worker cloud-63f8ba. Passed: typecheck, lint, deps:check, npm test (960 unit, 168 db), test:flake 5 of 5, scope clean, spec files untouched since 8d503f9, mutate canary 100, mutate:changed F01 100 on ids.ts and records.ts, lists match blueprint (16 states, 3 statuses, 5 origins, 5 entry types), RLS on all tables, no public tables.

Failures (Opus adversarial read, reproduced in PGlite; no existing test covers them):
1. Blank checks use btrim(x), which strips only spaces. Tab, newline, U+00A0 pass: actor/reason on events (20_ledger.sql:93-94), state_events (50_returns.sql:29-30), judgment_inputs author/reason (30_books.sql:163-164); version stamp {"x":"\t"} passes SQL (00_schema.sql:19) but zod refuses it (records.ts:34), so SQL and zod disagree (check 18); adjusting entry with reason "\t" and sources ["\t"] can be explained (30_books.sql:86,103; check 14). Same gap: holds_holder (50_returns.sql:96), approvals_approved_by (60_versions.sql:27), answers_author (70_checks.sql:30), pointer checks (20_ledger.sql:32,50-51).
2. EV-5/check 3: blank pointer ids count as real (source_client_answer_id '', source_qbo_snapshot_id ' ' with account ' '); also cra_capture, prior_return, qbo_txn ids (20_ledger.sql:29-34,53-58).
3. FLOW-1/check 16: seq is generated always as identity but INSERT ... OVERRIDING SYSTEM VALUE with seq=999 is accepted (50_returns.sql:20).
4. (weaker) A state event filed->closed was accepted while the return was at evidence (50_returns.sql:17-45).

Rule candidate: every non-blank check uses one returns.is_blank(text) stripping all whitespace ([[:space:]] and U+00A0), applied to every text column in every schema file, with a rule test that enumerates columns.
Suggested fix: is_blank used everywhere incl. is_version_stamp and sources_are_real; non-blank checks on every pointer id; BEFORE INSERT trigger on state_events forcing seq to nextval and requiring from_state = return's current state.

Permission gaps: none. Model: Sonnet 5.5 checker; Opus 5.5 adversarial read.
