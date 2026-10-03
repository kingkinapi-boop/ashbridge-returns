# GL3 Client-app views and the shared table grant (a draft for the client repo)

Phase 4. Size M. Deps: F07, G01. Where: cloud (Postgres 16; core: spec read and check by Opus; security: `/security-review` before boarding).
Tags: security (the views and grants decide what this system can read of the client app's data; the never-read list stays out; nothing here is applied to the client app), core (permissions).
Paths: db/bridge/**, src/modules/golive/bridge/**
Clauses: ARC-2, LIVE-6, END-7, SEC-6
Read: blueprint 09 (ARC-2, ARC-3), 10 (LIVE-4, LIVE-6), 00 (END-7), 08 (SEC-6); `reference/onboarding-contract.md` (all of it: section 1 the views and their columns with cites, section 3 never read, section 4 the shared table, U8 and U9), `src/contracts/bridge.ts` (`BRIDGE_CONTRACT`, `BRIDGE_SHAPES`), `plan/cards/F07.md`, `plan/cards/G01.md` (ids, slots, answer shapes; no sentence), `db/schema/05_bridge.sql` (`returns.client_handoff`), `plan/cards/GL2.md` (the live migration and its roles), `reports/phase4-card-review-2026-10-03.md` (C3).
Spec commit: 9da00fbd (validated on main f9da8e52; toolchain refit validated on main 164d8d66, no spec change; 54 tests: 29 unit, 25 db)

## Goal
The client repo's own Lead gets, at LIVE-6, a tested draft of everything this system needs from the client app's database: the read-only `bridge.*` views named in the contract, the grants that let this system read those views and nothing else, and the grant that lets the client app read the shared table. It is a draft only: this build never applies it to the client app, never touches the client repo, and reads only a made-up stand-in of the client app's tables.

## Spec
- Fixtures: `db/bridge/__fixtures__/client-app-standin.sql`, a made-up stand-in of the client app's base tables with exactly the contract's columns (section 1) plus the never-read table and columns of section 3 (`restricted_data`, `people.email`, a token hash column), filled with made-up rows (names end "(Test)", `is_test` true); the build's `returns` schema; roles `returns_app`, `client_app_reader` (no BYPASSRLS), `anon`, `authenticated`; a planted default privilege granting select to `anon` in every schema; PGlite and Postgres 16.
- Classes:
  - ARC-2 views: after the stand-in and the drafts are applied, every view in `db/bridge/views.json` exists in schema `bridge`, its columns equal the file's list exactly, and every view has `is_test`. The file names each column's contract cite (for example `M0002:50`).
  - Fit with F07 (class rule over every field of `BRIDGE_SHAPES.corporation` and `BRIDGE_SHAPES.t2_return`): each field is a view column or is listed in `views.json` as derived by the live reader with its rule from the contract (for example `services` from the corporation's engagements); a field with neither fails naming it. Rows from the views for those two shapes parse with F07's strict schemas once the derived fields are added by a test helper.
  - Never read (contract section 3; catalog scan through the view dependency tables): no view uses `restricted_data` or any never-read column; planted views that join `restricted_data` and that select `people.email` each fail naming the view and the column.
  - Read-only (ARC-2): `returns_app` can select every bridge view; insert, update and delete through each view are refused (single-table views are updatable in Postgres, so the grant must not allow it); selecting any client-app base table directly is refused, for each table in the stand-in.
  - SEC-6: with the planted default privilege, `anon`, `authenticated` and PUBLIC have no usage on schema `bridge` and read nothing in it.
  - Shared table (ARC-2, END-7): `client_app_reader` can select `returns.client_handoff` and no other object in `returns` (catalog of every table, view and function: refused); it cannot insert, update or delete; a row-level security policy lets it read rows whose status is `sent`, `withdrawn` or `closed`, never `draft` (contract section 4: a draft never leaves this system; a planted draft row is never returned). The columns it can read are exactly the keys of `BridgeHandoffRowSchema`, none free text (F07's check 8 shape).
  - Contract base: `views.json` and `db/bridge/README.md` name the client-app commit and last migration equal to `BRIDGE_CONTRACT`, so the LIVE-6 re-check knows what the draft was written against.
  - Probe (U9): `probeClientSchema(db)` lists every base table and column the drafts read and names each one missing from `information_schema`; on the full stand-in it is clean; with `corporations.financial_year_end` dropped it names that column. It issues only selects on the catalog (a test records every statement).
  - Draft only: no file in `src/**` outside `src/modules/golive/bridge/` reads `db/bridge/**`, and nothing at runtime applies it (source scan).
  - END-7: the draft SQL holds no client sentence: a scan finds no string literal with a space in either file (status values and ids only), with a planted literal sentence caught by file and line.

## Build
- `db/bridge/0001_bridge_views.sql` (schema `bridge`, one view per contract view: client, corporation, t2_return, flag, answer, document, cra_access and the v1 views), `db/bridge/0002_grants.sql` (the grants and the policy above), `db/bridge/views.json` (strict), `db/bridge/README.md` (for the client repo's Lead: apply order after GL2's migration, the probe, the EXPLAIN step through GL2's `explainAll`, and that `client_app_reader` must not bypass row-level security), the stand-in fixture.
- `src/modules/golive/bridge/`: `applyDraft(db)` for tests and the go-live run, `probeClientSchema(db)`, the catalog scans. `// @mutate` on the scans (mutation 100, ARC-15).

## Check
By a third worker (Opus read): acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, the db tests on PGlite and Postgres 16, F07's tests unchanged and green, `/security-review` clean, scope clean.

## Not in this card
Applying anything to the client app's database or repo, or probing its live database (LIVE-6 and LIVE-4: live data and another repo, Zo's yes). The live bridge reader that turns view rows into F07's snapshot (go-live, with GL1's live adapters). The client app's wording and its own reader of the shared table (client repo). Whether the client app retires its overlapping tables (U8, Zo at LIVE-6).

## Also (A462)
Build: SC's R41 flags `z.string().min(1)` in `src/modules/golive/bridge/manifest.ts`: use the blank-check from `src/contracts/text.ts`. Re-run pg16 after DB16 lands.
