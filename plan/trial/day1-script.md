# Trial day 1 script: the cell map

For the walker (Sonnet 5.5, Chrome profile "Ashbridge Test" only). Source: `plan/taxprep-trial-plan.md` day 1. Written 1 Oct 2026 from CCH iFirm help pages; Opus read the same day (notes at the end). The walker has never seen the trial, so every step marked [guess] is something to look for, not a fact. Everything saved is structure and made-up values only.

Labels: [fact] seen on a help page (URLs at the end); [inference]; [guess] not confirmed.

## Stop rules (apply to every step)
Stop, write what the screen says, and ask Zo if any screen asks for: payment, a card number, a licence key or a purchase; CRA credentials, My Business Account, Represent a Client, TaxprepConnect or Auto-fill (that is day 4, Zo only); a real client, a real firm account, or any name not ending "(Test)"; a transmit or e-file button (never press it).
Never click: Transmit, EFILE, Send, Submit, Auto-fill, Request, Digital signature or e-signature, Email, Portal, Invite, Publish, Share with client, Sync. Several of these send real emails or reach CRA [inference]. Leave every email, phone and address field blank. Do not open Settings, Firm, Users, Billing or Subscription pages. Delete nothing that this script did not create.
Do not sign up for the trial yourself: Zo signs in or hands over a signed-in browser. Never type a password. Never use another Chrome profile. If the session signs out, stop and ask Zo.

## Prepare tonight (before day 1)
1. Folders: `reference/taxprep/2026-10-NN-day1/` (NN = the day) holding `screens/`, `exports/`, `cells/`, `notes.md`; and `C:\Users\User\Documents\taxprep-trial\inbox\` outside the repo, so raw exports never land in git unreviewed.
2. Downloads: extensions usually cannot open `chrome://settings` [inference], so Zo sets it by hand if wanted (Settings, Downloads, location = the inbox, "Ask where to save" off). Otherwise leave the default; after each download the walker moves the file by name from `C:\Users\User\Downloads\` to the inbox. Check only this profile has the trial signed in.
3. Sample clients from `reference/sample-clients/`: `07-riverdale-rentals/` (simple: one chequing account, no staff), `05-eglinton-holdings/` and `06-eglinton-retail/` (the associated pair), `01-maple-ridge/` (the shareholder loan). From each `onboarding.json` copy `corporation.legal_name`, `fiscal_year_start`, `financial_year_end` into notes.md. All four run 2025-01-01 to 2025-12-31 [fact, checked 1 Oct]. The import CSVs are for day 2.
4. Zo: create the trial account himself, sign in inside the "Ashbridge Test" profile, and write in the to-do the trial's last day [guess: shown on the account page]. Never paste the password anywhere.
5. For Zo [guess]: the trial may offer only one tax-year edition. Use T2 2025 (these years end in 2025). If only 2026 is offered, stop and ask. Sample 02 (Halton Haulage) ends 2026-03-31 and may need a T2 2026 edition on day 5 [inference]: record which editions the trial lists.
6. A notes.md template: step number, time, what was seen, success yes or no, capture file name.
7. Captures: text first. For each capture step save the page text (the page-text or read-page tool) to the named `.txt` file. Screenshots are extra: save one only if your tools can write an image file; otherwise describe the screen in notes.md. Replace any email address with "(trial user)".

## Steps

### A. Sign in and record the release
1. Open the trial URL in the "Ashbridge Test" profile. Success: the CCH iFirm start page. A "Buy", "Subscribe" or licence prompt: stop.
2. Capture it (`screens/01-home.txt`).
3. Record the release. Help shows the platform as "CCH iFirm 2026.20" [fact] and a product edition as "CCH iFirm Taxprep T2 <year> v.N.N (yyyy.nn.nn)", for example "T2 2024 v.2.0 (2024.40.38)" [fact]. Where the app shows its version is not stated [guess]: look in Help, About, the user menu, a page footer or a Release notes link. Copy the exact strings into notes.md under "Release", plus the list of T2 editions offered. Success: both strings, or a note that only one shows.

### B. Create the returns (all made-up)
The dialog [fact, "Add a return"]: pick return type "T2 - Corporate", click "Add return", fill the "New contact" tab, click "Add return". Mandatory: Title, First name, Last name, Birth date, Group 1, Group 2, Tax year-start date, Tax year-end date. Client code fills itself if left empty.
The form is shaped for a person [inference], so for a corporation look first for a "Corporation name" or "Business name" field [guess]; otherwise put the legal name in Last name. Fill: Title "Test"; First name "Test"; Birth date any date it accepts, such as 1900-01-01 (record it) [guess]; Group 1 and Group 2 "Trial". Type year start and end by hand from the onboarding file, in the format the field shows (record it). The CSV import ignores them [fact, plan], so a wrong date here is not fixed by day 2. Leave every other field blank.
4. Return 1, simple: Riverdale Rentals Inc. (Test), from `07-riverdale-rentals/onboarding.json`.
5. Return 2, pair, first: Eglinton Holdings Inc. (Test), from `05-eglinton-holdings/onboarding.json`.
6. Return 3, pair, second: Eglinton Retail Ltd. (Test), from `06-eglinton-retail/onboarding.json`. Then find where Taxprep links related or associated corporations (a help page "Import and link corporations" exists [fact]; its steps not read). Record where it is; do not link yet.
7. Return 4, shareholder loan: Maple Ridge Consulting Inc. (Test), from `01-maple-ridge/onboarding.json`. The plan says three; a fourth is cheap and covers loan schedules. Skip it if the trial limits returns, and write the limit down.
For each: success = the return shows in the return manager and the shortcut bar [fact]. Capture `screens/02-<nn>-created.txt`. Save the form tree (form numbers and names, no values) to `exports/forms-<nn>.txt`. A business number is not asked on this dialog [inference]. If a screen asks for one, the sample numbers fail the check digit by design: record the message; never invent a real-looking number.

### C. Check the dates stuck
8. Open each return, then form 200 (the T2 return) page 1 [fact the form is 200; where the dates show is a guess]. Type nothing. Success: start and end equal what you typed. Record any change or refusal.

### D. The cell list and the saved filter "all input cells" (the riskiest step)
Why: day 2 compares import against export cell for cell, so the input-cell identifier list per form must be complete. Two captures, so one failure does not lose the day: the cell list read from the filter dialog (D) and the CSV export (E).
Filters "become available to all staff working with the same tax product and tax year" [fact], so build it once, in return 1; it should then appear in returns 2 to 4. Help says cells "from multiple forms" can go in one filter [fact]; whether one click covers all forms is not stated [guess].
9. In return 1: REVIEW tab, Filters, Custom filters, click "+ Add" [fact].
10. Type `all input cells` in "Custom filter name" [fact].
11. In the Form drop-down, pick a form. Click "Select all input cells" (not "Select all") in the toolbar [fact], then "Add selected cells" [fact]. Cells land in the "Selected cells" table [fact].
12. Before moving on, capture the cells you just added: save the dialog's page text for this form to `cells/<form>.txt` (identifier and description per line, as shown) and note the count in notes.md. If the form has several pages or tables, check the list covers all of them (for 200, look for cells from page 1 and page 9) [guess]; if not, record how pages are picked.
13. Order: first these forms [inference, the ones the build imports and checks]: 200, 100, 101, 125, 140, 141, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 23, 24, 50, 53, 55, 89, 500, 510, and any other Ontario form numbered 5xx. Save the full drop-down list of forms to `cells/forms-all.txt`. Then every remaining form in drop-down order. If the drop-down has an "All forms" choice [guess], use it once and say so.
14. Repeating and table forms: in one of 8, 9 or 50, note how a row or copy shows in the identifier (for example `[1]` or a row number) [guess]. Day 2 needs this shape.
15. Click "Add filter" [fact]. Success: the filter shows under Custom filters; capture it.
16. Timebox: if the whole form list is not done after 2 hours of D, click "Add filter" with what is in, name it `all input cells` anyway, write the forms not yet covered in notes.md, and go on to E. The rest is added on day 2 by editing the filter (three dots beside its name, Edit [fact]).
17. Fallbacks, in order, if the filter cannot be built or saved: (a) one filter per group, `inputs core` (the step 13 list) and `inputs rest`; (b) if saving fails, keep the `cells/` text files: they are the cell list; (c) in the export (E) try every filter the drop-down lists and record what each exports. Record which fallback was used.
18. Open returns 2 to 4 and check the filter is listed [guess per return or shared; help says shared]. If not, rebuild it there, from the step 13 list only.
19. If time is left: a second filter `core all cells` with "Select all" (not input only) on 200, 100, 125 and 1, captured the same way. It shows which cells are calculated (day 2 question on calculated cells and orphans).

### E. Export it
20. In return 1: Actions menu, Export [fact]. (From the return manager: the three-dot button in the last column, "Export..." [fact].)
21. File type CSV, then the filter drop-down: choose `all input cells` [fact: it lists the Review filters and custom filters]. Record the whole list of filters the drop-down offers.
22. Export options [fact the four exist]: Column break, Negative numbers, Decimal separator, Thousand separator (space, no space or comma). Capture each drop-down's default AND every choice it offers (`screens/05-export-options.txt`), write them into notes.md, and export once with the defaults. Do not change them today.
23. Click "Export to CSV" [fact]. The file comes by a notification link [fact]: click it, move it to the inbox. Note its name and size.
24. Read the raw file (not the structure copy) and record in notes.md: its encoding (UTF-8 with or without BOM, or other: check the first bytes), line endings (CRLF or LF), the header line exactly, the separator, the row count, and whether empty cells appear as rows or are left out. The returns are nearly empty, so if empty cells are left out the export is short and the `cells/` files are the cell list [inference]. Say which.
25. Do not commit the raw CSV. Save a structure copy to `exports/all-input-cells-<nn>.csv`: keep the header line and column one exactly, replace every other non-blank value with `VALUE`, keep blanks blank. Keep the raw files of return 1 in the inbox for day 2.
26. Also click "Export to Taxprep" once [fact it exists]. Note the file name and extension only; do not commit the file.
27. Repeat 20 to 25 for returns 2 to 4. Success: four CSVs. The help's T1 header is `[Taylor, Robert|0|1]` [fact, T1 example]; the T2 header may differ [guess]; record it.

### F. Record the CSV import syntax as the trial shows it
28. Return 1: Retrieve tab, "Import the CSV file" in the left menu [fact]. The file is chosen before the options show [fact: drop or "Select a file", click "Import", then the "Import the CSV file" dialog]. Make `syntax-probe.csv` in the inbox holding only the exported header line of return 1 and no data rows, so even an accidental import changes nothing [inference]. Select it, click the first "Import", then record every choice under "Options - CSV" [fact], the taxpayer picker, and the "Exclude the values associated with the synchronized contact information" box [fact] with its default. Click Cancel or close, never the second "Import". If the header-only file is refused, record the message and stop F there.
29. If the trial has a "Syntax of a CSV file" page, save its text to notes.md. The public help says [fact]: header `[Taxpayer Name|Return|Language]` (Return 0 = main taxpayer; Language 0 English, 1 French); columns are identifier, current year, previous year; the separator is `|` (ASCII 124); dates YYYY-MM-DD; "0" imports zero; no value means no import; copies go in brackets, for example `T4SLIP[1].TOATSC4;57,565.00` (that example shows `;` where the text says `|`, so write down which one the exported file really uses). Encoding, check boxes and yes or no cells are not described [fact]: record how the export shows them.
30. Copy the first 5 lines of an exported structure CSV and one repeating-form row into notes.md. Success: you can state in one sentence the separator, the identifier shape, the copy brackets, the decimal format and the encoding.

### G. Wrap up
31. Finish notes.md: release and editions; forms per return; filter cell counts per form and forms not yet covered; filters the export lists; export option defaults and choices; file names, encoding, line endings, empty-cell behaviour; import options; every difference from this script; every [guess] step and what happened; minutes per section.
32. Stage `reference/taxprep/` files by name and push on a `claude/` branch; never main; never the inbox. Stop. Day 2 starts only after the Opus helper has read these captures.

## Not today
No import, lock, print, roll-forward, Auto-fill or transmit. Do not edit any cell except the names and year dates set on creation.

## Sources opened (1 Oct 2026)
- https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_add_return.htm
- https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_create_filter.htm
- https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_export_data.htm (headed 2026.20)
- https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_import_csv.htm
- https://support.cchifirm.ca/en/content/cch_ifirm/tax/tax_-_csv_syntax.htm (example is a T1 slip; T2 details are a guess)
- https://support.cchifirm.ca/en/content/cch_ifirm/releasenotes/tax_-_rn_tech_taxprep.htm
- https://support.cchifirm.ca/en/assistance/T2/2024/content/ifirm_tax/rnifirmtxpt2202420.htm

## Opus read, 1 Oct
- Safety: added a never-click list (transmit, e-signature, email, portal, invite, sync), blank contact fields, no settings or billing pages, delete only what we made, stop on sign-out.
- Filters are shared per product and tax year (help, re-read): build once in return 1, check in 2 to 4, not rebuild four times.
- The cell list is now captured from the filter dialog per form (`cells/`), not only from the export: a nearly empty return may export no rows for empty cells, which would have lost the backbone of day 2.
- Fallback for the filter: priority form list first, 2-hour timebox, per-group filters, the `cells/` files, every listed filter tried at export. Optional `core all cells` filter for the calculated-cells question.
- Export captures now include every option choice, the filter list, encoding, BOM, line endings and empty-cell behaviour (day 2's encoding question).
- Import probe is header-only, so an accidental import changes nothing; records the sync-contact box and taxpayer picker.
- Captures are text first (the walker's tools may not save images); downloads may not be redirectable from an extension, so move files by name.
- Confirmed the four sample year dates; flagged that sample 02 ends in 2026 and may need the T2 2026 edition on day 5.
