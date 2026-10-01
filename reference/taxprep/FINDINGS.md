# Taxprep trial findings

Status: interim (1 Oct 2026, after trial days 1, 1b and part of 2). Not final: days 3 to 7 are still to run. Cards that wait on "FINDINGS final" (S03) keep waiting; cards that need only the file format and the cell ids (F03, S00, S01, S02) may use this version.

Product: CCH iFirm Taxprep, T2 Corporate "2024 and later" (one product for 2025 and 2026 year ends), platform release CCH iFirm 2026.20.198267. Trial ends about 16 Oct 2026; 100 PDFs at the start. Made-up returns only: Riverdale Rentals Inc. (Test), Eglinton Holdings Inc. (Test), Eglinton Retail Ltd. (Test), Maple Ridge Consulting Inc. (Test), Probe Co. (Test).

Sources: `2026-10-01-day1/notes.md`, `2026-10-02-day2/notes.md` (walker runs 1 to 4), `2026-10-02-day2/compare-07.md`, `day1-findings.md`, `cell-map-status.md`, `FEATURES.md`, the structure exports in `2026-10-01-day1/exports/` and `2026-10-02-day2/exports/`. Each finding below names its source run.

## 1. The cell map

Source of truth for mapped ids: `reference/sample-clients/lib/taxprep-cells.json` (`confirmed: true` only where a real export listed the id).

| Area | Identifier family | Cells seen | Source |
|---|---|---|---|
| Identification (ID form) | `IDENT.Ident<N>` (060 start `Ident120`, 061 end `Ident121`, 001 BN `Ident7`, 750 province `Ident8`, name `Ident311`, 990 language `Ident230`, client code `Ident451`) plus `ABATA.*` and `FDFTC.*` cells the ID form feeds | 225 rows with S125 | day 1 |
| iFirm contact | `IFirm.AutoSync`, `IFirm.ContactPartner`, `IFirm.ContactID` | 3 | day 1, run 2 |
| S125 header and totals | `GFBGII[1].GFGII.Ttwgii<N>` (calculated totals among them, for example `Ttwgii4` total revenue) | 23 | day 1 |
| GIFI revenue (S8299) | `GFBGII[1].GFGIJ.Ttwgij<N>` (8141 = `Ttwgij104`, prior year `Ttwgij179`) | in 906 | run 2 |
| GIFI cost of sales (S8518) | `GFBGII[1].GFGIK.Ttwgik<N>` | in 906 | run 2 |
| GIFI operating expenses (S9367) | `GFBGII[1].GFGIL.Ttwgil<N>` | in 906 | run 2 |
| GIFI current assets (S1599) | `GFGBA.Ttwgba<N>` (1002 = `Ttwgba64`), no copy index | in 906 | run 2 |
| GIFI other balance-sheet forms | `GFGBB` (284: S2008/2009, S2178/2179 and other assets), `GFGBD` (80, intangibles), `GFGBF` (133, due from shareholders and others), `GFGBG` (121, current liabilities), `GFGBH` (106, long-term debt), `GFGBI` (26, share capital), `GFGBJ` (38, retained earnings), all `<FAMILY>.Ttwgb<x><N>`, no copy index | 788 | run 4 |
| Schedule 1 | `FDONE.Ttwone<N>` (196 input cells, for example line 124 = `Ttwone5`); repeating rows `FDONE.SLIPA[n].TtwoneA2/A3` (line 295, 5 rows) and `FDONE.SLIPD[n].TtwoneD2/D3` (line 395, 4 rows) | 205 | run 4 |
| Schedule 8 (CCA) | `CCACat.FD08C[n].FED.Ttw08cA1` = class number; other columns listed only once entered | 1 per copy | run 4, Q21 |
| Schedule 50 | none listed (no copy existed) | 0 | run 4 |

Every GIFI code has three cells: Account (free text), Amount, Prior year. The description column carries the code (`GIFI code 8141 - Amount - Real estate rental revenue`), so the code-to-id table is read from the export, not typed.

**Mapped and confirmed:** 300 GIFI amount codes on S8299, S8518, S9367 and S1599 (in `taxprep-cells.json`). The other balance-sheet families and Schedule 1 are captured in `bs-forms-structure.csv` and `sched-forms-structure.csv` but not yet added to `taxprep-cells.json`.

**Not mapped yet:** the T2 jacket (taxable income, line 360), Schedules 3, 4, 23 and 50 and the other schedule cells the sample clients need, the S8 columns past the class number, Ontario forms. Prior-year cells are mapped but never written (the Last Year column stays empty).

**Round trip (phase 0 gate shape):** Riverdale's regenerated `import.csv` (13 rows: 3 S1599, 1 S8299, 9 S9367) imported and exported back with 13 of 13 identical values and no format differences (compare-07). Net income 6,737, taxable income 6,737, Part I tax 1,010, all calculated by Taxprep.

## 2. The file format (export and import)

- Bytes: Windows-1252 single byte (é is E9), no byte-order mark, CRLF after every line including the last (day 1).
- Header: `[<return name>|0|0|<return GUID>],"Current Year","Last Year",""`: four fields, not the help's three `[name|return id|language]` (day 1).
- Rows: identifier unquoted, then `"current"`, `"last"`, `"description"`, every value quoted, empty ones as `""` (day 1). Dates YYYY-MM-DD; yes or no cells `Y` or `N`; rates exported to 4 decimals (`0.2000`) (run 4).
- Export settings (defaults in bold): column break Tab, **Comma**, Semi-colon or Space; negatives **-123** or (123); decimal **Period** or Comma; thousands **none**, comma or space. Import dialog: column break (Comma), thousands (none), taxpayer selection, and "Exclude the values associated with the synchronized contact information" ticked by default; no encoding or decimal option (day 1, run 2).
- An export of a filter lists every cell in it, empty ones included; a cell added twice comes out once. The default filter "Entered this year or last year" lists only cells with data (day 1, run 2).
- Two exports of the same filter and settings with nothing changed are byte-identical, header and order included (compare-07).
- Export is asynchronous: a notification in the return's own bell, then a Download link that needs a real mouse click. File name `<client code>-T2-<year>-<client name>-<yyyymmdd>-<hh>-<mm>-<ss>-<ms>.csv` (day 1, run 4).
- Row order is Taxprep's form order (GFGBA before GFBGII before IDENT), not alphabetical (compare-07).

## 3. Answers to the open questions

| # | Question | Answer | Confidence | Source |
|---|---|---|---|---|
| Q20 | Can a CSV import clear a cell? | Yes. An empty value `""` or a single space `" "` clears it ("This cell has been emptied by the import."); `0` stores zero. Tried on a GIFI amount cell; clearing text and yes or no cells untried on a non-contact cell. | confirmed for amount cells | run 2 |
| Q21 | What happens to repeating-form copy numbers after a delete? | They renumber with no gaps: S8 classes 1 and 8 at copies [1] and [2]; after deleting copy 1, class 8 is at [1]. A copy number is a position, not an identity. Whether an import can create a new copy (a row to [3]) is untried (the guard blocked the import). | confirmed | run 4 |
| Q22 | Can a saved filter export calculated cells? | Yes. A custom filter built with "Select all" (not "Select all input cells") exports calculated cells with their values in the same file (S1: net income for tax `FDONE.Ttwone66`, totals, rates). Nothing in the file marks a cell as calculated. Combine filters can exclude summary, blank or calculated cells. The T2 jacket and Schedules 3 and 4 not tried yet. | confirmed for S1 | run 4 |
| Q23 | Which cell is never sent to CRA, to hold the import token? | **Unresolved.** `IFirm.ContactPartner` (form IW, "Partner", no box) takes imported text, but nothing yet shows it is never transmitted, and its read-back is untried. Other homes to try: return Notes, a cell comment, the return label (none seen in the CSV export). | open | run 2, run 4 |
| Q24 | Which text encoding does the import expect? | Windows-1252. A UTF-8 file imports with no warning and garbles accents (é stored as the two bytes C3 A9); a Windows-1252 file round-trips clean. | confirmed | run 2 |
| Q25 | Which cells does Taxprep fill by itself from the GIFI? | Calculated cells only, as far as seen: net income for tax, taxable income and Part I tax change at once from the GIFI cells, and S1 net income per books is calculated (`FDONE.Ttwone229`). After Riverdale's import the "Entered" export held only the 13 imported cells plus 7 return-creation and contact cells: no input cell was filled from the GIFI. | confirmed for Riverdale | run 2, compare-07 |

Further findings:
- **Header not checked on import** (Q27): a wrong return name, an all-zero GUID, a wrong GUID and a 3-field header were all applied silently. The import goes to the return picked in the dialog; nothing in the file can stop a wrong-client import (run 2).
- **Whole dollars only** in amount cells: 7693.52 and 48600.01 refused per row ("The value X could not be imported in this cell because it was invalid."); typed decimals export without them (run 2).
- **Silent skips:** contact-synchronised ID cells (`IDENT.Ident311` name, `IDENT.Ident492`) were not changed by an import and the report said nothing; the reason for `Ident492` is unknown. Text imported into a calculated cell (`GFBGII[1].GFGII.Ttwgii4`) was accepted, shown in the cell (as "ASH-TES") and not reported (run 2, run 4).
- **The import report** lists only cells that already held a value ("replaced by a new imported value" or "emptied by the import") and refused rows; new cells import with no line and no counts; with nothing to list it says "Data imported successfully" (run 2, run 3).
- Extra trailing columns on a row are ignored; the description column may be empty on import; an import replaces existing values (run 2).
- Custom filters are shared across returns of the product; a new one appears in Export's list only after a page reload (run 2, run 4).
- Built-in filters "Imported", "Overridden", "Edited after CRA/RQ import" and "Rolled forward" exist: Taxprep's own provenance (day 1). Not yet exported.
- Diagnostics carry stable ids (R2000100, R1400002, E909, G123, N1); 24 on an empty return (11 General, 13 Filing). Categories and which ones block e-filing: day 3 (day 1).

## 4. What the simulator must imitate

1. The file format of section 2, byte for byte, including the header with the return's own name and GUID on export, the description column filled from the release list, and Taxprep's row order.
2. A header it does not read on import: any name or GUID is applied to the return the call names.
3. An empty value or a single space clears; `0` stores zero.
4. Cents in an amount cell refused for that row with the trial's wording; the rest of the file imports.
5. Year-start and year-end cells and contact-synchronised cells skipped with no report line.
6. Text into a calculated cell accepted, held, exported, not reported.
7. UTF-8 bytes stored as they come (garbled when read as Windows-1252), with no warning.
8. The import report of section 3: lines only for cells that held a value and for refused rows; "Data imported successfully" otherwise; no counts.
9. At least two filters: "entered" (cells with data) and "all input cells" (every cell, empty as `""`); and, for S03, "Select all" (input and calculated cells, unmarked).
10. Copies renumbered down with no gap after a delete.
11. Byte-identical exports when nothing changed.
12. Calculated cells (S1 net income, taxable income, Part I tax) changing at once from the GIFI cells: S03 only, from recorded data, no tax engine.
13. Open behaviour stays a named placeholder: the token cell, an identifier not on the release list, an import to a new copy, the diagnostics list, roll-forward.

## 5. What the plan should change

Done on branch `claude/trial-findings-1` (amber; rows in `reports/trial-findings-1.md`):
- Blueprint 04: RT-1 (identity read from the export: BN cell, year-end cell, header GUID; Taxprep checks nothing), RT-2 (token still open; a content test if no safe cell), RT-3 (the export's own shape), RT-4 (writer refuses non-input ids), RT-7 (copies renumber; copy lookup from the latest export; new copies by hand until shown), RT-8 (clear by an empty value), RT-9 (the fixed settings named, Windows-1252), RT-10 (one "Select all" filter), RT-12 (empty clears), RT-13 (contact cells skipped), RT-15 (creation and contact cells on the allowed list), RT-20 (byte equality), RT-21 (internal ids), RT-22 (two lists; copies must exist), RT-23 (imitate the trial), new RT-25 (whole dollars and the rounding line) and RT-26 (the report is not proof). RULE-2's tail notes that the trial wins over the help.
- Cards F03 (re-carded: needs a fresh spec), S00 (re-spec), S01, S02, S03 (waits on "final"), B04; M00's slice note says what its card must carry.

Still for the Lead:
- Sample clients: add the balance-sheet families and Schedule 1 ids from `bs-forms-structure.csv` and `sched-forms-structure.csv` to `taxprep-cells.json` with `confirmed: true`, extend the writer for Schedule 1, and regenerate the imports (the Schedule 100 rounding plug then reaches the file).
- Ask CCH (help text, Cell details wording or support) whether form IW and `IFirm.*` cells are ever transmitted; if not settled by the end of the trial, RT-2's fallback stands and the token is dropped.
- Card note for T02: the lock filter must include `IDENT.Ident7`, `IDENT.Ident121` and the calculated review lines; use the "Imported" and "Overridden" built-in filters as a cross-check of the RT-14 classes, never as the only source.
- Card note for T05 and the RT-17 list: key diagnostics on their ids.

## 6. Still open (days 2 to 7)

- Q21 tail: can an import add a new copy (a row to `[3]`)?
- Q23: the token cell, and the `IFirm.ContactPartner` read-back.
- Clearing text and yes or no cells by import on a non-contact cell; why `IDENT.Ident492` was skipped.
- What the import does with an identifier that does not exist.
- Step 26: one export per non-default setting, for F03's fault files.
- The T2 jacket, Schedules 3, 4, 23 and 50, and the rest of S8, by "Select all input cells" and "Select all" filters (RT-10, RT-22).
- Day 3: tax choices, lock, the printed return with diagnostics and their categories (RT-17), roll-forward to the next year (RT-24), conversion.
- Day 4: Auto-fill, structure only (Zo). Day 5: all ten companies. Day 6: changes after lock and the check export (RT-19, RT-20).
