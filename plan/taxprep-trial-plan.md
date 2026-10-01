# Taxprep trial week: the plan

The CCH iFirm Taxprep Pro trial lasts one week (decision 0008, Z8-6). In that week we prove everything the build assumes about Taxprep, on made-up companies, and capture enough that the build never needs the trial again. Zo starts the trial only when the to-do says "ready".

## Ready before day 1 (target: Thu 1 Oct, evening)
- The ten sample clients in `reference/sample-clients/`, each with its import CSV (GIFI plus the schedule inputs it needs) and its answer key.
- A separate Chrome profile holding only the trial and the QBO test companies: no real client account signed in (Z8-9).
- The capture folder `reference/taxprep/` (structure and made-up values only, never real values).
- The walk runs on Zo's laptop, in his hotspot hours, by one Sonnet 5.5 walker with Chrome; an Opus 5.5 helper reads each day's captures and adjusts the next day's script.

## Day by day
1. **The cell map.** Create returns for three sample companies (a simple one, the associated pair, the shareholder-loan one). Set year start and end by hand (the CSV import ignores them). Build the saved filter "all input cells" and export it: the identifier list per form is the backbone of the mapping. Record the Taxprep release, the CSV syntax as the trial shows it, and the export settings.
2. **The round trip (Zo's phase 0 gate).** Import our CSV for company 1 (GIFI and Schedules 1, 8, 50, 100, 125 inputs). Read the import report. Export all input cells and compare cell for cell. Then answer the six open questions: can a CSV import clear a cell; what happens to repeating-form copy numbers after a delete; can a saved filter export calculated cells; which cell is never sent to CRA (to hold our import tag); which text encoding the import expects (accents); which cells Taxprep fills by itself from the GIFI (the orphan risk).
3. **The preparer's work in Taxprep (F3).** Make typical tax choices in Taxprep (CCA classes, a dividend designation, the business limit shared on Schedule 23 for the associated pair). Lock, export, print with diagnostics. Can every typed cell be told apart in the export? Collect the diagnostics list and which ones block e-filing. Try roll-forward to the next year, and conversion from another program's file if the trial allows.
4. **Auto-fill (Zo).** Script below.
5. **All ten companies, plus the day 3 leftovers.** Script below.
6. **Changes after lock, the check export, roll forward (F4).** Script below.
7. **Buffer and wrap-up.** Redo whatever failed. Write `reference/taxprep/FINDINGS.md`: the cell map, the answers to the six questions, the diagnostics list, what the simulator must imitate, and what the plan should change.

Status on 1 Oct: days 1, 2 and 3 run (day 3 partial: `reference/taxprep/2026-10-03-day3/notes.md`, "Stopped here"). Interim findings in `reference/taxprep/FINDINGS.md`.

## Days 4 to 6: the walker scripts

### Order and dates
Days 5 and 6 need no one; day 4 needs Zo. Proposed order: **day 5 on Fri 2 Oct, day 4 on Sat 3 Oct, day 6 on Sun 4 Oct** (day 6 then compares exports made two days apart). The Lead tells Zo about day 4 in `plan/TODO-ZO.md` on **Fri 2 Oct** at the latest. If Zo picks another day, day 4 moves; days 5 and 6 do not wait for it.

### Open questions: short labels
FINDINGS.md section 3 gives Q20 to Q27. Its section 6 ("Still open") has no ids, so this plan labels its bullets in order:
- **O1** Q21 tail: can an import add a new copy (a row to `[3]`)?
- **O2** Q23: the token cell, and the `IFirm.ContactPartner` read-back.
- **O3** Clearing text and yes or no cells by import on a non-contact cell; why `IDENT.Ident492` was skipped.
- **O4** What the import does with an identifier that does not exist.
- **O5** Step 26: one export per non-default setting (F03's fault files).
- **O6** The T2 jacket, Schedules 3, 4, 23, 50 (and 53), the rest of S8, by "Select all input cells" and "Select all" filters (RT-10, RT-22).
- **O7** Day 3 leftovers: dividend designation, Schedule 23, Eglinton diagnostics, the "Track changes" filter, print "More options", whether diagnostics print (RT-17); roll forward (RT-24); conversion.
- **O8** Auto-fill structure (day 4; feeds CK-12 and RT-14).
- **O9** All ten companies: import errors and diagnostics.
- **O10** Changes after lock and the check export (RT-19, RT-20).

### Rules for every walker run (days 5 and 6)
- **One walker at a time**, Sonnet 5.5, in the "Ashbridge Test" Chrome only; its window on screen and not covered (iFirm stops drawing when hidden). Each day is split into runs of about two hours; a fresh walker per run; an Opus 5.5 helper reads the notes after each run and adjusts the next run.
- **Write notes as you go**, after every step, to `reference/taxprep/<day folder>/notes.md` (the output channel truncates at about 1,000 characters, so nothing lives only in the chat). Day folders: `2026-10-04-day4`, `2026-10-05-day5`, `2026-10-06-day6` (trial-day names, as before). Each note line: step id, what was done, what was seen, success yes or no. Record the platform release and both trial counters (days left, PDFs left) at the start and end of every run.
- **Files:** downloads land in `C:\Users\User\Downloads`; copy only your own files to `C:\Users\User\Documents\taxprep-trial\inbox` with a `d5-` or `d6-` prefix. Into the repo go only made-up values (sample clients and Probe Co.) or structure copies (values replaced by `VALUE`, as in `2026-10-03-day3/exports/s8-s1-after-cca-structure.csv`). Never commit; the Lead commits.
- **Imports** go through the import dialog's file picker only (a JS-staged import was blocked). Before each run the Lead copies the files the run needs to `C:\Users\User\Documents\taxprep-trial\outbox\`.
- **Downloads** need a real mouse click on the return bell's Download link (the blue bell in the return header, not the firm bell at top right). The "Untitled" tab that opens can be left.
- **Never:** click EFILE, transmit, Request a quote, Free live demo, the Auto-fill item, or anything that sends, invites or emails; never type a password; never open a return or contact whose name does not end in "(Test)" (Probe Co. (Test) included).
- **Export settings** stay at the defaults (Comma, -123, Period, no thousands) except in step 5D-4.

**If the Chrome tab group vanishes** (as on day 2 and day 3):
1. Call `tabs_context_mcp`. If the group is there, carry on.
2. If not, call `list_connected_browsers`. If one browser is listed and it is the "Ashbridge Test" one, `select_browser` it. If two are listed and you cannot tell which, run `switch_browser` so Zo picks (**needs Zo**; if nobody picks within 10 minutes, stop).
3. Open a new tab and go to the returns list (path `/taxcan/products/2202601/returnsList` on the iFirm site the profile already uses).
4. If the page shows the iFirm sign-in: **stop.** Never type a password. Write "Needs Zo: sign in to iFirm in the Ashbridge Test window" and the step you reached.
5. If the page loads but nothing draws (`document.visibilityState` is `hidden`): **stop** with "Needs Zo: put the Ashbridge Test window on screen".
6. A second loss in the same run: stop, even if recovery would work. The next run picks up at the step in the notes.

**Stop at once and write notes** if a screen asks for payment, a licence, a subscription, a quote, CRA credentials, an EFILE number or anything real; if a real client's name appears anywhere; if the trial shows as expired; or if the PDF counter is below the floor below.

**PDF budget (trial counter, 99 left after day 3):** day 4: 0; day 5: at most 6; day 6: at most 3. Floor: never print when the counter shows fewer than 85. Only Office copy unless the step says otherwise. Read the counter before and after each print and note both.

### Day 4: Auto-fill (Zo only), target Sat 3 Oct
**Goal.** See what Taxprep's T2 Auto-fill puts into a return: which cells, which forms, which year column, which formats, and how the export filters class those cells. Keep structure only, never values (decision 0008, Z8-7). Answers O8; feeds CK-12 (opening losses, RDTOH, GRIP, capital dividend account from Auto-fill), RT-14 (what class an Auto-filled cell gets: imported, rolled forward or orphan) and the Q25 orphan risk.

**Before (the Lead, Fri 2 Oct):** tell Zo in the to-do; make sure no walker runs on Sat 3 Oct; a helper writes `reference/taxprep/tools/strip-values.mjs` (reads a Taxprep CSV, drops the header and the file name, writes id, description, current filled Y or N, last filled Y or N and a shape: whole dollars, negative, date, Y or N, rate, short text, long text; prints only counts) and tests it on the day 3 Probe export.

**Zo's steps (all need Zo; about 30 minutes; no walker, no AI in the browser):**
1. Open the "Ashbridge Test" Chrome, Taxprep, T2 Corporate. Check no walker is working in it.
2. Add return: your chosen corporation, its business number, and the tax year you want Auto-fill to fill. Label: `AF test`.
3. In the return: Actions, Retrieve and Export, "Import data using the T2 Auto-fill service". Follow the screens. If it asks to set up the firm's CRA access, that is your call. If it asks for payment or a licence, stop and write "4: stopped at payment" in chat.
4. Jot down, with no numbers or names: what each screen asked, which years and which kinds of data it offered, what you ticked (tick everything it offers), any error.
5. When it has finished: Actions, Export, CSV, keep the default settings. Do it three times, once per filter: "Imported", "Entered this year or last year", "Edited after AFR/TDD import". Download each from the blue bell in the return header.
6. Move the three files from Downloads into `C:\Users\User\Documents\taxprep-trial\autofill\` (make the folder). Never into the GitHub folder.
7. Optional: Actions, Audit Trail; note only the names in the Actions column for the Auto-fill (no values).
8. Delete the return (Actions, Other, Delete), empty the recycle bin if it shows it there, and delete the contact it created (Contacts).
9. In chat: `4 done`, plus your notes from step 4 and 7.

**What the Lead's helper records afterwards (never opens the raw files):**
- Runs `node reference/taxprep/tools/strip-values.mjs` on each of the three files into `reference/taxprep/2026-10-04-day4/autofill-<filter>-structure.csv`, then deletes the three raw files and the folder. It reads only the structure files.
- Writes `2026-10-04-day4/notes.md`: Zo's step 4 and 7 notes; filled cells per form family; which go to Current Year and which to Last Year; which forms beyond the jacket (S9, S23, S50, S53, S89, loss continuity, instalments) are touched; whether the "Imported" filter holds the Auto-fill cells and what "Edited after AFR/TDD import" means; overlap with the cells our import writes (`lib/taxprep-cells.json`), since an import would overwrite them; the cells CK-12 needs and whether Auto-fill fills them; new ids not on any release list seen.
- Adds the findings to FINDINGS.md at the next interim rewrite.

**Stop conditions:** Zo stops at any payment or licence screen. If the Auto-fill item is greyed or fails, Zo notes the message and deletes the return; the fallback below applies.

### Day 5: all ten companies and the day 3 leftovers, target Fri 2 Oct
**Goal.** Import all ten sample clients and record every import message and every diagnostic; finish day 3's leftovers on the Eglinton pair; close the probe questions on Probe Co. (Test). Answers O9, O7 (dividend designation, Schedule 23, Eglinton diagnostics, "Track changes", print "More options", diagnostics on the PDF), O1, O2, O3, O4, O5, O6; Q21 tail and Q23; RT-17 inputs.

**Before (the Lead):** if time allows, add the balance-sheet families and Schedule 1 ids to `taxprep-cells.json` and regenerate the imports (FINDINGS section 5, "Still for the Lead"); otherwise use the files as they are and note the commit. Copy the ten `reference/sample-clients/<nn>-*/taxprep/import.csv` files to the outbox as `<nn>-import.csv`, plus the probe files of step 5D (made-up, small).

**Run 5A: create and import clients 01 to 05.**
1. Returns that exist (Maple Ridge 01, Eglinton Holdings 05, Eglinton Retail 06, Riverdale 07): reuse; note their current state. For each missing one, Add return with the exact name from `profile.md`, the year start and end from the README table (02: 2025-04-01 to 2026-03-31; 03: 2024-07-01 to 2025-06-30; 09: 2025-04-15 to 2025-12-31), and the business number from `onboarding.json`. The sample BNs fail their check digit: record whether Add return refuses it; if it does, leave it blank and note it (RT-1 reads identity from the export).
2. For each of 01 to 05: Actions, Import the CSV or Excel file, pick the return in Taxpayer selection, pick `<nn>-import.csv`. Copy the import report word for word into the notes.
3. Export twice with the default settings: "Entered this year or last year" and the saved "d3 all cells" (S1 + S8 + S8CCA, Select all). Copy to the inbox as `d5-<nn>-entered.csv` and `d5-<nn>-s1.csv`.
4. Diagnostics panel: counts by severity (Error, Filing error, Warning, Informative); write out in full only codes not already in `2026-10-03-day3/diagnostics-probe.md`, in its format. On client 01 also export the "Cells with diagnostics" filter once and note whether it carries codes or only cell ids.
5. Print Office copy of 02 (non-calendar year): 1 PDF.

**Run 5B: clients 06 to 10.** Steps 2 to 4 of run 5A for 06 to 10 (create 08, 10 first if missing). Print Office copy of 10 (the messy file): 1 PDF.

**Run 5C: the Eglinton pair (05 holding, 06 retail; see their `profile.md`).**
1. Eglinton Holdings, Schedule 3: dividends received from Eglinton Retail (connected, $60,000 on 30 Jun and $40,000 on 15 Dec, taxable) and portfolio eligible dividends $11,800. Dividends paid: $25,000 on 20 Dec designated eligible, $30,000 capital dividend on 20 Nov. Record each cell id (Tools, Copy cell ID), how the eligible designation is made (S3 line, S53 or a yes or no cell), and which diagnostics fire (the planted fault: eligible above GRIP; capital dividend with no election).
2. Schedule 23 on both returns: 05 claims $100,000 and 06 claims $500,000 of the business limit (the planted inconsistency). Record the cell ids and whether either return warns. Then open Actions, Import and link corporations: if its list shows only "(Test)" returns, link 05 and 06 and note whether a diagnostic now catches the over-allocation; if any other name shows, cancel.
3. Build a custom filter "d5 schedules", Select all input cells, on the T2 jacket, S3, S4, S23, S50, S53 and S8CCA; and a second "d5 schedules calc" with Select all on the same forms. Reload the page, export both from 05 and 06. Structure copies to `2026-10-05-day5/exports/schedules-input-structure.csv` and `schedules-all-structure.csv`.
4. Diagnostics list in full for 05 and for 06 (format of `diagnostics-probe.md`), as `diagnostics-05.md` and `diagnostics-06.md`.
5. Export the "Track changes" filter from 05. Note what it holds compared with "Entered this year" and "Overridden".
6. Print 05: open "More options" first and write down every option. If one prints diagnostics, turn it on. Office copy: 1 PDF. Print 06 the same way: 1 PDF.

**Run 5D: probe questions on Probe Co. (Test).**
1. O1: import one row `CCACat.FD08C[3].FED.Ttw08cA1,"10","",""` (Probe has two S8 copies). Note the report and whether a third copy appears.
2. O3: import a text value into a non-contact text cell (S125 `GFBGII[1].GFGII.Ttwgii2`) and Y into `IDENT.Ident240`; export; then import `""` into both; export. Note whether each was cleared. Open Cell details for `IDENT.Ident492` and copy its label and source.
3. O4: import a file with one good row and two made-up ids (`GFGBA.Ttwgba99999`, `NOTREAL.Cell1`). Copy the report.
4. O5: export the "d3 all cells" filter once per non-default setting: negatives (123); decimal Comma; thousands Comma; thousands Space; column Tab; Semi-colon; Space. Copy to `2026-10-05-day5/exports/settings-<setting>.csv` (Probe values are made up). Note whether the leading apostrophe on negatives appears in each.
5. O2: import `"ASH-TOKEN-TEST"` into `IFirm.ContactPartner`, export the default filter and read it back. Write a short text in Return Properties, Notes, in a cell comment and in the label; export "Select all" on the ID and IW forms and note whether any of them shows. Copy the Cell details and help wording of form IW about filing. Print the EFILE copy of Probe (1 PDF); the helper looks for the token in it.

**After day 5 (the Lead's helper):** compare each `d5-<nn>-entered.csv` with its `import.csv` (as in `compare-07.md`); read the four PDFs with the Read tool's page view (the walker cannot read them) for a diagnostics page and the token; if the pages do not render, **Zo** opens `d3-probe-office.pdf` and one day 5 PDF and answers "is there a diagnostics page?" in one word.

**Stop conditions:** the shared rules above. Also stop a run if an import goes to a return other than the one named (check the BN and name after each import), and if Import and link corporations shows any non-"(Test)" return.

### Day 6: changes after lock, the check export, roll forward, target Sun 4 Oct
**Goal.** Learn what lock does, how a change after lock shows, whether a check export just before transmit equals the lock export, and what roll forward carries into next year. Answers O10 (RT-19, RT-20), O7 (roll forward RT-24, conversion) and the RT-14 classes overridden and rolled forward.

Use Riverdale Rentals (07) and Maple Ridge (01), imported on day 5. Build one custom filter "d6 lock", Select all, on ID, S100 family, S125 family, S1, S8, S8CCA, S50 and the T2 jacket; reload. Every export below uses this filter and the default settings unless named. Name files `d6-<nn>-E<k>.csv`.

1. E1: export 07 before lock. Compare in the notes with the day 5 export of the same cells (two days apart): byte-identical apart from the file name? Any date-driven cell (interest P71, days late) that changed by itself must be named.
2. Lock 07 (Actions, Return Management, Lock). Copy the dialog wording. Note the Return Status in the list, and try, while locked: typing in a cell, Quick entry, an override, a CSV import, Delete value. Note each refusal word for word.
3. E2: export while locked. Byte-compare with E1 (does lock change any cell?). Print Office copy of locked 07: 1 PDF.
4. Things that are not cells, while locked or not: rename, change the label, add a return note, add a cell comment, add a review mark, mark a diagnostic Reviewed. E3 after them. Is E3 equal to E2? (RT-20 false alarms.)
5. Unlock. Copy any reason prompt. Type a new value over an imported GIFI amount; relock; E4. Diff E2 to E4: only that cell and the calculated cells it drives? Export "Overridden", "Track changes" and "Imported": where does the typed-over imported cell show (RT-14 overridden)?
6. Unlock; import a one-row file changing another imported cell; relock; E5. Audit Trail: copy the rows for lock, unlock, the typed change and the import (one row per file, as day 3 found). Use a revert icon on the typed change once; E6; note what changed and whether the revert is logged.
7. The check export: with nothing changed since E6, export again (E7) at least 30 minutes later; byte-compare with E6. Also export with "Entered this year or last year" and compare with the same filter right after relock. Never press EFILE: note only whether it is enabled.
8. Roll forward: on 01 (not locked), Actions, Return Management, Roll forward, Roll Forward Settings left at the defaults (write them down if they differ from day 3), Roll forward. On the new return: year start and end; which cells hold values; export "Rolled forward", "Entered last year" and "d6 lock" (structure copies to `2026-10-06-day6/exports/`). List each rolled cell with the last-year cell it came from (the RT-24 map). Diagnostics count on the new return. Print it only if the counter allows: 1 PDF.
9. Roll forward 05 and 06 together from the returns list (select both): does the link between them carry over? Then look only at the returns list Actions and Add return for any conversion item (from another program or another year).
10. Leave the rolled returns in place for day 7; the Lead deletes them at trial end.

**Stop conditions:** the shared rules above. Also stop if Lock or Unlock asks for a password or an approver that is not the signed-in user, and never press EFILE even to see the check.

### What stays open after day 6, and the fallback for each
- **Q23 / O2, the token cell:** CCH's wording on whether form IW and `IFirm.*` cells are transmitted will not come from the trial screens alone. Fallback: RT-2 as written; no token, the staleness test runs on content.
- **O1, import into a new copy:** if day 5 shows no copy is created. Fallback: RT-7 as written; new copies by hand, copy lookup from the latest export.
- **O3 tail, why `Ident492` is skipped:** if Cell details does not say. Fallback: the simulator skips it silently and it sits on the allowed list (RT-15).
- **Transmit itself:** never tried. Fallback: RT-19 compares the check export cell for cell; any difference blocks transmit.
- **Diagnostics on the PDF:** if the PDF has no diagnostics page and "More options" offers none. Fallback: an amber clause change to RT-17: diagnostics read from the "Cells with diagnostics" export or a list the preparer pastes, with unknown codes treated as Error until a person classes them.
- **The full diagnostics list:** only codes seen on eleven returns. Fallback: key on ids (T05 note); an unknown code blocks sign-off until classed.
- **O8, Auto-fill:** if Zo cannot run it or it fails. Fallback: CK-12 shows "not checked: no evidence" for Auto-fill figures; any filled cell not imported, not calculated and not rolled forward is an orphan needing a source (RT-14).
- **The roll-forward map:** only the cells 01, 05 and 06 roll. Fallback: RT-24 as written; a rolled cell with no map entry is an orphan.
- **Conversion from another program:** if no item exists. Fallback: none needed; prior returns are typed or rolled forward by hand.
- **Part A, the rest of the 395 forms:** fallback: map only the forms the sample clients and the firm use; an unmapped cell is typed in Taxprep and classed orphan until mapped.

## The QBO track (in parallel, not time-limited)
- A free Intuit developer account and Canadian sandbox companies for the sample clients (Intuit's site says up to 10, active two years, region chosen at creation; confirm when creating). Never the firm's real QBO client list.
- For each: load the bank and card CSVs, categorise, make the adjusting entries with a memo each, run the trial balance and the other reports, export them. Find out: does a sandbox give GIFI mapping and a GIFI export, or only QuickBooks Online Accountant's Workpapers on real client files? What does each export look like, and what would the API give later?

## Rules
- Made-up companies only, apart from the one Auto-fill test Zo chooses; from it, only structure is saved.
- Never e-file or transmit. Never touch the firm's real Taxprep or QBO account.
- Every capture goes to `reference/taxprep/` or `reference/qbo/` with the date and the product release.
- The walker stops and asks Zo if a screen asks for payment, a licence, CRA credentials or anything real.
