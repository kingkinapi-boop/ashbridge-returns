# GL3 Opus read and security review (round 4, A515 close)

Read 3 Oct 2026, branch claude/GL3 tip 991b5dc, read-only (git show/diff only). Scope: `git diff 03e933e..HEAD -- db src`
(16 files), db/bridge/**, src/modules/golive/bridge/**, against ARC-2, LIVE-6, END-7, SEC-6 and reference/onboarding-contract.md.

## Verdict: PASS (no medium or higher; five lows, none in this card's build to fix)

## A515 round

- 43d4276 (spec): one line, reach.acceptance.test.ts:54, cast to `{ markerIds?: readonly string[] }` alone; assertions unchanged.
- 991b5dc (build): only db.ts (+2), index.ts (+1), manifest.ts (+2) in Paths, plus reports/GL3-build.md. `git diff 87582cc HEAD`
  over Paths shows nothing else.
- db.ts:1-2 and manifest.ts:1-2 match the directive text word for word; index.ts:1 is `// @mutate` only. Tests named in the
  reasons exist: reach.acceptance.db.test.ts S3 (line 298), S4 (362), G1 (448); draft.acceptance.db.test.ts;
  draft.acceptance.test.ts:90 pins `readViewsManifest()` to the spec manifest whole.

## Lists compared

- NEVER_READ (scan.ts:25-46): table restricted_data plus the 15 pairs of contract section 3, exactly; markerIds the five ids of
  contract line 70. The same five ids are written in 0001 lines 52 and 68; all three agree.
- views.json vs 0001: every view, column and source agrees (client both union branches; corporation; t2_return with
  flow_progress; flag joins in alsoReads; answer_verbatim with question_asked as second source (B1); document alsoReads gains
  question_asked (B2); cra_access three branches; nine v1 views). Null cites only on uncited key columns (v1 corporation_id,
  intakes.id), as the schema allows. Contract commit f87a0043 and migration 34 equal in views.json and README.
- 0002 grant columns (20) equal the keys of BridgeHandoffRowSchema and the columns of returns.client_handoff less created_at.
- No view reads a section 3 table or column; intakes is read for quote_reference and latest_event only.

## Clause checks

- ARC-2 read-only: returns_app gets usage on bridge and select on its views only; no base table, no write, nothing in returns.
- SEC-6: 0001 revokes from public, anon, authenticated right after create schema and on every view at its end; 0002 repeats for
  tables, functions, sequences; applyDraft runs both in one transaction.
- security_barrier on all 16 views; the three union views (client, document, cra_access) are wrapped in a subquery.
- Marker mask (bridge.answer lines 51-54): by question id before ':' or a value starting restricted-provided; null stays null;
  bridge.document skips the same rows. Superseded rows masked too (no status filter on bridge.answer).
- END-7: policy `status in ('sent','withdrawn','closed') and sent_at is not null`, select to client_app_reader only; column grant,
  no write grant; README says client_app_reader never bypasses RLS and is never the owner. No string literal with a space in
  either SQL file; no client sentence anywhere in the diff.
- Fixtures: names end "(Test)", BN 100000001 fails the Luhn check, marker digits `4821` (4 digits), canaries only; no real-looking
  SIN, BN or person.
- Nothing built beyond the card: probeReach and reachDiff are B5; findSentenceLiterals, draftReads, missingColumns are the spec's
  scans. No file in src outside the module reads db/bridge.

## Security review (TS and SQL)

- probeReach: role passed as a bind parameter ($1::name); every query a catalog select; no string-built SQL from input.
- manifest.ts / db.ts read fixed repo paths only; no input-derived path.
- No secret, key or env read. No runtime caller.

## Lows (no fix in this card; owners as noted)

1. db.ts:121-135 viewDependencies follows only direct pg_rewrite to pg_class rows outside bridge: a view reading through a view
   in another schema, or through a function (pg_proc dependency), hides a restricted_data read from the scan. The canary sweep
   (S2) covers values on the stand-in. Owner: a later rule test (CQ tooling) if wanted.
2. 0001:52,68 the mask needs the exact id before ':' (case and spacing as the client app writes it, contract line 32); a marker
   answer with question_asked null or written another way and a value not starting restricted-provided would read as its value.
   The contract fixes the form, so no defect today; worth a line in the LIVE-6 re-check.
3. Stand-in plants the default privileges after the build's returns schema exists, so the live order (GL2 creating
   returns.client_handoff under a host default privilege that grants anon and authenticated select) is not exercised; the draft
   revokes nothing on returns from anon or authenticated, leaving RLS (no policy for them) as the only wall. This is A498 L2's
   table half, owned by G00.
4. db.ts:159-198 probeReach leaves out database rights (connect, create, temp), types and domains, foreign servers, languages
   and large objects. Database rights are set aside by S3; the rest are info at LIVE-6.
5. Marker ids hand-written three times (0001 twice, scan.ts once); they agree and the tests pin them, but a change needs all three.
