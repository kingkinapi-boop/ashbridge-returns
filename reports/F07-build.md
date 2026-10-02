# F07 build report (cloud-f10790, 2 Oct 2026)

Branch claude/F07. Files: src/contracts/bridge.ts; src/modules/bridge/{index,run,client-ref,year-end}.ts; db/schema/05_bridge.sql (client_refs, bridge_ops_items, client_handoff and its id/slot checks); db/schema/55_bridge_returns.sql (bridge_returns).
Acceptance: 47 of 47 pass (12 unit, 35 db). Full suite on the build: unit 1697, db 385, typecheck, lint and deps:check clean.
Scope: db/schema/55_bridge_returns.sql is outside the card's Paths (`node tools/scope.mjs F07` must be re-run after commit); the spec names it as needed (a table that points at returns.returns must sort after 50). The Lead adds it to the card's Paths.

## Amber (reverse by editing)
- A corporation with any ops item gets no return (corporation-level hold), but keeps its client_ref; a return that already exists is never removed.
- Fifth ops kind `tax_year_missing` (a T2 engagement with no tax year), so nothing is dropped silently. `unfiled_years_text` is raised when the answer is no or unsure, or any outstanding-years text exists.
- `services` null or empty is `books_source_unclear`.
- client_ref is read by join on corporation_id (no column or foreign key on bridge_returns), so client_refs stays truncate-proof.
- Hand-off table: an `assumption` item id is allowed on approval rows (contract section 4); question rows need primitive, fact and answer shape; DECIDE needs recommendation_id and reason_id; ids match `^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,79}$`; slot strings 60 characters at most; no list_version sequence guard (rows of one list share a version), only the update guard (status and sent_at move).
- Groups (FLOW-11) are recomputed from the current snapshot and keep the lowest existing group id.

## Permission gaps
None.
## Model
Sonnet 5.5 (security card, not core; the Lead runs /security-review before boarding).
