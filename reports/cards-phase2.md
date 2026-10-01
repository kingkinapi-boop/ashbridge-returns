# Phase 2 cards

2 Oct 2026. Helper drafting cards for the Lead. Branch `claude/cards-phase2`. Read: CLAUDE.md, `.claude/rules/testing.md`, `.claude/rules/code.md`, `.claude/rules/staff-screens.md` (head), `blueprint/README.md`, blueprint 02, 03, 04, 06, 07, 09, `reference/taxprep/FINDINGS.md` (interim), `FEATURES.md`, `cell-map-status.md`, `2026-10-03-day3/notes.md` and `diagnostics-probe.md`, decisions 0008 to 0015, `plan/AMBER.md` (A143 to A202), the cards F03, S00 to S03, B01, F10, SK0, L00, E00, V05, V14, F01 (schema files), the schedule and journey families, `reports/cards-phase1a.md`, `reports/review-phase1.md`.

## Cards

| Card | Size | Tags | Deps | One line |
|---|---|---|---|---|
| M00 | L (was M), hard | core | F03, S02, S03, F10, B01 | Mapping format (gifi, fact, taxChoice, never), GIFI rows read from Taxprep's descriptions, copy lookup by natural key, whole-dollar rounding with the Schedule 100 plug, drift check, roll-forward map and tax-choice cells as data; replaces the skeleton's mapping stub. |
| T02 | M, hard | core, security | M00, SK0, A05, F02, S01 | Export reader: write-once, F03 parse, identity (BN, year end, GUID), filter completeness, staleness by token or by content, byte equality, identifiers outside the release; creates `src/contracts/roundtrip.ts`, `src/modules/roundtrip/index.ts`, `db/schema/45_roundtrip.sql`. |
| T01 | L, hard | core | M00, T02, B05, B01, L00, F07, A05, SK0, F10 | Figures from GIFI totals and verified facts; the AI draft and changed-cell re-imports; clears only through `clearCell` with person and reason; held-back repeating rows; token; file names and import versions; replaces the figure and import stubs. |
| T04 | L, hard | core | T01, T02, M00, L00, F10 | The six classes in a fixed order, keyed by natural row; tax choices and allowed typing as orphans; roll-forward facts; "changed outside the trace"; replaces the trace stub. |
| T12 (new, split from T04) | M, hard | core | T04, T05, N00, L00, L01, F02 | The cite, candidate sources (none pre-selected), override and dropped reasons, carry-over to the next lock export, `blockers` and `signOff` (saves the preparer version, moves trace to respond). |
| T07 | M (was S) | core | T02, M00, E00, W20, A05 | Review lines by meaning from the lock export (data file per release); the printed return stored, read through intake and identity-checked; the test-world printed return maker. |
| T05 | M (was S) | core | E00, T07, F02 | Diagnostics parsed from the printed return, keyed by code and cell, rules by iFirm severity, reasons for warnings, unknown means Error, no diagnostics page is a blocker, a paste fallback. |
| N00 | M | none | T04, T01, L00, F01 | The six version kinds; saves `ai-raw-facts` and `ai-draft` after import 1 and `preparer` at sign-off; owners per cell; `cellsByKey` by figure and natural row (LL-3). |
| V06 | L (was M) | screens, security | V05, D05, U01, U02, B01, T01, T02, T04, T05, T07, T12, F02 | The round-trip checklist: .GFI upload, download, Taxprep steps, the two uploads with server-side checks, diagnostics reasons, links to the cite list, sign-off; waits for D05's approval. |
| V12 | M | screens | V05, V01, D12, U01, U02, T04, T12 | The cite button beside every orphan and tax choice, plus override and dropped reasons, candidates opening in the source viewer; waits for D12's approval. |

No card is above L. Order the queue will follow: M00, T02, then T01 and T07 (both touch `src/modules/roundtrip/index.ts`, so one after the other), T04, T05, N00, T12, then V12 and V06. Every one of them waits on S03, which waits on FINDINGS.md "Status: final" (A78), so phase 2 specs start about 16 Oct unless the Lead lifts that for M00.

After the update: `node tools/status.mjs` shows carded 244, to write 28, parked 13, done 2 of 287. `node tools/matrix.mjs --plan` gives PLAN OK (`plan/MATRIX.md` was generated and not committed). `node tools/next.mjs 12`: next cards to write T08 Q00 Q01 I01 I30 I40.

## Proposed ambers (what; why; reverse)

1. T04 split into T04 (classes) and T12 (resolutions and the sign-off gate). Why: classes, roll-forward, outside-trace diffs, cites, reasons and the gate together pass L. Reverse: merge back into one card.
2. M00 is L and depends on B01 (`data/gifi/codes.json` for CRA-calculated totals and the balance-sheet sides). Why: the rounding plug and the TB-12 refusal need them. Reverse: pass the code list in and drop the dep.
3. Mapping rows have four sources: `gifi`, `fact` (verified only), `taxChoice` (never imported, always cited) and `never` (RT-13 cells). A `taxChoice` row may sit on the calculated list. Why: day 3 showed CCA claimed defaults to a computed maximum and becomes an override when typed, so a typed choice could otherwise class as calculated and escape the cite (TB-6). Reverse: three sources and a separate tax-choice file only.
4. `data/taxprep/map/gifi.json` is generated from the trial release's descriptions (`GIFI code <n> - Amount - ...`) and committed with a regeneration test; Account and Prior year cells are never mapped. Why: RT-21 says the code table is read from the export, not typed. Reverse: typed rows in M11 and M12.
5. Rounding plug: GIFI 3600, else the liability or equity code with the largest absolute amount, ties to the lower code; a plug larger than one dollar per balance-sheet code is refused as "not a rounding difference". Why: RT-25 names the line but not the tie or a limit; a big plug would hide an unbalanced trial balance. Reverse: no limit, other tie-break.
6. Roll-forward map rows carry this year's cell, last year's cell and the prior-year fact key B03 registers; the trial release's file is empty and unconfirmed until the trial runs a roll forward. Why: T04 must find "the value last year's return facts give it" without importing B03's internals. Reverse: look up last year's CPA-final version cells only.
7. New data files: `data/taxprep/tax-choices/`, `allowed-typing/`, `review-lines/` (per release) and `diagnostics/categories.json`. Why: rules that change are data (tie-breaker), and each release can differ. Reverse: constants in code.
8. New schema files `db/schema/45_roundtrip.sql` (exports, imports, trace classes, resolutions) and `db/schema/47_diagnostics.sql`. Why: F01's one file per module; the round trip had no file. Reverse: put them in `40_figures.sql` and `70_checks.sql`.
9. T02 defines `ImportHistory` in `src/contracts/roundtrip.ts` and T01 implements it; T01 now depends on T02. Why: identity and staleness need the latest import, and T01 needs the recorded GUID and the latest export for copy lookups. Reverse: one combined card.
10. RT-2's content test in T02: refused as stale only when no cell the import changed holds its value; otherwise accepted, and the differing cells go to the trace as overridden, needing a reason at sign-off. Why: RT-2's "or is classed overridden with a reason" cannot be judged before the trace exists. Reverse: refuse on any differing cell.
11. T02 refuses an export missing a mapped or imported cell's row ("export filter incomplete"), refuses an all-zero GUID in an export, and reports identifiers outside the release by name without dropping them. Why: Taxprep lists every cell of a filter, so a missing row means a wrong filter, not a dropped value. Reverse: class missing rows as dropped.
12. T01 file name `<client_ref>-<YYYYMMDD>-v<n>.csv`, `client_ref` from the bridge (onboarding contract U6); T01 depends on F07. Why: RT-5 needs a client number and the client app has none. Reverse: another pattern.
13. T01 holds back a repeating row until its copy exists in an export ("add copy by hand, export, re-import"). Why: an import adding a copy is untried (Q21 tail); RT-7 says new copies by hand. Reverse: write copy `[n+1]` once the trial shows it works.
14. T01 never clears a figure that went back to "waiting on verification"; it lists "Taxprep still holds <value> from import <n>". Why: RT-12 forbids blanks except deliberate clears; the preparer decides. Reverse: auto-clear on unverify.
15. T04 class order: calculated, traced, overridden, dropped, rolled forward, orphan. Cells on the allowed-typing list are orphans marked `allowed` that need no source; a clear not applied is overridden ("clear not applied"); cells T02 returns as "differs from import N" are overridden. Why: F03's type holds exactly six classes, and RT-15 and RT-8 need a home in them. Reverse: a seventh class or sub-classes.
16. T04 does not use Taxprep's built-in "Overridden", "Imported" or "Rolled forward" filters. Why: a second upload changes the end state (red 1 below); the trace rests on our own import history. Reverse: see red 1.
17. T12 `candidateSources`: exact cents first, then "rounds to this value" listed apart, none selected. Why: RT-16 says exact value; Taxprep cells are whole dollars while facts are cents. Reverse: exact only.
18. T12 resolutions are keyed by identifier, natural row key and value, and carry to the next lock export only when the value is unchanged. Why: a re-lock should not force re-citing unchanged cells, and a changed value needs a new source. Reverse: re-cite after every export.
19. T12 writes F01's judgment input table (in `30_books.sql`) without changing that file, plus a fact through the ledger. Why: F01 put judgment inputs there; one record per cite. Reverse: a judgment input table in `45_roundtrip.sql`.
20. T05: iFirm's `Informative` is RT-17's Information; an unknown severity and an unparsed row count as Error; a printed return with no diagnostics page is a blocker; a reviewed (Reviewed tab) diagnostic keeps its severity; a paste box over the Diagnostics panel's text is the fallback. Why: a flag for a person rather than a silent pass. Reverse: refuse the printed return instead of a blocker; drop the paste fallback.
21. T07 identity of the printed return: another business number refuses it; a business number that cannot be read flags "not checked" for a person. T07 owns `testworld/taxprep/printed/`, which T05 uses. Why: day 3 could not read the PDF's fonts, and RT-11 needs the right return in the binder. Reverse: no identity check.
22. V06: the .GFI step comes first; "imported into Taxprep" is done only when an accepted lock export traces the import (RT-26); server-side type and size checks on uploads; tagged security; size L. Why: A164 and RT-26. Reverse: a manual "done" tick.
23. V12 also takes override reasons and dropped-cell explanations (RV-24's orphan part), so a return can be signed off in phase 2; V09 (phase 3) reuses its rows. Why: no other phase 2 screen resolves them. Reverse: move them to V09 and delay sign-off to phase 3.
24. N00 owners: traced, overridden and dropped cells are `ai-filled`; orphans (tax choices and allowed typing too) `preparer-only`; mapped cells never imported `held-back`. N00 adds LL-3 (`cellsByKey`) and one call in `src/pipeline/steps/import.ts`. Why: LL-2 counts only AI-filled cells against the AI, and the compare must be by natural row. Reverse: owners from import history only.
25. Tags: M00, T01, T02, T04, T05, T07, T12 core; T02 and V06 security; N00 none; V06 and V12 screens. Reverse: change the tags.

## Red (listed, not decided)

1. A second export at lock (Taxprep's built-in "Overridden" filter) as a cross-check of overrides and typed tax choices (FINDINGS section 5 suggests it; day 3: it returned exactly the typed CCA claim). It changes end state item 4 ("uploads one export and the printed return"). Recommendation: do not ask now; ambers 3 and 15 (tax-choice cells always cited) cover the risk. Ask only if a journey shows a typed value escaping the trace.

Nothing else is red: nothing costs money, touches live data or the client app, changes who sees what, or carries client wording.

## Open trial dependencies (each marked "trial-dependent" in its card, with the fallback in force)

| Point | Cards | Fallback in force |
|---|---|---|
| Can an import add a new copy (Q21 tail) | M00, T01 | rows held back until the copy is added by hand and exported |
| The token cell (Q23) | T01, T02 | no token in a real release; RT-2's content test |
| The roll-forward map (RT-24, roll forward not run) | M00, T04 | empty map; rolled values are orphans the preparer cites |
| Clearing text and yes or no cells by import (Q20) | T01 | allowed, marked "unconfirmed for this kind", checked by the next export |
| Negatives exported as `'-1356` (day 3) | T02, T07 | needs F03 to read `'-123` (see For the Lead 1) |
| Whether the lock filter can hold `IDENT.Ident7`, `Ident121` and the review lines together | T02, T07 | refused with "export filter incomplete: add ..." naming the fix |
| Forms holding taxable income and each tax (T2 jacket, Schedules 3 and 4) | T07 | placeholders marked unconfirmed, tests named "unconfirmed" |
| Whether the printed return shows diagnostics and can be read (day 3) | T05, T07 | the probe's row layout, Tesseract for unreadable text, a paste box, "not checked" flags |
| Severity list (`Filing warning`, `Hidden`, `Ignored`, the Reviewed tab) | T05 | rules as RT-17; reviewed keeps its severity; unknown is Error |
| Whether CCA claimed (`...FED.Ttw08cA22`) is an input or calculated cell | M00, T04 | tax-choice cells accepted on either list and always cited |
| Which cells Taxprep fills by itself (Q25) | T04 | a filled input cell never imported is an orphan |
| Which print format is uploaded | T07, V06 | any PDF; the checklist asks for the Government copy |

## For the Lead

1. F03's re-spec should add: an export value `'-123` (leading apostrophe, seen on a calculated cell with the default "-123" setting, day 3) parses as -123, and the writer never writes it. T02 check 9 needs it.
2. No card mints `client_ref` (onboarding contract U6). Add it to F07 (or a small bridge card) before T01's spec.
3. `plan/cards/families/schedule.md` is out of date: it asks for placeholder identifiers in CCH's `FORM[n].CELL` form for release "placeholder". It should follow `data/taxprep/map/_format.md` (M00): Taxprep's internal identifiers from FINDINGS.md, the four sources, `confirmed` flags; M11 and M12 start from M00's generated `gifi.json`; M14 to M21 add their tax-choice cells (CCA claimed, dividend designations and so on) to `data/taxprep/tax-choices/`.
4. Add T12 to the deps of J3-K01 to J3-K13 (I edited only the cards I wrote). J5 reaches it through V06 and V12.
5. Fold day 3 into FINDINGS.md (severities, `'-1356`, built-in filters, audit trail shows imports as a file name only, CCA claimed as an override) so the spec-writers have one source; the cards quote the day 3 notes meanwhile.
6. V09 (phase 3, exceptions, orphans and overrides) should reuse V12's rows rather than rebuild them; D08 and D12 overlap on the orphan list.
7. Shared files, so these run one after another: `src/modules/roundtrip/index.ts`, `src/contracts/roundtrip.ts` and `db/schema/45_roundtrip.sql` (T02, T01, T07, T04, T12); `src/pipeline/steps/import.ts` (T01, N00); the skeleton files (M00, T01, T04).
