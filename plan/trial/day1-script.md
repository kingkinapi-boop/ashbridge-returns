# Trial day 1 script: the cell map

For the walker (Sonnet 5.5, Chrome profile "Ashbridge Test" only). Source: `plan/taxprep-trial-plan.md` day 1. Written 1 Oct 2026 from CCH iFirm help pages. The walker has never seen the trial, so every step marked [guess] is something to look for, not a fact. Everything saved is structure and made-up values only.

Labels: [fact] seen on a help page (URLs at the end); [inference]; [guess] not confirmed.

## Stop rules (apply to every step)
Stop, write what the screen says, and ask Zo if any screen asks for: payment, a card number, a licence key or a purchase; CRA credentials, My Business Account, Represent a Client, TaxprepConnect or Auto-fill (that is day 4, Zo only); a real client, a real firm account, or any name not ending "(Test)"; a transmit or e-file button (never press it). Do not sign up for the trial yourself: Zo signs in or hands over a signed-in browser. Never type a password. Never use another Chrome profile.

## Prepare tonight (before day 1)
1. Folders: `reference/taxprep/2026-10-NN-day1/` (NN = the day) holding `screens/`, `exports/`, `notes.md`; and `C:\Users\User\Documents\taxprep-trial\inbox\` outside the repo, so raw exports never land in git unreviewed.
2. In the "Ashbridge Test" profile: Chrome Settings, Downloads, location = the inbox above, "Ask where to save" off. Check only this profile has the trial signed in.
3. Sample clients from `reference/sample-clients/`: `07-riverdale-rentals/` (simple: one chequing account, no staff, calendar year), `05-eglinton-holdings/` and `06-eglinton-retail/` (the associated pair), `01-maple-ridge/` (the shareholder loan). From each `onboarding.json` copy `corporation.legal_name`, `business_number`, `fiscal_year_start`, `financial_year_end` into notes.md. All four run 2025-01-01 to 2025-12-31 [check the 05 and 06 values when copying]. The import CSVs are for day 2.
4. Zo: create the trial account himself, tell the walker the sign-in URL (never paste the password anywhere).
5. For Zo [guess]: the trial may offer only one tax-year edition. Use T2 2025 (these years end in 2025). If only 2026 is offered, stop and ask.
6. A notes.md template: step number, what was seen, success yes or no, screenshot file name.

## Steps

### A. Sign in and record the release
1. Open the trial URL in the "Ashbridge Test" profile. Success: the CCH iFirm start page. A "Buy", "Subscribe" or licence prompt: stop.
2. Screenshot it (`screens/01-home.png`). Crop out any email address; write "(trial user)" instead.
3. Record the release. Help shows the platform as "CCH iFirm 2026.20" [fact] and a product edition as "CCH iFirm Taxprep T2 <year> v.N.N (yyyy.nn.nn)", for example "T2 2024 v.2.0 (2024.40.38)" [fact]. Where the app shows its version is not stated on any page I opened [guess]: look in Help, About, the user menu, a page footer or a Release notes link. Copy the exact strings into notes.md under "Release". Success: both strings, or a note that only one shows.

### B. Create the returns (all made-up)
The dialog [fact, "Add a return"]: pick return type "T2 - Corporate", click "Add return", fill the "New contact" tab, click "Add return". Mandatory: Title, First name, Last name, Birth date, Group 1, Group 2, Tax year-start date, Tax year-end date. Client code fills itself if left empty.
The form is shaped for a person [inference], so for a corporation look first for a "Corporation name" or "Business name" field [guess]; otherwise put the legal name in Last name. Fill: Title "Test"; First name "Test"; Birth date any date it accepts, such as 1900-01-01 (record it) [guess]; Group 1 and Group 2 "Trial". Type year start and end by hand from the onboarding file, in the format the field shows (record it). The CSV import ignores them [fact, plan], so a wrong date here is not fixed by day 2.
4. Return 1, simple: Riverdale Rentals Inc. (Test), from `07-riverdale-rentals/onboarding.json`.
5. Return 2, pair, first: Eglinton Holdings Inc. (Test), from `05-eglinton-holdings/onboarding.json`.
6. Return 3, pair, second: Eglinton Retail Ltd. (Test), from `06-eglinton-retail/onboarding.json`. Then find where Taxprep links related or associated corporations (a help page "Import and link corporations" exists [fact]; its steps not read). Record where it is; do not link yet.
7. Return 4, shareholder loan: Maple Ridge Consulting Inc. (Test), from `01-maple-ridge/onboarding.json`. The plan says three; a fourth is cheap and covers loan schedules. Skip it if the trial limits returns, and write the limit down.
For each: success = the return shows in the return manager and the shortcut bar [fact]. Screenshot `screens/02-<nn>-created.png`. Save the form tree names (no values) to `exports/forms-<nn>.txt`. A business number is not asked on this dialog [inference]. If a screen asks for one, the sample numbers fail the check digit by design: record the message; never invent a real-looking number.

### C. Check the dates stuck
8. Open each return, then Schedule 200 (the T2 return) page 1 [fact the form is 200; where the dates show is a guess]. Success: start and end equal what you typed. Record any change or refusal.

### D. The saved filter "all input cells"
9. In return 1: REVIEW tab, Filters, Custom filters, click "+ Add" [fact].
10. Type `all input cells` in "Custom filter name" [fact].
11. Pick the first form in the Form drop-down. Click "Select all input cells" (not "Select all") in the toolbar, then "Add selected cells" [fact]. Cells land in the "Selected cells" table [fact].
12. The dialog works one form at a time [inference], so repeat 11 for every form in the return. If the drop-down has an "All forms" choice [guess], use it and say so. Note the cell count after each form.
13. Click "Add filter" [fact]. Success: the filter shows under Custom filters; screenshot it.
14. In returns 2 to 4 check whether the filter is already there [guess: filters may be per return]. If not, build it again.

### E. Export it
15. In return 1: Actions menu, Export [fact]. (From the return manager: the three-dot button in the last column, "Export..." [fact].)
16. File type CSV, then the filter drop-down: choose `all input cells` [fact: it lists the Review filters and custom filters].
17. Export options [fact the four exist]: Column break, Negative numbers, Decimal separator, Thousand separator (space, comma or none). Screenshot the defaults (`screens/05-export-options.png`), write them into notes.md, and export once with the defaults. Do not change them today.
18. Click "Export to CSV" [fact]. The file comes by a notification link [fact]: click it. It should land in the inbox folder. Note its name and size.
19. Do not commit the raw CSV. Save a structure copy to `reference/taxprep/2026-10-NN-day1/exports/all-input-cells-<nn>.csv`: keep the header line and column one exactly, replace every other value with `VALUE`, keep blanks blank. The data is made up, so this is a courtesy; do it anyway.
20. Also click "Export to Taxprep" once [fact it exists]. Note the file name and extension only; do not commit the file.
21. Repeat 15 to 19 for returns 2 to 4. Success: four CSVs, each with a bracketed header line and one cell identifier per row. The help's T1 header is `[Taylor, Robert|0|1]`; the T2 header may differ [guess]; record it.

### F. Record the CSV import syntax as the trial shows it
22. Return 1: Retrieve tab, "Import the CSV file" in the left menu [fact]. Do not import. The dialog may need a file first [guess]: if so, use a copy of an exported structure CSV named `syntax-probe.csv`, read the options screen, and cancel before the final "Import". Note the "Options - CSV" choices (column separator, thousand separator) [fact].
23. If the trial has a "Syntax of a CSV file" page, save its text to notes.md. The public help says [fact]: first line `[Taxpayer's name|Return|Language]`; columns are identifier, current year, previous year; the separator is `|` (ASCII 124); dates YYYY-MM-DD; "0" imports zero; no value means no import; copies go in brackets, for example `T4SLIP[1].TOATSC4;57,565.00` (that example shows `;` where the text says `|`, so write down which one the exported file really uses).
24. Copy the first 5 lines of an exported structure CSV and one repeating-form row into notes.md. Success: you can state in one sentence the separator, the identifier shape, the copy brackets and the decimal format.

### G. Wrap up
25. Finish notes.md: release; forms per return; filter cell counts per form; export option defaults; file names; every difference from this script; every [guess] step and what happened.
26. Push `reference/taxprep/` on a branch; never main. Stop. Day 2 starts only after the Opus helper has read these captures.

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
