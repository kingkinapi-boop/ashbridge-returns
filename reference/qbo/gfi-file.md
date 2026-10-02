# .GFI file from QBO Accountant Workpapers (walker attempt 2, 1 Oct 2026)

Attempt 3 (1 Oct 2026, authority Z17-1 in decision 0017: "1: yes"): NOT RUN. Browser 8f110f0a was reachable but its QBO session was signed out (qbo.intuit.com redirected to the Intuit sign-in page, which offers only the remembered account tile). Signing in is Zo's step; nothing was changed in the books, no file copied. Needed: Zo signs in to QBO Accountant in that Chrome, then re-run.

Status: PARTIAL. The click path and the file header are known. No account lines are known yet, because no data could be put in the books (see "Why it stopped").

## Click path (confirmed)

1. Signed in (the session now reaches the Accountant view; firm name shown: "Ashbridge Tax"). Navigating to https://accounts.intuit.com/app/sign-in with a redirect to https://qbo.intuit.com/app/accountantdashboard opened the Accountant shell (left bar: Your practice, Bookmarks, Your books). The plain /app/accountantdashboard path shows "can't find the page" even inside the shell; ignore it.
2. Left bar, Your books, Workpapers (/app/booksreview?taxyear=2025&basis=ACCRUAL). Tabs: Documents, Review & adjust, Grouping & statements, Tax mapping. Top right: "Books to tax actions" menu and "Start return in Pro Tax". Tax year and basis (accrual or cash) are chosen at the top ("Tax year 2025", "01/01/2025 - 31/12/2025, Accrual basis").
3. "Books to tax actions" menu: Carry forward previous year; Export GIFI file; Download workpapers pack; Lock books.
4. "Export GIFI file" downloads straight away, no dialog. File name: `<Firm or company name>_Tax_mapping_TY2025.gfi` (here `Ashbridge Tax_Tax_mapping_TY2025.gfi`).

## The Workpapers books here are the firm's own blank company

Workpapers under "Your books" works on the firm's own QBO company, which is empty: chart of accounts has only Uncategorized Asset, Deferred Revenue, Retained Earnings, Billable Expense Income, Services, Uncategorized Income, Uncategorized Expense (all $0). The "Go to QuickBooks" menu offers only "All clients". The client list ("Ashbridge Tax, Zohaib's clients") is empty.

## .GFI format (from the empty-books export, 141 bytes, one line, no trailing newline seen)

Comma-separated, every field in double quotes, empty fields as `""`. One header record, 23 fields:

`"GIFI01","","","","","Intuit Inc.","","","","","QuickBooks Online","","","","Ashbridge Tax","","","","","M5J 0E7","","20251231","20261001",""`

Fields by position (1-based, inferred): 1 record id `GIFI01`; 6 software vendor `Intuit Inc.`; 11 product `QuickBooks Online`; 15 firm or company name; 20 postal code (here the firm's, with a space); 22 period end `YYYYMMDD` (20251231); 23 export date `YYYYMMDD` (20261001); 24th is a trailing empty field (count by commas gives 24 quoted values; recount on a real file). Encoding looked like plain ASCII. Line ending unknown (single line).

With no balances there are no account lines. Unknown until a file with data exists: record id for account lines, GIFI code field, amount format, decimals, sign convention (debit/credit), whether zero rows are written, how unmapped accounts appear.

## Why it stopped

- Adding "Probe Co. (Test)": Clients, Add client opens a 4 step wizard (Basic information, QuickBooks, Payroll & Time, Checkout). Basic information requires an email and says an email is sent when a subscription is bought; the last step is Checkout. That reaches the subscription, email and billing screens decision 0013 forbids, so the walker did not submit it. Nothing was added; nothing needs deleting.
- Putting five made-up accounts into the firm's own blank books (New account in the chart of accounts): the permission system refused it as a change to a shared resource outside the Probe Co. plan. Nothing was changed in the books.
- No real client was opened (the list is empty). No file was copied to the inbox: the only .gfi is the header-only one (copy it only if wanted: `C:\Users\User\Downloads\Ashbridge Tax_Tax_mapping_TY2025.gfi`).

## What is needed (Zo's choice)

A. Allow made-up entries in the firm's own blank QBO company (five accounts and one balanced journal entry, removed afterwards), then export again. Cheapest. Or
B. Allow the walker to go through Add client for "Probe Co. (Test)" as far as a free option (for example a "no subscription" choice on the QuickBooks step) if one exists; it will stop at any Checkout. The email field needs a made-up address (nothing is sent unless the wizard says so). Or
C. Zo exports one .GFI himself from a company with a few made-up balances, or imports a sample .GFI.

## Open questions

Account line layout, field order of lines, separators inside lines, sign conventions, which codes QBO writes for the five accounts, what mapping Workpapers needs before export (Tax mapping tab: unmapped accounts), whether the export refuses with unmapped accounts or locked books.
