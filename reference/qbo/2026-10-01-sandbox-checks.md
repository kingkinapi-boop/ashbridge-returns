# QBO sandbox checks, 1 Oct 2026: BLOCKED, no answers yet

Walker run. Browser: Zo's "Ashbridge Test" Chrome profile, signed in to developer.intuit.com.

## What was done

- [fact] developer.intuit.com My Hub menu lists: Workspaces, Sandboxes, My support tickets, Playground, Account profile, Sign out.
- [fact] Sandboxes page (developer.intuit.com/sandbox-companies?tab=qbo) showed "QuickBooks Online (0)", "Intuit Enterprise Suite (0)", "Remaining sandbox companies: 10/10", "No QuickBooks sandboxes found". So none existed.
- [fact] "Create sandbox" panel: Country options United States, Australia, United Kingdom, Canada. For Canada only "QuickBooks Online Plus" is offered; QuickBooks Online Advanced, Single Entity and Multi-Entity are marked NOT AVAILABLE in Canada.
- [fact] Chose Canada, QuickBooks Online Plus, pressed Create. The page then showed a red banner: "Sorry, something went wrong. Please try again."
- [fact] Reloading the sandboxes page twice more (once after visiting the developer homepage) showed the same banner, with no company list. Three failures in a row, so the walker stopped as ordered.
- [inference] The create call may have succeeded server side (the list page itself errors, so this cannot be seen), or failed. Unknown. Zo should open the Sandboxes page later and check "Remaining sandbox companies" before creating another, to avoid a duplicate.

## The sandbox questions: not answered

None of these could be tested because no sandbox company or API Explorer session was reached.

1. Do TrialBalance, GeneralLedger, TransactionList and JournalReport rows carry a transaction id and type: not tested.
2. Can an Attachable be read for a transaction (and TempDownloadUri lifetime): not tested.
3. How journal entries (Adjustment flag, memo, line descriptions) appear: not tested.
4. GIFI or Workpapers screen in the sandbox: not tested. (Sandbox FAQ already says no QBOA or Workpapers sandbox; unchanged.)
5. CSV or Excel export columns per report: not tested.
6. Unknown report column behaviour, GET Account for a GIFI field, 30-day CDC limit: not tested.

## Notes for the next try

- Side observation: the Chrome profile has an open tab "iFirm | Dashboard" at ashbridge.cchifirm.ca (the firm's CCH iFirm). The walker did not open or use it. The plan says the test profile holds no real client account; Zo may want to close it.
- API Explorer needs an app and OAuth connection to the sandbox, which may involve creating an app in the dashboard and authorising it. That step was not reached; keys and tokens must not be recorded.

## Second attempt (1 Oct 2026, later)

- [fact] developer.intuit.com/sandbox-companies?tab=qbo still shows the red "Sorry, something went wrong. Please try again." after waiting 12 seconds. The company list never loads, so it is unknown whether the Canada sandbox from the first attempt exists. No second sandbox was created.
- [fact] Playground (developer.intuit.com/app/developer/playground) loads. It says "To use playground, you must first create a workspace", then needs an app, its OAuth keys, a scope, an authorisation code and a realm id. That means creating an app and keys, which the walker rules forbid recording; not attempted.
- [fact] The shared Chrome tab group was reset mid-run and one tab I opened was navigated to iFirm by the other walker. I switched to a fresh tab, never touched the iFirm tabs, and closed my tab.
- All six sandbox questions remain untested (TB/GL/TransactionList/JournalReport row ids, Attachable read, journal entry memo, GIFI or Workpapers screen, export columns, unknown column and CDC limit).
- Next: Zo opens the Sandboxes page in his own window (maybe the error is session or region related), reports the company count and, if a Canada company is listed, opens it via its "Go to" link so the walker can use the QuickBooks screens; or Zo creates the app in the dashboard himself and decides how the walker may use the Playground.

## Third attempt (company screens)

Walker run in Zo's "Ashbridge Test" Chrome, tab on sandbox.qbo.intuit.com, "Sandbox Company CA 7cf6" (Canadian, CAD). No API, no keys. The "hidden" tab check was waived by the Lead for QuickBooks. Exports (CSV) were saved in Downloads and copied to taxprep-trial\inbox; structure copies are in reference/qbo/exports/.

- [fact] Trial Balance (as of 1 Oct 2026): columns Account Name, Debit, Credit; one row per account; no transaction id, type or GIFI. Totals 108,294.98 each side. CSV: reference/qbo/exports/trial-balance.csv.
- [fact] Journal report: Customize > Groups defaults to Transaction ID. Our JE shows under group "182" with "Total for 182", so the transaction id appears as a group heading. Row columns: Transaction date, Transaction type ("Journal Entry"), # (15), Name, Description (line description), Account Name, Debit, Credit; Adj can be added ("No"). No Memo and no attachment column in the list of choices. CSV: exports/journal.csv.
- [fact] General Ledger: grouped by account; columns Distribution account, Transaction date, Transaction type, #, Name, Description, Split, Amount, Balance. Choices include Memo, Adj, Created/Modified by and on, Debit, Credit; none is a transaction id or attachment. The JE rows (Janitorial Expense -12.34, Utilities - Water 12.34, # 15, type Journal Entry) show the line descriptions only; the CSV export had no Memo column (the Memo column added on screen was not in the export) and the memo text was not found in it. Existing seed journals (#3, #4, #5) show their line descriptions the same way.
- [fact] Transaction List by Date: one row per transaction (184 lines, All Dates). Columns Date, Transaction type, #, Posting (Y/N), Name, Memo, Account name, Split, Amount. Choices add Transaction ID, Created by/on, Modified by/on, Adj, Debit, Credit, REF #, Open balance. The JE appears as one row: 01/10/2026, Journal Entry, 15, Yes, memo "AJE accrual: test entry | source: probe note" in full, no name, no account, no amount. So the memo is intact here, at transaction level, with Transaction ID selectable.
- [fact] The made-up journal entry: no. 15, dated 1 Oct 2026, Utilities - Water debit 12.34, Janitorial Expense credit 12.34, line descriptions "line one description probe" and "line two description probe", memo "AJE accrual: test entry | source: probe note". It is saved in the sandbox and moves Utilities - Water to 563.42 and Janitorial Expense to 405.18 in the trial balance. It was not flagged adjusting (Adj shows No); no such tick box was seen on the form.
- [fact] Attachments: the JE form has an "Add attachment" box (max 20 MB) and "Show existing". None of the four reports has an attachments column. Whether an attachment shows on a report row: no. Not tested with an actual file.
- [fact] GIFI or tax mapping: chart of accounts has no GIFI column (Customize offers Description and account numbers only); top search for "GIFI" returns "No results found". No Workpapers or QBOA screen found (the Accounting menu lists Bank transactions, Integration transactions, Receipts, Reconcile, Rules, Chart of accounts, Recurring transactions, My accountant; My accountant was not opened).
- [inference] For the trace: the Transaction List by Date with Transaction ID and Memo added is the best single export for transaction id plus memo; the GL gives account, type, number and balance per line but no id; the Journal gives id (as a group) and the line description but not the memo; the Trial Balance is account level only. A GIFI mapping must be kept by the firm, not read from QBO.
- Not done: Excel export (CSV only), attachment upload, the API-side questions (Attachable read, CDC limit, GET Account for a GIFI field). Sandbox company screens have a leftover journal no. 15 that Zo may delete.
