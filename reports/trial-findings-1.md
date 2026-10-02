# Trial findings into the clauses and cards (interim)

1 Oct 2026. Opus drafter for the Lead, branch `claude/trial-findings-1` from origin/main 55b0a9c (includes walker run 4: Q21, Q22, balance-sheet and schedule ids). Documents only; no code.

## What changed

- `reference/taxprep/FINDINGS.md` (new, Status: interim): the cell map, the file format, Q20 to Q25 answered (Q23 open), the further findings (header not read, whole dollars, silent skips, the report), what the simulator must imitate (13 points), what the plan should change, what is still open.
- `blueprint/04-roundtrip.md`: RT-1, RT-2, RT-3, RT-4, RT-7, RT-8, RT-9, RT-10, RT-12, RT-13, RT-15, RT-20, RT-21, RT-22, RT-23 edited; RT-25 and RT-26 new. No renumbering.
- `blueprint/03-evidence.md`: TB-2 (memo format, decision 0014; the memo marks an AJE, not the Adj flag), TB-3 (plain QBO has no GIFI field), TB-10 (Transaction ID; trial balance has no ids); TB-13 new (what each QBO report carries, joining for the id, composite key fallback).
- `blueprint/01-rules.md`: RULE-2's tail says the trial wins over CCH's help on blanks.
- Cards: F03 rewritten to the trial's format and marked "Re-spec needed"; S00 rewritten to the trial's import behaviour (re-spec; any earlier S00 spec is void); S01 (wrong client by GUID and cells, wrong-return import, renumbering, the new fault set); S02 (input and calculated lists, `isInput`); S03 (waits on FINDINGS "Status: final"; what the interim already settles; two new checks); B04 (report facts from the sandbox, the Transaction List join, fixtures).
- `plan/slices.json`: F03 unparked to carded, spec null, note says re-spec; S00 spec null with a re-spec note; clause lists updated for F03, S00, S01, S02, S03, B04, M00; M00 (no card file yet) has a note listing what its card must carry.
- `.claude/rules/testing.md` (the Taxprep CSV fault set) and `reference/sources.md` (the CCH syntax line points to FINDINGS.md).

Checks run: `node tools/matrix.mjs --summary --plan` gives "PLAN OK" (198 testable clauses, up from 195 by RT-25, RT-26, TB-13); `node tools/status.mjs` reads the file (carded 234, parked 13).

## For the Lead

- S00's spec was released earlier: the old spec claim and any spec branch for S00 are void.
- RT-25 (whole-dollar rounding and the Schedule 100 plug line) touches amounts: put it on the CPA's check list (decision 0008, B8; decision 0012 Z12-1).
- RT-2 fallback (drop the token, test staleness by content) only takes effect if the trial ends with no confirmed safe cell; until then the simulator keeps its placeholder and the real import writes no token.
- Not done here: `taxprep-cells.json` and the sample-client imports (Lead-run), the M00 card, T02 and T05 card notes (listed in FINDINGS.md section 5).

## Ambers

- RT-3 rewritten to the header and row shape Taxprep's export writes (`[name|0|0|GUID]`, four quoted columns, description empty on import); CCH's help shape dropped. Why: the trial's export and import (day 1, run 2) differ from the help page. Reverse: restore the help-page text of RT-3.
- RT-1 reads identity from the export (BN `IDENT.Ident7`, year end `IDENT.Ident121`, header GUID recorded at the first export) and says Taxprep checks nothing on import. Why: a wrong name, a wrong GUID and a 3-field header were all applied silently (Q27). Reverse: restore RT-1's earlier text.
- RT-2 keeps the token cell open, names IFirm.ContactPartner as an unproven candidate, and sets the fallback (no token; an export follows import N only if every cell N changed holds N's value or is overridden with a reason). Why: Q23 unresolved; no proof the cell is never transmitted. Reverse: drop the fallback sentence.
- RT-4 adds: the writer refuses any identifier not on the release's input list. Why: Taxprep accepts text into a calculated cell with no report line (run 4). Reverse: delete the added sentence.
- RT-7 adds: copies renumber after a delete; copy found from the latest export; a write to a copy holding another key refused; new copies by hand until an import is shown to add one. Why: Q21 (class 8 moved from [2] to [1]); import to [3] untested. Reverse: delete the added sentences.
- RT-8 clears a value by an import row with an empty value, with person and reason, by hand only if the export still shows it. Why: Q20, the import empties a cell on `""` or `" "`. Reverse: restore "cleared by hand in Taxprep".
- RT-9 names the fixed settings (comma, -123, period, no thousands, Windows-1252, CRLF, all quoted, no BOM), refuses characters outside Windows-1252 and lists the re-save marks. Why: day 1 export defaults and Q24 (UTF-8 garbles silently). Reverse: restore the generic RT-9.
- RT-10 settles one saved "Select all" filter for the calculated review lines; which forms hold taxable income and each tax still open. Why: Q22. Reverse: restore "one filter or a second file is settled on the trial".
- RT-12 rewritten: an empty value or a single space clears, "0" is zero; the writer never writes a blank except a deliberate clear. Why: Q20 contradicts CCH's help. Reverse: restore "Blank cells are not imported (CCH)".
- RT-13 adds the contact-synchronised cells (skipped while the default "Exclude" box is ticked); the writer leaves them out. Why: `IDENT.Ident311` and `Ident492` skipped with no report row (run 2). Reverse: delete the added text.
- RT-15 puts the return-creation and contact cells on the allowed-typing list, still checked by RT-1 and RT-13. Why: the "Entered" export after import holds 7 such cells that would otherwise be orphans (compare-07). Reverse: delete the added sentence.
- RT-20 adds: equal bytes prove no change, else compare cell by cell. Why: two exports with nothing changed are byte-identical (compare-07). Reverse: delete the added sentence.
- RT-21 names the identifiers as Taxprep's internal ones with examples, keeps jump code, line or GIFI code and description for people, and reads the GIFI code from the export description. Why: day 1 and run 2 ids are not box numbers. Reverse: restore RT-21's two sentences.
- RT-22 takes two lists ("Select all input cells" and "Select all") and requires one copy of each repeating form on the reference return. Why: Q22, and S8 lists no cells until a copy exists (run 4). Reverse: restore RT-22's earlier text.
- RT-23 makes the simulator follow FINDINGS.md first and CCH's rules where the trial is silent, and lists the quiet behaviours to imitate. Why: the trial differs from the help in several places. Reverse: restore RT-23's earlier text.
- RT-25 new: amount cells take whole dollars; round each GIFI code half away from zero; the Schedule 100 difference on one named line (3600, or the largest liability or equity line), shown as rounding. For the CPA's check. Why: cents refused per row (run 2); the rule in cell-map-status.md. Reverse: mark RT-25 removed.
- RT-26 new: the import report is never proof; only an export compared cell for cell is. Why: the report lists only cells that held a value, no counts, silent skips (run 3). Reverse: mark RT-26 removed.
- RULE-2's tail notes that the trial showed blanks clear and that the build follows the trial where it differs from the help. Why: keep RULE-2 consistent with RT-12. Reverse: restore the earlier tail.
- TB-2 names the memo format `AJE <type>: <reason> | source: <document or note>[; ...]` and makes the memo, not the Adjustment flag, mark an adjusting entry. Why: decision 0014 accepts the format; the sandbox JE form has no adjusting tick box (Adj reads No). Reverse: delete the added sentences.
- TB-3 adds that plain QBO has no GIFI field or screen; the .GFI comes from QBO Accountant Workpapers. Why: sandbox chart of accounts and search (third attempt). Reverse: delete the added sentence.
- TB-10 names the QBO Transaction ID and says a trial balance pointer names only the snapshot and account. Why: the Trial Balance carries no ids (sandbox). Reverse: restore TB-10's earlier text.
- TB-13 new: what each QBO report carries; ids joined from the Transaction List on type and number; composite key and a flag otherwise; a missing column refused. Why: sandbox third attempt. Reverse: mark TB-13 removed.
- F03 unparked to carded with a re-spec, clauses RT-8, RT-21, RT-25 added; S00 re-spec with RT-8, RT-25, RT-26; RT-4 added to S02, RT-7 and RT-4 to S03; TB-13 to B04; RT-25 and RT-4 to M00. Why: the cards cite the clauses their new checks test. Reverse: restore the clause lists and park F03.
