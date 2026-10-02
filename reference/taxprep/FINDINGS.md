# Taxprep trial findings

Status: interim (rewritten 1 Oct 2026 with day 5; after trial days 1, 1b, 2, part of 3 and 5). Not final until day 6 (changes after lock, the check export, roll forward) and day 4 (Auto-fill, Zo). Cards that wait on "FINDINGS final" (S03) keep waiting; cards that need only the file format, the cell ids and the behaviours below (F03, S00, S01, S02, T01, T02, T05, T07, M00) may use this version.

Product: CCH iFirm Taxprep, T2 Corporate "2024 and later" (one product for 2025 and 2026 year ends), platform release CCH iFirm 2026.20.198267; the printed forms say `CCH IFIRM TAXPREP IF18 VERSION 2026 V1.2`. Trial ends about 16 Oct 2026; PDFs left 94 of 100 after day 5 (floor 85). Made-up returns only, all ending "(Test)": the ten sample clients 01 to 10 and Probe Co. (Test).

Sources: `2026-10-01-day1/notes.md`, `2026-10-02-day2/notes.md` (runs 1 to 4), `2026-10-02-day2/compare-07.md`, `2026-10-03-day3/notes.md` and `diagnostics-probe.md` (day 3), `2026-10-05-day5/notes.md` (runs 5A, 5B, 5C, 5D and "After day 5"), `2026-10-05-day5/compare-all.md`, `2026-10-05-day5/diagnostics-05.md` and `-06.md`, `day1-findings.md`, `cell-map-status.md`, `FEATURES.md`, the structure exports in each day's `exports/`. Each finding names its source run.

## 1. The cell map

Source of truth for mapped ids: `reference/sample-clients/lib/taxprep-cells.json` (`confirmed: true` only where a real export listed the id).

| Area | Identifier family | Cells seen | Source |
|---|---|---|---|
| Identification (ID form) | `IDENT.Ident<N>` (060 start `Ident120`, 061 end `Ident121`, 001 BN `Ident7`, 750 province `Ident8`, name `Ident311`, 990 language `Ident230`, client code `Ident451`, 070 `Ident240` yes or no) plus `ABATA.*` and `FDFTC.*` cells the ID form feeds | 225 rows with S125 | day 1, day 5 |
| iFirm contact (form LW, Client Letter Worksheet) | `IFirm.AutoSync`, `IFirm.ContactPartner` ("Partner"), `IFirm.ContactID` (equals the client code) | 3 | day 1, day 5 |
| S125 header and totals | `GFBGII[1].GFGII.Ttwgii<N>` (calculated totals among them, for example `Ttwgii4` total revenue; `Ttwgii2` text "Description of the operation") | 23 | day 1, 5D |
| GIFI revenue (S8299) | `GFBGII[1].GFGIJ.Ttwgij<N>` (8141 = `Ttwgij104`, 8231 = `Ttwgij121`, prior year `Ttwgij179`) | in 906 | run 2 |
| GIFI cost of sales (S8518) | `GFBGII[1].GFGIK.Ttwgik<N>` (8500 = `Ttwgik92`) | in 906 | run 2 |
| GIFI operating expenses (S9367) | `GFBGII[1].GFGIL.Ttwgil<N>` | in 906 | run 2 |
| GIFI current assets (S1599) | `GFGBA.Ttwgba<N>` (1002 = `Ttwgba64`), no copy index | in 906 | run 2 |
| GIFI other balance-sheet forms | `GFGBB` (284: S2008/2009, S2178/2179 and other assets), `GFGBD` (80, intangibles), `GFGBF` (133, due from shareholders and others), `GFGBG` (121, current liabilities), `GFGBH` (106, long-term debt), `GFGBI` (26, share capital), `GFGBJ` (38, retained earnings), all `<FAMILY>.Ttwgb<x><N>`, no copy index | 788 | run 4 |
| Schedule 1 | `FDONE.Ttwone<N>` (196 input cells, for example line 124 = `Ttwone5`); repeating rows `FDONE.SLIPA[n].TtwoneA2/A3` (line 295, 5 rows) and `FDONE.SLIPD[n].TtwoneD2/D3` (line 395, 4 rows) | 205 | run 4 |
| Schedule 8 (CCA) | One copy of workchart S8CCA per class. Per copy `CCACat.FD08C[n].FED.Ttw08cA<N>`: A1 class number, A2 rate (`0.2000`), A5 UCC at start (box 201), A9 additions subject to ITR 1100(2) (box 203), A10 additions not subject, A12 disposals, A21 maximum CCA (calculated), A22 CCA claimed (box 217), A23 UCC at end; the same columns repeat under `.QUE.` and `.ALB.`; yes or no and link cells `CCACat.FD08C[n].Ttw08c<N>`. Totals `CCACat.FED.Ttw08c<N>` (c3 CCA, c13 UCC start, c14 additions, c18 UCC end) | 195 under copy [1] | run 4, Q21; day 3 (`2026-10-03-day3/exports/s8-s1-after-cca-structure.csv`) |
| Schedule 3 (dividends) | `FDDIV.*`. Received (Part 1, one row per payer and payment): `FDDIV.SLIPA[n].TtadivA1` name, `A3` connected (`1` yes, `2` no), `A4` BN, `A5` payer year end, `A6` column 230 (non-taxable, s.83), `A7` column 240 (taxable, deductible), `A11` 242 eligible. Paid: line 450 `Ttadiv377`, **line 455 eligible designation `Ttadiv369`** (a dollar amount, not a yes or no), line 510 capital dividend `Ttadiv365`, 520 `Ttadiv366`, 530 `Ttadiv367`, 540 `Ttadiv368`. No cell for a payment date; no election cell | about 54 input | run 5C |
| Schedule 23 (business limit) | Form `FDASC.Ttwasc<N>` (050 year `Ttwasc76`, 075 amended `Ttwasc80`, total A `Ttwasc268`, calculated totals 271 to 276); **rows are `MJRAW.SLIPA[n].Ttwraw<x>`**: `A1` name, `A16` association code, `A196` year start, `A74` year end, `A172` business limit allocated (plus `TwinTtwrawA172`) | 1 + rows | run 5C, compare-all |
| Schedule 4, T2 jacket | `FDCRY.*` (S4, 61 input), `IDENT.*`, `GCRM.*`, `CCRTG.*`, `FDFTC.*`; the "Select all" export adds `HSRAT`, `FDONE` and more | 250 input on 05 | run 5C (`2026-10-05-day5/exports/schedules-*-structure-0[56].csv`) |
| Schedule 50 | none listed (no copy existed; dropped from the day 5 filters while the form loaded) | 0 | run 4, 5C |

Every GIFI code has three cells: Account (free text), Amount, Prior year. The description column carries the code (`GIFI code 8141 - Amount - Real estate rental revenue`; balance-sheet rows have no "Amount"), so the code-to-id table is read from the export, not typed.

**Mapped and confirmed:** 300 GIFI amount codes on S8299, S8518, S9367 and S1599 (in `taxprep-cells.json`). Captured but not yet in `taxprep-cells.json`: the other balance-sheet families and Schedule 1 (`bs-forms-structure.csv`, `sched-forms-structure.csv`), the S8 columns, S3, the S23 rows, S4 and the jacket (day 5 structure files).

**Not mapped yet:** Schedules 50 and 53 (GRIP), Ontario forms. Prior-year cells are mapped but never written (the Last Year column stays empty).

**Round trips (phase 0 gate shape): all ten sample clients, day 5.** 159 imported cells, 159 back, 156 identical and 3 negatives back with a leading apostrophe; nothing dropped or changed (`2026-10-05-day5/compare-all.md`). The ten include a non-calendar year (02), years ending before the trial year (03, 08) and a short first year (09). Riverdale's day 2 result (13 of 13, compare-07) held again.

## 2. The file format (export and import)

- Bytes: Windows-1252 single byte (é is E9), no byte-order mark, CRLF after every line including the last (day 1).
- **Every exported negative carries a leading apostrophe** with the default "-123" setting: calculated cells (`FDONE.Ttwone66,"'-1356"`, day 3) and imported input cells (an imported `-1299` exports as `"'-1299"`, day 5 on 06 and 08). The import takes a plain `-1299`. The reader strips one leading apostrophe (F03); the writer never writes one; every compare runs after the strip. Only the "(123)" setting drops it (`"(1356)"`), and RT-9 keeps the default (5D-4).
- Header: `[<return name>|0|0|<return GUID>],"Current Year","Last Year",""`: four fields, not the help's three `[name|return id|language]` (day 1).
- Rows: identifier unquoted, then `"current"`, `"last"`, `"description"`, every value quoted, empty ones as `""` (day 1). Dates YYYY-MM-DD; yes or no cells `Y` or `N`; rates exported to 4 decimals (`0.2000`) (run 4).
- Export settings (defaults in bold): column break Tab, **Comma**, Semi-colon or Space; negatives **-123** or (123); decimal **Period** or Comma; thousands **none**, Comma or Space. Day 5 (5D-4; made-up Probe files `2026-10-05-day5/exports/settings-*.csv`, F03's fault files): the column setting changes the separator between all four fields and in the header, quotes stay; thousands Comma or Space put the separator inside the quoted number (`"5,000"`, `"5 000"`); decimal Comma changed nothing visible in a whole-dollar file. Import dialog: column break (Comma), thousands (none), taxpayer selection, and "Exclude the values associated with the synchronized contact information" ticked by default; no encoding or decimal option (day 1, run 2).
- An export of a filter lists every cell in it, empty ones included; a cell added twice comes out once. The default filter "Entered this year or last year" lists only cells with data plus eight creation and contact cells: `IDENT.Ident120`, `Ident121`, `Ident311`, `Ident230`, `Ident451`, `Ident492` (`N`), `IFirm.ContactPartner` and, since day 5, `IFirm.ContactID` (Riverdale's export grew by exactly that row between day 2 and day 5).
- Two exports of the same filter and settings with nothing changed are byte-identical, header and order included (compare-07).
- Export and print are asynchronous: a notification in the bell (firm-wide, newest first), then a Download link that needs a real mouse click. File name `<client code>-T2-<year-end year>-<client name>-<yyyymmdd>-<hh>-<mm>-<ss>-<ms>.csv` (day 1, run 4, day 5).
- **Window-visibility rule (day 5, run 5A and exports retry 2):** while the iFirm window is hidden (`document.visibilityState` is `hidden`) the bell stays empty ("No notifications found") and no export or print arrives, yet a print still spends a trial PDF. Once the window is visible the queued items appear and download in about 8 seconds. Walkers: window on screen and uncovered, checked, before any export or print. Ops wording (T02, T07): keep the iFirm tab in front until the file has downloaded.
- Row order is Taxprep's form order (GFGBA before GFBGII before IDENT), not alphabetical (compare-07).

## 3. Answers to the open questions

| # | Question | Answer | Confidence | Source |
|---|---|---|---|---|
| Q20 | Can a CSV import clear a cell? | Yes for amount and text cells: `""` or `" "` clears ("This cell has been emptied by the Import."); `0` stores zero. **A yes or no cell cannot be emptied:** `""` resets it to its default `N`, reported as "replaced", and it stays in the export. | confirmed | run 2, 5D-2 |
| Q21 | Copy numbers after a delete; can an import add a copy? | Copies renumber with no gaps after a delete (S8 class 8 moved from [2] to [1]): a copy number is a position. **An import can add a copy:** writing `CCACat.FD08C[3].FED.Ttw08cA1` on a return with two S8 copies created a third, silently ("Data imported successfully"). Only the next free index was tried; a gap index (for example `[5]` with two copies) is untried. | confirmed (next index) | run 4, 5D-1 |
| Q22 | Can a saved filter export calculated cells? | Yes, a custom filter built with "Select all" (not "Select all input cells"); nothing in the file marks a cell as calculated or typed. Day 5 built filters on the jacket, S3, S4, S23 and S53; S8CCA and S50 (and S3 in the calc filter) were dropped because "Select all" was clicked while the form preview was still loading: wait for the preview. | confirmed for S1, S8, S3, S4, S23, jacket | run 4, day 3, 5C |
| Q23 | Which cell is never sent to CRA, to hold the import token? | **No safe cell.** `IFirm.ContactPartner` (form LW, "Partner"; not IW) takes the token and the default export reads it back, but the contact synchronisation wipes it to `""` as soon as the return is opened (ID form, return properties, Review tab with contact sync on). Return Properties has no free text; Notes (`ASH-NOTE-PROBE`) and a cell comment (`ASH-COMMENT-PROBE`) take text but appear in no export and no PDF; a label is a firm setting. The token was in no printed copy (EFILE or Office). So RT-2's fallback stands: no token; staleness by content. | confirmed (answer: none) | 5D-5, After day 5 |
| Q24 | Which text encoding does the import expect? | Windows-1252. A UTF-8 file imports with no warning and garbles accents (é stored as C3 A9; the day 5 report showed an old value as "CafÃ©"). | confirmed | run 2, 5D-2 |
| Q25 | Which cells does Taxprep fill by itself from the GIFI? | Calculated cells only: no input cell was filled from the GIFI on any of the ten returns. But "Import and link corporations" writes cells (06: 75 `MJRAW.SLIPA[2].*` from 05, 66 of them `Ghost...`) that the "Entered" export lists like typed cells, with nothing to tell them apart. | confirmed | compare-07, compare-all |
| Q27 | Is the header checked on import? | No: a wrong name, an all-zero or wrong GUID and a 3-field header are applied silently; the import goes to the return picked in the dialog (on day 5 the dialog's Taxpayer selection showed "Main - <return name>"). | confirmed | run 2, 5A |
| O4 | What does the import do with an id that does not exist? | Refuses that row: Form, Description and Box `--`, Result "Cell not available."; **the id is not echoed**, so two bad ids give two identical lines. The other rows import (a new cell silently). | confirmed | 5D-3 |
| O5 | One export per non-default setting | Done, seven files (section 2). | confirmed | 5D-4 |
| O9 | All ten companies | All ten created and imported ("Data imported successfully"; Riverdale listed its 13 "replaced" rows, filled on day 2); counts in section 3c; compare in `compare-all.md`. | confirmed | 5A, 5B |

Further findings:
- **Whole dollars only** in amount cells: 7693.52 and 48600.01 refused per row ("The value X could not be imported in this cell because it was invalid.") (run 2).
- **Silent skips:** contact-synchronised ID cells (`IDENT.Ident311` name, `IDENT.Ident492`) are not changed by an import and the report says nothing; why `Ident492` is skipped is still unknown (no description; its Cell details not opened). Text into a calculated cell (`GFBGII[1].GFGII.Ttwgii4`) is accepted and not reported (run 2, run 4).
- **The import report** lists only cells that already held a value ("replaced by a new imported value" or "emptied by the Import."), refused rows and unknown ids; new cells import with no line and no counts; a yes or no cell moved from its default to `Y` gave no line; with nothing to list it says "Data imported successfully" (run 2, run 3, 5D).
- **Business number check digit (5A step 1):** Add return refuses a BN that fails its check digit (the field turns red; Add stays disabled). The sample clients' BNs fail on purpose, so every test return has an empty `IDENT.Ident7`. Whether an import into `Ident7` refuses a bad BN is untried.
- Extra trailing columns on a row are ignored; the description column may be empty on import; an import replaces existing values (run 2).
- Custom filters are shared across returns; a new one appears in Export's list only after a page reload (run 2, run 4).
- Built-in export filters (day 3): Entered this year or last year (default), Entered this year, Entered last year, Overridden, Edited after AFR/TDD import, Imported, Breakdown, Spreadsheet, Rolled forward, Track changes, All review marks, First review, Second review, Question, Problem, Cells with comments, Cells with diagnostics, then custom filters. "Overridden" exported exactly the typed override (day 3). **"Track changes" exported only the header** on 05 after hand edits: it shows changes since a tracking baseline, not typed cells (5C). "Imported" and "Rolled forward" not yet exported.
- **Cell ids come only from exports:** the Cell details tab never shows an id, and "Copy cell ID" goes to a clipboard the walker cannot read (5C).
- **Import and link corporations** lists only this firm's returns (on day 5 only "(Test)" ones). Linking 05 into 06 added an S9 workchart copy, 05's S23 row on 06 and an O103 "Overridden data" diagnostic (5C).

## 3b. Day 3 findings (3 Oct, partial run, Probe Co. (Test))

- **Tax choice (CCA, Schedule 8):** with class 8 additions of 5000, Taxprep applies the half-year rule (UCC adjustment 2,500), computes the maximum CCA (1,500 at 20%) and fills CCA claimed with the maximum by default. Typing 1000 in CCA claimed (box 217, `...FED.Ttw08cA22`) makes an **override** (blue corner triangle, "Remove override" turns on); net income for tax and Part I tax move at once (444 to -556; tax 67 to 0). A second copy, class 1 (4%), with opening UCC 20000 claimed its maximum 800 by default, untyped (net income -1,356). So a tax choice left at its default is a calculated value nobody typed; a changed one is an override. Whether A22 is on the "Select all input cells" list is not yet checked.
- **Editing S8:** values are typed on the S8CCA workchart (click, type, Enter); typing in the S8 summary row does nothing, and Tab then Enter there lands on the trash icon and opens "Delete line". Add copy is Tools (Ctrl+I); the class picker lists "1 (4%)", "2 (6%)" and so on.
- **Stale screen:** the REVIEW grid of a saved filter kept showing the old net income (444) while the status bar and the export showed -1356. Trust the export and the status bar, never the review grid.
- **Diagnostics (RT-17):** see section 3c.
- **Audit Trail (RT-20):** Actions, Return Management, Audit Trail: filters by date range, user, action and a search box; columns User, Actions, Performed on, Value, Made on (to the minute); 25 per page. Actions seen: "Data entered changed" (one row per typed cell, with form, copy and cell name and the typed value), "Copy added", "Copy deleted", "CSV data exported" (value is the file name), "CSV data imported" (**one row per file, the file name only, no per-cell rows**). Some rows have a revert icon. Calculated changes are not listed. So typed changes are traceable per cell, but what an import changed can be known only from our own import history and export compare, not from the audit trail.
- **Roll forward (RT-24, looked at, not run):** Return Management, Roll forward opens "Roll forward selected documents" (works on several selected returns) with Roll Forward Settings, all unticked by default: keep GIFI notes, SR&ED project data (T661 part 2), remove donation beneficiary names, keep opening and closing paragraphs, reviewer's name, preparer's name, attached breakdowns, attached spreadsheets, document notes, document details, document label, forms open; comments on cells None, Selected or All. No "conversion" item exists in the return menu.
- **Printed return (RT-11):** see section 3d.
- **Return menu (Actions):** Return Properties (edit properties: assignees and status only, no free text; notes; change preparer profile); Retrieve and Export (T2 Auto-fill service, Notice of Assessment, Import from GIFI, Import the CSV or Excel file, Import and link corporations, Retrieve Web Access Code, Export); Return Management (Copy, Rename, Lock, Manage visibility, Audit Trail, Manage spreadsheets, Roll forward). Lock and Auto-fill not clicked.
- The trial header showed 15 days left on 3 Oct and through day 5.
- **Stale screen, day 5:** two status-bar readings in the walker's notes differ from the export by one digit (08, 10). The export is the record.

## 3c. Diagnostics (days 3 and 5)

- **Panel:** opened from the status bar icon; tabs All, General, Filing, Custom, Reviewed, Not reviewed, Hidden. Severity by icon: Error, Filing error, Warning, Informative (iFirm's Information). Type EFILE means Filing; General is Error, Warning or Informative. Each row is keyed `<code>_<cell id>` (for example `R2000100_IDENT.Ident160`). Prefixes: N, R (filing rules), M (mandatory modification), G (GIFI required item), E (format), P (penalty and interest), O (overridden data). The panel is an iframe with a virtual list (8 rows in the page at a time), so full lists are slow to read; the badge lags (2 lower until the ID form is opened). EFILE stays greyed while Filing errors exist (seen, not tried). Day 3 list: `2026-10-03-day3/diagnostics-probe.md`.
- **Counts right after the GIFI import** (All: General, Filing): 01 22 (10, 12); 02 21 (9, 12); 03 22 (10, 12); 04 20 (8, 12); 05 26 (10, 16; 31 before the import with the hand-typed S3 and S23); 06 25 (12, 13; 27 after linking); 07 20 (8, 12); 08 22 (10, 12); 09 23 (11, 12); 10 22 (10, 12). An empty return shows 23 or 24. The common set: N1, R2000100, R2000032, N18, R2000017, R2000028, R2000299, R2000002, R2000300 (EFILE on ID: corporation type, certification, first year, contact, NAICS, BN, province), M5, M42, M318 (ID), M417 (T183), R1000001, G107, G109, G110, G111 (S100), G122, G123 (S125), R1400002 (S140), R1410102 (S141). New on 05 and 06: G104 (S3 line 500 against the GIFI), R0030006 and R0030007 (S3 rows; caused by a typing slip into column 230, not by a planted fault), O103 (overridden data, also after a link). Lists: `2026-10-05-day5/diagnostics-05.md`, `-06.md` (partial).
- **No diagnostic catches any planted Eglinton fault:** eligible dividends designated above GRIP (05), a capital dividend with no election (05; S3 has no election cell), and the business limit allocated 100,000 + 500,000 against 500,000 (05 and 06, before and after linking; only the form text says "Ensure that the total at line A does not exceed $500,000"). Taxprep's diagnostics are no substitute for our own checks of these.
- **Diagnostics do not print.** No diagnostics page in any of six printed returns (Office copies of 02, 05, 06, 10 and of day 3's Probe; Probe's EFILE copy), and the print "More options" dialog has no such option. The PDF text layer is real text (pdftotext reads it), so code can read printed figures, but not diagnostics. The "Cells with diagnostics" export (codes, or only cell ids?) is untried.

## 3d. The printed return (RT-11, T07)

- The PDF menu has "Print return to PDF" and "Print Notice of Assessment to PDF". Formats, each with a Documents toggle: Client, EFILE, Government (ticked by default), Government paper filed, Office; FED, QC and AB ticks; language; "Override printed date"; "More options": merge PDF files, print date on forms, use the BN as a password, header with tax document description, date, time, another option. Nothing about diagnostics.
- The trial draws a "Do Not Submit" watermark (a drawing, not text). Each print spends one trial PDF, even when the file never arrives (window hidden, section 2).
- Office copy contents in order: filing-instructions letter (with the instalment schedule when instalments are due), Federal Tax Instalments workchart, T183 Corp, T2 jacket, GIFI S100 and S125 (CCH layout), S141, S100 and S125 (CRA layout), S1, then the schedules in use (S3, S4 and the non-capital loss workchart on 05; S8 with its notes on Probe), Corporate Taxpayer Summary: 20 to 33 pages. The EFILE copy is 5 pages: T183 Corp and the EFILE Information status page (T2, T106, T1134, T1135, MR-69, Schedule 89, T2054).
- Page header: `<client code>-T2-<year-end year>-<name>`, year end, name, print date and time; footer `CCH IFIRM TAXPREP IF18 VERSION 2026 V1.2`. File name `<client code>-T2-<year-end year>-<name>-Office.pdf` (02 says 2026).

## 4. What the simulator must imitate

1. The file format of section 2, byte for byte, including the header with the return's own name and GUID on export, the description column filled from the release list, Taxprep's row order, and **the leading apostrophe on every exported negative**.
2. A header it does not read on import: any name or GUID is applied to the return the call names.
3. An empty value or a single space clears an amount or text cell; on a yes or no cell it resets the default `N` with a "replaced" line; `0` stores zero.
4. Cents in an amount cell refused for that row with the trial's wording; the rest of the file imports.
5. Year-start and year-end cells and contact-synchronised cells skipped with no report line; `IFirm.ContactPartner` accepted on import, then wiped to `""` when the return is next opened.
6. Text into a calculated cell accepted, held, exported, not reported.
7. UTF-8 bytes stored as they come (garbled when read as Windows-1252), with no warning.
8. The import report: lines only for cells that held a value, for refused rows, and for unknown ids ("Cell not available.", Form, Description and Box `--`, no id); "Data imported successfully" otherwise; no counts.
9. Filters "entered" (cells with data plus the eight creation and contact cells, `IFirm.ContactID` included), "all input cells" (every cell, empty as `""`) and, for S03, "Select all" (input and calculated cells, unmarked).
10. Copies renumbered down with no gap after a delete; an import to the next copy index creates that copy.
11. Byte-identical exports when nothing changed.
12. Calculated cells (S1 net income, taxable income, Part I tax) changing at once from the GIFI cells: S03 only, from recorded data, no tax engine.
13. Named placeholders for what is still open: an import to a gap copy index, a bad BN imported into `Ident7`, lock behaviour and roll forward (day 6), the diagnostics list (keyed on ids; none in the PDF).

## 5. What the plan should change (the Lead decides)

From day 5 (proposals; amber unless marked):

| Finding | Answers | Clauses | Cards |
|---|---|---|---|
| An import to the next copy index creates the copy | O1, Q21 tail | RT-7: drop "new copies by hand"; a new natural key is written to the next free index read from the latest export, and the next export confirms it; a gap index stays refused | T01 (writer), M00 (natural keys), S00 to S02 (simulator) |
| No safe token cell: ContactPartner is wiped by the contact sync; notes and comments never export or print | O2, Q23 | RT-2: the fallback becomes the rule (no token; staleness by content, RT-14); RT-1: drop the token test, keep BN, year end and GUID | T01 (writes no token), T02 (no token check), simulator |
| `""` resets a yes or no cell to `N`; an unknown id is refused as "Cell not available." with no id | O3, O4 | RT-8 and RT-12: a yes or no cell is "cleared" by writing `N`; RT-26: a refused row cannot be tied to its id from the report (RT-4 already keeps unknown ids out) | T01, F03, simulator |
| The apostrophe is on every exported negative, input cells too; seven settings files exist | O5 | RT-3 and RT-9: name the strip rule | F03 (reader, fault files), T02, every compare (RT-14, RT-19, RT-20) |
| Diagnostics do not print, and "More options" has no such option | O7, RT-17 inputs | RT-17: the trial plan's fallback (read from the "Cells with diagnostics" export or a list the preparer pastes; an unknown code counts as Error until a person classes it). **RULE-2 still says "diagnostics print with the return" (CCH's word); the trial contradicts it. RULE-2's tail lets the trial win, but the Lead should check whether this touches the plain end state (red if so)** | T05 (its title and source change), T07 (the printed return carries no diagnostics) |
| No diagnostic catches eligible dividends above GRIP, a capital dividend with no election, or the S23 over-allocation | O7, O9 | these three checks are ours, in code, never left to Taxprep | T05 note; the tax-rule check cards for dividends and the business limit; M00 maps S3 line 455 `Ttadiv369`, line 510 `Ttadiv365`, S23 rows `MJRAW.SLIPA[n].TtwrawA172` |
| "Import and link corporations" writes about 75 cells that the "Entered" export lists like typed cells | Q25 | RT-14 and RT-15: a class or allowed-list entry for linked-return cells, or every linked return shows dozens of orphans | T02, T07, M00 |
| `IFirm.ContactID` is in every "Entered" export | | RT-13 and RT-15: add it to the creation and contact list | F03, T02, simulator |
| Add return refuses a check-digit-failing BN; the test world's BNs fail on purpose, so `Ident7` is empty in every test return | | RT-1's BN check needs a rule for an empty `Ident7` (refuse with a reason, or flag for a person); the other way out, test BNs that pass the check digit, could match a real business (decision 0003: red) | T02, the test-world cards |
| Exports and prints arrive only while the window is visible | | none (operations) | T02 and T07 ops wording; walker rules |
| S3, S4, S23 and jacket ids captured as structure files | O6 (part) | RT-21, RT-22 | M00; `taxprep-cells.json` |

From days 1 to 3, done on branch `claude/trial-findings-1` (amber; rows in `reports/trial-findings-1.md`):
- Blueprint 04: RT-1 (identity read from the export: BN cell, year-end cell, header GUID; Taxprep checks nothing), RT-2 (token still open; a content test if no safe cell), RT-3 (the export's own shape), RT-4 (writer refuses non-input ids), RT-7 (copies renumber; copy lookup from the latest export; new copies by hand until shown), RT-8 (clear by an empty value), RT-9 (the fixed settings named, Windows-1252), RT-10 (one "Select all" filter), RT-12 (empty clears), RT-13 (contact cells skipped), RT-15 (creation and contact cells on the allowed list), RT-20 (byte equality), RT-21 (internal ids), RT-22 (two lists; copies must exist), RT-23 (imitate the trial), new RT-25 (whole dollars and the rounding line) and RT-26 (the report is not proof). RULE-2's tail notes that the trial wins over the help.
- Cards F03 (re-carded: needs a fresh spec), S00 (re-spec), S01, S02, S03 (waits on "final"), B04; M00's slice note says what its card must carry.

Still for the Lead:
- Sample clients: add the balance-sheet families, Schedule 1, S3 and S23 ids to `taxprep-cells.json` with `confirmed: true`, extend the writer, and regenerate the imports (the Schedule 100 rounding plug then reaches the file).
- Card note for T02: the lock filter must include `IDENT.Ident7`, `IDENT.Ident121` and the calculated review lines. A second export at lock as a cross-check would change end state item 4 (one export), so it is red in `reports/cards-phase2.md` and not used; the trace rests on our own import history, and tax-choice cells are always cited.
- Card note for T05 and the RT-17 list: key diagnostics on code and cell id (`<code>_<cell id>`); Informative is Information; an unknown severity counts as Error.
- Asking CCH whether `IFirm.*` cells are ever transmitted is now moot for the token (the cell does not hold it).

## 6. Still open (days 4 and 6, and leftovers)

- Answered on day 5: O1 (import adds the next copy), O2 and Q23 (no token cell), O3 (text clears, yes or no resets to `N`), O4 (unknown id refused, no id echoed), O5 (settings files), O9 (all ten companies), dividend designation (S3 line 455), Schedule 23 on the Eglinton pair, the "Track changes" export, print "More options", diagnostics on the PDF (none).
- Day 6: Lock and what it refuses; changes after lock; the check export and byte compares two days apart; "Overridden", "Track changes" and "Imported" around a typed-over cell; the Audit Trail around lock; roll forward and its map (RT-24); whether linked returns roll together.
- Day 4: Auto-fill, structure only (Zo).
- Leftovers: the "Cells with diagnostics" export (codes or only cell ids?) and full diagnostics lists (virtual list); the full severity list and what the Reviewed tab does; why `IDENT.Ident492` is skipped; an import to a gap copy index; a bad BN imported into `Ident7`; S8CCA and S50 in "Select all" filters (and whether CCA claimed `...FED.Ttw08cA22` is an input cell); S53 (GRIP); the LW help wording about filing; the "Imported" and "Rolled forward" exports.
- Part A: the rest of the 395 forms (fallback in the trial plan).
