# The bridge draft, for the client repo's Lead

A draft of what this system needs from the client app's database (LIVE-6). It is tested against a made-up
stand-in of the client app's tables (`__fixtures__/client-app-standin.sql`) and never applied to the client app
from this repo.

Written against client-app commit f87a0043 (`BRIDGE_CONTRACT`), last migration 34. `views.json` names the same
commit and migration, so the LIVE-6 re-check knows what the draft was written against.

## Apply order

1. GL2's live migration first (schema `returns`, its roles: `returns_app`, `client_app_reader`; role names are placeholders).
2. `0001_bridge_views.sql`: schema `bridge` and one read-only view per contract view.
3. `0002_grants.sql`: `returns_app` selects the bridge views and nothing else; the public-key roles see nothing in
   `bridge`; `client_app_reader` selects the hand-off columns of `returns.client_handoff` and only its `sent`,
   `withdrawn` and `closed` rows (a row-level security policy; a draft never leaves this system).
   `0002` revokes PUBLIC execute on every function in `returns` and grants `returns_app` nothing there, so GL2's
   migration must already grant `returns_app` execute on every function its writes call (check helpers, functions
   called in trigger bodies), or its inserts fail.

## Before and after applying

- Probe: run `probeClientSchema(db)` (src/modules/golive/bridge) on the client app's database first. It lists every
  table and column the drafts read and names each one missing (select statements on the catalog only). A missing
  column keeps the bridge on made-up data (U9).
- EXPLAIN: run the bridge queries through GL2's `explainAll` with these files as the setup. A query that fails is
  reported by id; never use ANALYZE.
- `client_app_reader` must not bypass row-level security (no `bypassrls`, never the table owner, never a
  superuser): the policy is the only thing that keeps drafts from the client app.
- A view added later in schema `bridge` needs the same revokes from `public`, `anon` and `authenticated`: a host
  default privilege may hand it to them.

## Notes

- `views.json` lists every column of every view, the client-app column each comes from and the contract cite, the
  columns a view reads only in joins and filters (`alsoReads`), and the F07 fields the live reader derives
  (`derived`). A catalog test keeps it equal to the SQL.
- `bridge.cra_access` has a `kind` column telling its three row kinds apart (`v2_confirmed`, `v1_request`,
  `program_account`).
- `bridge.document` reads one upload pointer per answer.
- Revoking execute on the functions of `returns` from PUBLIC is in `0002_grants.sql`: Postgres grants it by default.
- `bridge.t2_return` reads `flow_progress`; the contract (line 22) gives a fallback if that table is missing. The probe
  names the missing table at LIVE-6 so it is flagged, never a silent pass.
- The views run with their owner's rights (Postgres default), so `returns_app` needs no right on the base tables.
