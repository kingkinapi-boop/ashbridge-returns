# .GFI file from QBO Accountant Workpapers (walker attempt 4, 1 Oct 2026 evening Toronto; authority Z17-1, decision 0017)

Status: DONE for the format. A real export with data exists (made-up firm books, firm "Ashbridge Tax"), copied to `C:\Users\User\Documents\taxprep-trial\inbox\ashbridge-test-firm_Tax_mapping_TY2026.gfi` (202 bytes). Everything the walker changed was undone (see "Changes made and undone").

## Click path (confirmed)

1. Accountant view (firm "Ashbridge Tax"), left bar, Your books, Workpapers: `/app/booksreview?taxyear=2026&basis=ACCRUAL`. The tax year is in the URL; it can be set there (2026 worked; the default was 2025). Tabs: Documents, Review & adjust, Grouping & statements, Tax mapping.
2. Tax mapping tab, "Select a tax form": options T2 Corporation and T2125 Self-Employed. Choosing "T2 Corporation" is what maps accounts to GIFI codes (see "What Workpapers needed").
3. Top right "Books to tax actions" menu: Carry forward previous year; Export GIFI file; Download workpapers pack; Lock books. "Export GIFI file" downloads straight away, no dialog. File name `<Firm name>_Tax_mapping_TY<year>.gfi`; a second download gets ` (1)` added by Chrome.

## Format (from the file below)

- Text, ASCII, comma-separated, CRLF (`0D 0A`) between records, NO line ending after the last record.
- Record 1 (header), 24 double-quoted fields, every value quoted, empty fields as `""`.
- Record 2 onward (one per GIFI code, no header row, no totals row): `"<code>",<amount>`. The code is quoted; the amount is NOT quoted, always two decimals, a dot as the decimal point, no thousands separator, no currency sign.
- Sorted by code ascending (1060, 1480, 8000, 8911).
- Header fields by position (1-based): 1 `GIFI01` (record id); 6 `Intuit Inc.`; 11 `QuickBooks Online`; 15 firm name (`Ashbridge Tax`); 20 postal code of the firm (`M5J 0E7`, with a space); 22 period end `YYYYMMDD` (20261231, the end of the tax year chosen, not the books' last date); 23 export date `YYYYMMDD` (20261002: the day after the local date, so it looks like UTC); 24 empty. All other fields empty. Fields 2 to 5, 7 to 10, 12 to 14, 16 to 19, 21 are empty in this firm's file; they may carry a business number or company name in a client's file (open question 1).
- Signs: every amount here is positive, including a credit-normal income line (8000, 1,500.00) and a debit-normal asset (1060, 500.00). So amounts are the natural-sign balance of each code (assets debit, income credit, expense debit), not debit/credit signed. Whether a negative balance writes a minus sign is not tested (open question 2).
- Amounts are sums of the accounts mapped to the code, as of the tax year end, rounded to cents (all test amounts were whole dollars, so rounding is not tested).
- Zero or empty accounts write no line (the blank-books file had only the header). The equity account with no balance wrote no line; the existing "Retained Earnings" account (no activity) wrote none either.

## Full contents of the made-up file (202 bytes)

Record separator shown as CRLF:

```
"GIFI01","","","","","Intuit Inc.","","","","","QuickBooks Online","","","","Ashbridge Tax","","","","","M5J 0E7","","20261231","20261002","" CRLF
"1060",500.00 CRLF
"1480",700.00 CRLF
"8000",1500.00 CRLF
"8911",300.00
```

How the lines came from the books (tax year 2026, accrual, T2 selected):

| GIFI | Workpapers label | Amount | From |
|---|---|---|---|
| 1060 | Accounts receivable | 500.00 | (Test) Accounts receivable, Dr 500 |
| 1480 | Other current assets | 700.00 | (Test) Cash, Dr 1,000 less Cr 300 (Cash had detail type Other current assets) |
| 8000 | Trade sales of goods and services | 1,500.00 | (Test) Sales, Cr 1,000 + Cr 500 (detail type Sales of Product Income) |
| 8911 | Real estate rental | 300.00 | (Test) Rent expense, Dr 300 (detail type Rent or Lease of Buildings) |

The Tax mapping tab showed the same four rows (columns TAX LINE, ACCOUNTS count, AMOUNT). Mapping is by QBO detail type to a GIFI code, automatic once a tax form is selected.

## What Workpapers needed

- Without a tax form chosen on the Tax mapping tab, the export of books that had data still gave the header only (141 bytes): the first export of this walk, taken with the entries posted but before "T2 Corporation" was selected, was header-only. After selecting T2 Corporation the same export held the four lines. So: select the form first.
- No mapping was asked for by hand; the walker did not override any mapping. No lock, no adjustment, no prior-year carry forward was used.
- The tax year must contain the entries: with entries dated 1 Oct 2026, year 2026 was needed (year 2025 would be empty).
- The A/R account needs a customer on every journal line (QBO refused to save: "When you use Accounts Receivable, you must choose a customer in the Name field").
- Equity: a second account with detail type Retained Earnings was refused ("There can be only one account of singular detail type"), so "(Test) Retained earnings" was saved with detail type Owner's Equity. It never held a balance, so it did not show in the file.

## Changes made and undone (all in the firm's own books, Accountant view, tab "Ashbridge Test")

| # | Change | Undo | Done |
|---|---|---|---|
| 1 | Added accounts "(Test) Cash" (Current assets, Other current assets), "(Test) Accounts receivable" (A/R), "(Test) Sales" (Income, Sales of Product Income), "(Test) Rent expense" (Expenses, Rent or Lease of Buildings), "(Test) Retained earnings" (Equity, Owner's Equity) | Made each inactive (Chart of accounts, Action menu, Make inactive, confirm) | yes; the chart shows the original 7 accounts; the five are inactive, not deleted, so they can be reactivated |
| 2 | Added customer "(Test) Customer" (name only, no email, no phone) from the Name field of the A/R journal line | Made inactive (Customers, row menu, Make inactive, confirm) | yes; the Customers list is empty again; inactive, not deleted |
| 3 | Journal entry no. 1, dated 01/10/2026: Cash Dr 1,000 / Sales Cr 1,000; (Test) Accounts receivable Dr 500 (name (Test) Customer) / Sales Cr 500; Rent Dr 300 / Cash Cr 300; total 1,800.00 both sides | Deleted from the Cash account history register (Delete, confirm Yes) | yes; the Cash balance went back to $0.00 and the chart showed all balances $0.00 |
| 4 | Two .gfi downloads in `C:\Users\User\Downloads` (header-only `...TY2026.gfi` and the full `...TY2026 (1).gfi`); one copy in the inbox | none needed (files only); the header-only TY2025 and TY2026 files remain in Downloads | n/a |

Not done on purpose: no Probe Co. client added, no real client opened, no billing, subscription, invite or email screen met, no password typed, no JS dialog. A QuickBooks Business Network suggestion popup appeared while naming the customer; it was dismissed, nothing from it was selected. The first (Test) Cash line had a keyboard slip that duplicated a line in the journal form before saving; the saved entry is the six-line entry above.

Practical: the journal form's date defaults to today (01/10/2026, day/month/year display). The page drew small in the screenshot (content in the top left corner of the viewport) but element references worked; coordinate clicks did not map and should not be used.

## Open questions

1. Header fields 2 to 5, 7 to 10, 12 to 14, 16 to 19, 21: what they carry for a client's company (business number, legal name, address, fiscal period start?). Only a client company's books would show it; not needed to build the importer's reading of lines.
2. Negative balances (a credit-balance asset, a loss): written with a minus? Not tested (needs a journal that makes an account negative; can be done in the same safe way).
3. Contra or equity codes (3600 retained earnings, 3500 share capital): the equity lines needed a balance; not exercised. Net income is not written as a line here.
4. Rounding of sub-dollar amounts and many accounts mapping to one code.
5. Does an unmapped account (no form chosen, or detail type with no GIFI code) go missing silently? The first export with entries and no form chosen did exactly that (header only), so yes: Taxprep import must treat a header-only or short file as a flag, not a pass.
6. Export date field looks like UTC, one day ahead of Toronto evening; use the tax year end (field 22) and not the export date for any logic.
