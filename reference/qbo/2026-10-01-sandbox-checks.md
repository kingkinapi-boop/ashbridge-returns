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
