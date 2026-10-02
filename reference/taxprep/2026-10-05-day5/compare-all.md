# All ten round trips compared (day 5, 1 Oct 2026), release 2026.20.198267 (PDF footer: CCH IFIRM TAXPREP IF18 VERSION 2026 V1.2)
Import: `reference/sample-clients/<nn>-*/taxprep/import.csv` (made-up clients; the outbox copies are byte-identical to the repo files; staged by script on the iframe file input, CR stripped in staging, decision 0016 Z16-3). Export: default filter "Entered this year or last year", default settings (Comma, -123, Period, no thousands), raw files `inbox/d5-<nn>-entered.csv`. Compared cell by cell by id on Current Year and Last Year (script in the helper's scratchpad; method as `2026-10-02-day2/compare-07.md`).

## Per client
| # | Return | Rows imported (families) | Back identical | Differ | Missing | Extra in export | Export bytes |
|---|---|---|---|---|---|---|---|
| 01 | Maple Ridge Consulting Inc. (Test) | 15 (2 S1599, 1 S8299, 12 S9367) | 15 | 0 | 0 | 8 | 1879 |
| 02 | Halton Haulage Ltd. (Test) | 16 (3 S1599, 1 S8299, 12 S9367) | 16 | 0 | 0 | 8 | 1970 |
| 03 | Bluewater Renovations Inc. (Test) | 19 (2 S1599, 1 S8299, 3 S8518, 13 S9367) | 19 | 0 | 0 | 8 | 2213 |
| 04 | Lakeshore Eats Inc. (Test) | 20 (1 S1599, 2 S8299, 1 S8518, 16 S9367) | 20 | 0 | 0 | 8 | 2295 |
| 05 | Eglinton Holdings Inc. (Test) | 11 (2 S1599, 3 S8299, 6 S9367) | 11 | 0 | 0 | 27 | 3701 |
| 06 | Eglinton Retail Ltd. (Test) | 17 (3 S1599, 2 S8299, 3 S8518, 9 S9367) | 15 | 2 (apostrophe only) | 0 | 85 | 6903 |
| 07 | Riverdale Rentals Inc. (Test) | 13 (3 S1599, 1 S8299, 9 S9367) | 13 | 0 | 0 | 8 | 1649 |
| 08 | Queen West Design Studio Inc. (Test) | 22 (3 S1599, 2 S8299, 17 S9367) | 21 | 1 (apostrophe only) | 0 | 8 | 2516 |
| 09 | Scarborough Robotics Labs Inc. (Test) | 13 (1 S1599, 1 S8299, 11 S9367) | 13 | 0 | 0 | 8 | 1708 |
| 10 | Danforth Cleaning Co. Ltd. (Test) | 13 (2 S1599, 1 S8299, 10 S9367) | 13 | 0 | 0 | 8 | 1698 |
| | **All** | **159** | **156** | **3** | **0** | | |

Every imported cell came back. With one leading apostrophe stripped from negatives (F03's reader rule), **159 of 159 are identical**; no value changed, none dropped, none rounded. Last Year stayed empty on every row (the writer sends none).

## Differences, with cause
- 06 `GFBGII[1].GFGIJ.Ttwgij121` (GIFI 8231, foreign exchange gains/losses): sent `-1299`, back `'-1299`.
- 06 `GFBGII[1].GFGIK.Ttwgik92` (GIFI 8500, closing inventory): sent `-51500`, back `'-51500`.
- 08 `GFBGII[1].GFGIJ.Ttwgij121` (GIFI 8231): sent `-818`, back `'-818`.
- Cause: the default "-123" export setting writes a leading apostrophe on every negative (day 3 saw it on a calculated cell; day 5 shows it on imported input cells too). The import side takes a plain `-1299` without complaint. So: the writer writes plain minus, the reader strips one apostrophe, and any compare (RT-14, RT-19, RT-20) compares after that strip.

## Extra cells in the export (not in the import)
- **On every return, 8 creation and contact cells:** `IDENT.Ident120` (year start), `Ident121` (year end; both match the README table, so 02 shows 2025-04-01 to 2026-03-31, 03 2024-07-01 to 2025-06-30, 08 2024-10-01 to 2025-09-30, 09 2025-04-15 to 2025-12-31), `Ident311` (name), `Ident230` (language, `1`; description ends `|`English|`Français` with byte E7), `Ident451` (Taxprep's client code, not the sample number: 01 is 4, 02 is 6 and so on), `Ident492` (`N`, no description), `IFirm.ContactPartner` (`""`), **`IFirm.ContactID`** (equal to the client code). ContactID is new since day 2: Riverdale's export grew from 1622 to 1649 bytes by exactly that row. `IDENT.Ident7` (BN) is absent everywhere: Add return refused the sample BNs (check digit), so the cell is empty.
- **05, 19 more, typed by hand in run 5C (not imported):** S3 `FDDIV.Ttadiv365` (line 510, capital dividend, 30000), `Ttadiv369` (line 455, eligible designated, 25000), `Ttadiv377` (line 450, 25000); `FDDIV.SLIPA[1..3].TtadivA1/A3/A5/A6/A7/A11` (dividends received rows); S23 row `MJRAW.SLIPA[1].TtwrawA172` and `TwinTtwrawA172` (business limit allocated, 100000). Note: the walker put the received dividends in column 230 (`A6`, "Non-taxable dividends under section 83") as well as 240 (`A7`); that typing slip, not a planted fault, is what fires R0030006 and R0030007.
- **06, 77 more:** `MJRAW.SLIPA[1].TtwrawA172` and `TwinTtwrawA172` (500000, typed) and 75 cells of `MJRAW.SLIPA[2].*` written by "Import and link corporations" from 05 (name `A1`, association code `A16`, year start `A196`, year end `A74`, business limit `A172` 100000, and 66 `Ghost...` cells, mostly `0` or `0.000000`, one `6000000`). The link import's cells count as "entered" and carry no sign of where they came from.
- S23's per-row cells are `MJRAW.SLIPA[n].Ttwraw<x>` (Schedule 23 workchart rows), not `FDASC.*`: this closes run 5C's open "S23 row cell ids".

## Header, bytes, row order
- Header back as `[<return name>|0|0|<return GUID>],"Current Year","Last Year",""` on all ten; the name exact; the GUID the return's own (we send zeros).
- Windows-1252 (the only high byte is E7 in `Français`), CRLF after every line including the last, every value quoted, description filled by Taxprep (`GIFI code NNNN - <name>` on balance-sheet rows, `GIFI code NNNN - Amount - <name>` on income rows).
- Row order is Taxprep's form order: GFGBA, then GFBGII (GFGIJ, GFGIK, GFGIL), then FDDIV (05), IDENT, MJRAW, IFirm.

## Calculated results (from `d5-<nn>-s1.csv`, the "d3 all cells" filter; status bar in the notes)
Net income for tax `FDONE.Ttwone66`: 01 156991, 02 72566, 03 198514, 04 47741, 05 1150, 06 153959, 07 6737 (same as day 2), 08 151647, 09 `'-28940`, 10 228558. The run notes' status-bar figures for 08 (151,847) and 10 (228,538) differ from the export by one digit: a reading slip; the export is the record.

## What this settles
- The import format of `make-csv.mjs` works on all ten made-up clients, including a non-calendar year (02), a year ending before the trial year (03, 08) and a short first year (09): no refused row, no silent drop.
- The import report said only "Data imported successfully" on the nine new returns (no rows, no counts) and listed "replaced" rows on Riverdale (cells filled on day 2): RT-26 holds; only this compare proves the import.
