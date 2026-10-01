# Trial script: day 1b (finish the cell map, two probes) and day 2 (the round trip)

For the walker (Sonnet 5.5, Chrome profile "Ashbridge Test" only). Written 1 Oct 2026 by the Opus helper from `reference/taxprep/2026-10-01-day1/notes.md`. Release seen: CCH iFirm 2026.20.198267; product "T2 Corporate 2024 and later"; the trial ends about 16 Oct 2026. Labels: [fact] seen on day 1; [guess] to confirm.

## Stop rules (unchanged from day 1; apply to every step)
Stop, write what the screen says, and ask Zo if a screen asks for: payment, a card number, a licence key, a quote or a purchase; CRA credentials, My Business Account, Represent a Client, TaxprepConnect or Auto-fill (day 4, Zo only); a real client, a real firm account, or any name not ending "(Test)"; a transmit or e-file button (never press it).
Never click: Transmit, EFILE, Send, Submit, Auto-fill ("Import data using the T2 Auto-fill service"), Notice of Assessment, Retrieve Web Access Code, Request a quote, Free live demo, Digital signature, Email, Portal, Invite, Publish, Share, Sync, Roll forward (day 3), Lock (day 3), PDF (metered: 100 left). Leave every email, phone, address and business number field blank. No Settings, Firm, Users, Billing or Subscription pages. Delete nothing this trial did not create. Never type a password. If the session signs out, stop and ask Zo.
Timeboxes: the trial has 15 days, so hours are affordable, but stop any one technique after 45 minutes without progress and move to the next. Stop work by 14 Oct whatever is left (two days margin before the end).

## Captures
Folder `reference/taxprep/2026-10-NN-day1b/` (then `-day2/`) with `exports/`, `screens/`, `notes.md`. Raw downloads go to `C:\Users\User\Documents\taxprep-trial\inbox\` first. Exports of made-up sample returns hold only made-up values, so the raw file may be committed after checking every name ends "(Test)" and there is no email; otherwise commit the structure copy (values replaced by `VALUE`). The export lists empty cells [fact], so **an export of a filter is the cell list**: no hand-copied `cells/*.txt` files are needed.
Tools [fact, day 1]: the trial is a same-origin iframe; page-text tools see nothing, `document.querySelector('iframe').contentDocument` works for reading and JS clicks; real mouse clicks only at full-size screenshots.

## Part A. Day 1b: finish the cell map (about 3 to 5 hours)

### A1. Get the full form list first (try in order; stop at the first that gives all 395)
1. Network: open the Network reader, then open the Forms popup (Forms button) in return 1. Look for a JSON response listing forms (jump code, name, type). Save it as `exports/forms-all.json` if it holds no values. This may also reveal a per-form cell dictionary request: if opening a form loads a JSON of cell ids, save one sample (`exports/form-def-S125.json`) and note the URL pattern. That would give every cell id with no clicking.
2. Component data: in the iframe, inspect the Forms grid and the filter dialog's Form combo; try reading the widget's data source in JS (for example `contentWindow.$(el).data()` for Kendo, `DevExpress.ui.dxDataGrid.getInstance(el)` for DevExtreme, or an Angular `__ngContext__`), and log the first 3 items to see the shape.
3. Show more rows: zoom the tab out (Ctrl and minus, to 50%) and resize the window to its tallest, so each virtual page renders more rows; then real wheel scrolls (the computer tool's scroll action) over the list, 3 per page, 16 pages, reading rows by JS after each scroll. Dedupe by jump code.
4. Keyboard: click one row, then Page Down or Down arrow repeatedly; read rows by JS after each press.
5. Search: type each letter or prefix (S1, S2 ... S9, T, CO, ON, A ...) in the Forms search box and read the short result lists by JS.
Save `exports/forms-all.csv` (jump code, form name, jurisdiction, type). Success: 395 rows, or the count reached and the method used.

### A2. Add the forms to filters by typing, not scrolling
The Form combo in the custom filter dialog takes type-ahead [fact: "S125" found "S125 - Income Statement Information"]. Per form: click the combo, type the jump code, pick the matching entry, JS-click "Select all input cells", JS-click "+ Add selected cells". Read the "Selected cells" count by JS if shown; otherwise note "added".
Use three filters, not one, so a failure loses little and each export stays readable: `map 1 core`, `map 2 group`, `map 3 rest`. Click "Add filter" after the first form of each to save it, then add the rest by editing it (three dots, Edit [fact]) and saving every 5 forms. Leave the day 1 `all input cells` filter as is (it proved the ID cells are not duplicated in the export).
- `map 1 core` (the build imports or checks these first; from blueprint 04 and the ten sample clients): ID, S100, S101, S125, S141, S1, S8, S50, S3, S4, S6, S7, S9, S23, S53, S89, S11, S24, S55, S500, S510. Also the T2 jacket form if it has its own jump code (search "200" and "T2"). If S546 is listed, add it; if not, record that.
- `map 2 group`: S2, S10, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S25, S27, S31, S88, S91, S97, T106, T5 slips and summary, and every remaining form whose jurisdiction is Federal or Ontario.
- `map 3 rest`: everything else in the A1 list (other provinces and control forms), only if time is left today; otherwise on a buffer day.
For a jump code that is not found, try the number alone and the name; record misses in notes.md. For each form note whether "Select all input cells" found any cells, and whether the form has tables or repeating copies (look for `[n]` in the export later).
Export each map filter (Actions, Export..., CSV, all defaults, filter = the map filter) from return 1 (Riverdale). Save as `exports/map-1-core.csv` and so on. Success: every map-1 form has rows in its export, or a note saying why not.

### A3. Check what day 1 left open
6. Open returns 2, 3 and 4 and check the custom filters are listed there (help says shared). Record yes or no.
7. Read the Cell details pane (right panel) for three cells: ID line 060, an S125 cell, an S8 cell. Record every field it shows; if it shows the export identifier (IDENT.Ident120 style), every later lookup gets cheap.
8. Look at the filter dialog's "Convert" tab: record what it converts (no action).

## Part B. Day 1b: the GIFI probe (how GIFI amounts are identified)
Day 1's S125 filter gave 23 header and total cells, but no line amounts (8141 rental revenue and so on). Find their identifier in Riverdale Rentals Inc. (Test), using its own made-up answer-key figure, so the day 2 round trip is not disturbed.
9. Open S125 in PREPARE. Find where a GIFI line is entered (a table with a code column and an amount column [guess]). Record the layout, then type by hand: code 8141, amount 48600.00. Same on S100: code 1002, amount 7693.02.
10. Export with the built-in filter "Entered this year" (all defaults). Save as `exports/gifi-probe-typed.csv`. Record the identifiers of the new rows: is the GIFI code a value in a row (for example `GIFIS125[n].Code` and `.Amount`, matched by copy number), or part of the identifier (for example `...Ttw8141`)?
11. Rebuild the custom filter idea: now that the table has a row, try "Select all input cells" on S125 again and see whether the table cells are offered.
12. Import probe. Make `gifi-probe.csv` in the inbox: the header line copied byte for byte from today's export of return 1, then one row per identifier found in step 10, changing only the amounts to 48600.01 and 7693.03. Windows-1252, CRLF, comma, all quoted, same as the export. Actions, "Import the CSV or Excel file", pick Riverdale Rentals Inc. (Test). Before the second "Import", record every option under "Options - CSV", the taxpayer picker and the "Exclude the values associated with the synchronized contact information" box with its default (the day 1 step F28 capture). Then import. Capture the import report text exactly.
13. Export "Entered this year" again (`exports/gifi-probe-imported.csv`) and compare: both values changed? new rows added instead? the "Imported" built-in filter lists them? Then put the two values back to 48600.00 and 7693.02 by hand and confirm by one more export.
14. If the CSV import cannot reach the GIFI lines: open Actions, "Import from GIFI", record the dialog (file types it accepts, options) and cancel. Note it as the fallback route for GIFI.
15. Write in notes.md, one sentence each: the GIFI identifier shape; whether the row is keyed by GIFI code or copy number; whether import replaced or added. Push captures on a `claude/` branch and stop.

## Checkpoint (between day 1b and day 2; not the walker)
The Opus helper reads the captures; a worker puts the confirmed identifiers and the export header in `reference/sample-clients/lib/taxprep-cells.json` (confirmed true), regenerates the import CSVs in the export format, and runs `make-csv.mjs --check`. Day 2 starts only when the to-do says so. Cells with no confirmed identifier are left out of the file and listed.

## Part C. Day 2: the round trip and the six questions
Create one more return first: `Probe Co. (Test)`, 2025-01-01 to 2025-12-31, nothing else. Every destructive probe (clears, deletes, encodings) runs there, so Riverdale stays clean for the trace.

### C1. Round trip for company 1, Riverdale Rentals Inc. (Test) (Zo's phase 0 gate)
16. Copy `reference/sample-clients/07-riverdale-rentals/taxprep/import.csv` (the regenerated one) to the inbox. Import it into Riverdale as in step 12. Capture the whole import report (`screens/c1-import-report.txt`): rows read, rows imported, every refusal with its row.
17. Export with `map 1 core` and with "Imported", all defaults (`exports/rt-07-map1.csv`, `exports/rt-07-imported.csv`).
18. Compare cell for cell with a small script in the scratchpad (not committed): every import row must appear with the same value. List each mismatch: missing, different value, different format (decimals, negatives, dates, Y/N). Write `reference/taxprep/2026-10-NN-day2/compare-07.md`: counts and every mismatch.
19. Re-export the same filter again with nothing changed: are the two files byte-identical apart from the file name? (RT-20 depends on it.)
Success: every row matches, or every mismatch is explained.

### C2. The six open questions (each in Probe Co. (Test) unless said)
20. **Clearing a cell (RT-8, RT-12).** Type a value in one text cell, one amount cell and one Y/N cell. Import three files, one at a time: the cell with `""`; the cell with a single space; the cell with `0`. Export after each. Record which, if any, clears the cell.
21. **Copy numbers after a delete (RT-7).** On S8 add three classes by hand (1, 8, 10) with made-up amounts. Export. Delete the class 8 copy. Export again. Do the copy indexes renumber (class 10 becomes `[2]`) or keep gaps? Then import a row for `[3]` and see where it lands.
22. **Calculated cells in a filter (RT-10).** Build `core all cells` with "Select all" (not input only) on the T2 jacket, S1, S100, S125 and S8 in Riverdale after C1. Export it. Do calculated lines (net income, taxable income, tax payable, totals) come out with values? Can the filter also pick review lines such as taxable income and Part I tax?
23. **A cell never sent to CRA, to hold our import tag (RT-1, RT-2).** List candidates: the `IFirm.*` cells (day 1 saw `IFirm.AutoSync`), return Notes, Label and Details, any memo or workchart cell. For each, write a made-up tag `ASH-TEST-0001` in Probe Co., export, and check it comes out in the CSV. Read the Cell details pane and help for "not transmitted" wording. Do not open EFILE to check. Record which candidates export, and what says each is not transmitted.
24. **Encoding (accents).** Make two one-row files setting the S125 operating name to `Café Probe (Test)`: one in Windows-1252, one in UTF-8 (with and without BOM). Import each, export, and read the bytes of the exported é (E9 expected). Record which file imported cleanly and which garbled.
25. **Cells Taxprep fills by itself from the GIFI (orphan risk, RT-14).** In Riverdale after C1, compare `core all cells` with the import: list every cell that has a value, was not imported, and is not a total. In particular: does Taxprep fill S1 net income per books from S125 by itself? If yes, our S1 net-income row writes over a calculated cell (RT-4) and must be dropped from the mapping.

### C3. Wrap up day 2
26. Export settings: re-export one filter with each non-default option once (semicolon, tab, (123), comma decimal, thousands comma) and save them as `exports/fmt-*.csv`. They become the parser's refusal set (RT-9).
27. Header questions: in Probe Co., import the C1 file with (a) the help's 3-field header `[name|0|0]`, (b) a wrong name, (c) a wrong GUID. Record what each does: refused, warned or ignored. RT-1 depends on (b) and (c).
28. notes.md: every answer above in one line, every [guess] and what happened, minutes per part. Push on a `claude/` branch. Stop. Day 3 starts after the Opus helper's read.

## The rest of the trial (15 days, re-planned)
Day 3 (F3 work, lock), day 4 (Auto-fill, Zo), day 5 (all ten), day 6 (after lock), day 7 (wrap-up) stay as in `plan/taxprep-trial-plan.md`. The extra days are buffer: `map 3 rest`, the QBO track, and redoing any failed step. PDFs: at most 30 before day 5, so all ten can print.
