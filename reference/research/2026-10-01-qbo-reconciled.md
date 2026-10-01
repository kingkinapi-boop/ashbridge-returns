# QBO (Canada) data for the trace and the GIFI mapping: reconciled

Date 1 Oct 2026. Research checker. Inputs: 2026-10-01-qbo-a.md (Intuit developer docs) and 2026-10-01-qbo-b.md (help and practice). Every deciding claim below was re-opened today unless marked otherwise. Pages are read through a summarising fetch; quotes are second-hand. developer.intuit.com doc pages and help.developer.intuit.com threads still return an empty shell or 403, so nothing about the report API's columns is confirmed.

## The answer

1. **Trial balance and transactions: QBO Accounting API, not UI exports.** Pull the TrialBalance report as of year end on the accrual basis, then the GeneralLedger or TransactionList report by account, then each transaction entity by id. Store raw JSON with realm, date, basis, minorversion and a fingerprint. UI exports (Journal, GL) carry date, type, number, memo, account and amounts but no confirmed transaction id, so they can only give a composite key. Whether report rows carry the entity id is NOT confirmed (both reports infer it); it is the first sandbox test.
2. **GIFI mapping: it exists only in QuickBooks Online Accountant (QBOA) Workpapers, a UI feature with no API found.** Intuit pre-maps accounts, the accountant edits, and Workpapers saves a standard .GFI file. Plain QBO's chart of accounts has no GIFI field (no source shows one). So Returns cannot "read the mapping from QBO" by API. Two workable routes: (a) the preparer uploads the Workpapers .GFI and Returns reads it as a file (EV-14) and ties its code totals to ours; (b) Returns keeps its own account-to-GIFI table (TB-3), AI proposes, a person confirms, reused next year. Recommend (b) as the record with (a) as a cross-check, since the .GFI's columns are unknown and may hold code totals only, not account-level mapping.
3. **Attachments: API only** (Attachable linked to the transaction; copy the bytes at read time, the download link is temporary).
4. **Changes after approval: we detect them.** CDC looks back 30 days only and the Audit Log is reported UI-only, so re-pull and diff against the stored pull.
5. **Prior year does not come from QBO** (CCH iFirm says so for its QBO import); TB-8 already sources it from last year's return.

## Evidence (checked)

| Claim | Report | Opened today | Verdict |
|---|---|---|---|
| Workpapers: Working Trial Balance, one-click to transaction details, non-adjusting entries and reclasses, per-account-line uploads, Tax Mapping and Export to "GIFI file format", corporate only, one accountant at a time, hidden from client, needs QBOA | B | quickbooks.intuit.com/learn-support/en-ca/help-article/manage-client/introducing-workpapers/L46ItXRic_CA_en_CA | Confirmed |
| Tax mapping: "edit GIFI codes that we've already mapped ... or assign GIFI codes" not yet mapped; "Reverse the numerical attribute of account (+/-)"; Save gives GIFI file format; no API mentioned | B | .../taxation/workpapers-gifi-mapping/L3CDlaaSK_CA_en_CA | Confirmed |
| QBOA, Clients, Workpapers, GIFI Mapping tab, "Save GIFI codes" downloads a GFI file; QB Desktop has no GIFI export (Income Tax Summary to CSV) | B | taxcycle.com/.../export-gifi-from-quickbooks/ | Confirmed (menu path differs from Intuit's, see open points) |
| TaxCycle imports .GFI, .CSV, .TXT to S100, S101, S125; never overwrites name and BN; re-import allowed; sample "QuickBooks GIFI Export.csv" ships with TaxCycle | B | taxcycle.com/.../import-gifi-from-a-file/ | Confirmed |
| Intuit Pro Tax T2 builds from Workpapers with completed GIFI mapping or a .gfi/.txt file; "S8 can't be completed by Workpapers" | B | .../accountant-t2-corporate-tax-returns/L6VqD1YPi_CA_en_CA and .../use-gifi-import-pro-tax/L4CdWQNLb_CA_en_CA | Confirmed; ".gfi file is a standard format"; no column layout anywhere |
| System-calculated GIFI totals (for example 2008) "cannot be overridden"; amounts on them do not import and S100 will not balance | B | .../assets/certain-amounts-entered-gifi-codes/L0U5FKqTv_CA_en_CA | Confirmed |
| CCH iFirm Engagement: direct QBO connection (Cash or Accrual, Intuit sign-in, pick company); "Prior-year data cannot be imported from QuickBooks Online"; sub-accounts "Parent:Child"; CSV columns Account No (opt), Name, Current Dr, Current Cr, Prior Dr (opt), Prior Cr (opt); 10,000 accounts; no GIFI mention | B | support.cchifirm.ca/.../uploading_trial_balance_data.htm | Confirmed |
| Journal report (Reports, For My Accountant) columns Date, Transaction Type, No., Memo/Description, Account No., Account, Debit, Credit, Created By, Created; no id column | B | support.mindbridge.ai/.../5764222023703 | Confirmed (vendor guide, not Intuit) |
| Export data: reports and lists as Excel in one .zip; attachments in a separate zip | B | .../export-reports-lists-data-quickbooks-online/L1xleDrLp_US_en_US | Confirmed (US page; no Canada note) |
| Limits: 500 req/min per realm; 10 req/s per realm and app; 40 batch req/min throttle; 30 payloads per batch; 1,000 entities per query; 120 s timeout; 429 means wait 60 s | A | static.developer.intuit.com/.../limits-and-throttles.html | Confirmed. Correction to A: 10,000 attachments per transaction "except Journal Entry" |
| Sandbox: 10 companies, two years, Canada on Plus only, Canada sample company (173 transactions, 95 accounts); no QBOA or Workpapers sandbox mentioned | A | static.developer.intuit.com/.../sandbox-faqs.html | Confirmed |
| OAuth scope, 60-minute access token, rolling 100-day refresh token | A | static .../oauth-2.0.html | Not re-opened (A opened it; not deciding now) |
| CDC: last 30 days; max 1,000 objects; excludes JournalCode, TaxAgency, TimeActivity, TaxCode, TaxRate; deleted come back with status Deleted | A [snippet] | static.developer.intuit.com/.../change-data-capture.html | Confirmed today (was snippet-only in A) |

## Dropped or downgraded

- **400,000-cell export cap** (B): said only by a user in the community thread; Intuit's reply gives no figure. **"Exports only displayed columns"**: not in the thread. Both downgraded to unconfirmed; irrelevant if we read by API.
- **Audit Log is UI-only** (A): the thread returns an error shell; unconfirmed. The design does not rely on it either way.
- **TransactionList parameters and columns, "qboTxnId"** (A): thread unreadable; unconfirmed.
- **Report rows carry entity ids; JournalEntry `Adjustment` flag; TempDownloadUri lifetime** (A): memory or inference; unconfirmed.
- **CCH iFirm re-import behaviour** (B): search result only; dropped.

## Where the two reports differ

- **Where GIFI lives.** A guessed "our app, or a QBO Canada UI feature outside the API"; B found QBOA Workpapers. B is right (two Intuit pages). A's "no GIFI in the API" stays unrefuted.
- **Does the trail carry a transaction id?** B: exports have none. A: the API probably does. Not a contradiction: different channels. Both agree the API is the route; it is unconfirmed until a sandbox call.
- **Found by one report only:** Workpapers, Pro Tax, CCH iFirm, TaxCycle, system-total GIFI codes (B only); limits, sandbox, OAuth, CDC (A only).

## Rule for the CPA's check list (decision 0008, B8)

GIFI total codes that CRA calculates (for example 2008, total tangible capital assets) must never receive an imported amount; amounts go on component codes. Worked example: buildings 1680 = 400,000 and its amortisation 1681 = -100,000, equipment 1740 = 50,000 and 1741 = -20,000. Mapped to components, 2008 is calculated as 330,000 and S100 balances. If an account were mapped to 2008 instead, that amount would not import and S100 would be out by it. CPA checks: no mapped account points at a total code; S100 assets equal liabilities plus equity. (Not yet added to the CPA list file: the Lead should add it.)

## Open points

1. The .GFI file's columns: account-level or code totals only? (Intuit calls it "standard"; no layout found.)
2. Workpapers menu path: Intuit says Books to Tax, Income tax, Tax mapping, Save, or Tax options, Export GIFI file; TaxCycle says Save GIFI codes. Probably UI versions; settle by clicking.
3. Can a made-up company be opened in QBOA Workpapers without the firm's real client list? Sandbox FAQ is silent. Touches the firm's QBOA account and live data rules: red, for Zo.
4. Whether Taxprep T2 itself imports a .GFI (TaxCycle and Pro Tax do; Taxprep unconfirmed). For the trial week.
5. Whether the sign-reversal checkbox in Workpapers is carried into the .GFI.

## To confirm in a sandbox company

- API Explorer, Canada sandbox: GET reports/TrialBalance?end_date=YYYY-12-31&accounting_method=Accrual, then reports/GeneralLedger and reports/TransactionList for one account. Settled when a row cell shows `id` equal to a JournalEntry or Invoice id that a GET by id returns.
- Create a JournalEntry with Adjustment=true, memo and line descriptions; read it back and find it in JournalReport. Settled when all three fields return.
- Upload an Attachable to an Invoice; query Attachable by EntityRef; download TempDownloadUri twice, 20 minutes apart. Settles the link and its lifetime.
- Request a column that does not exist on TransactionList. Settles whether unknown columns fail silently (the rule test).
- GET Account: look for any GIFI or tax-line field. Settled when none is found (or one is).
- cdc?entities=JournalEntry&changedSince=(31 days ago). Settles the 30-day limit.
- Only if Zo allows (open point 3): a QBOA Workpapers export of a made-up client, to get one .GFI.

## What this means for the plan

- **README items 2 and 3** say QBO makes the GIFI mapping and Returns reads it from QBO. True only through a Workpapers file upload, not the API. Keep the end state; reword the clauses: mapping record is ours (TB-3), the Workpapers .GFI is an optional cross-check. Amber unless Zo wants Workpapers to be the record (then red: it uses the firm's QBOA).
- **TB-1:** client balance = API TrialBalance as of year end, accrual, saved raw with basis and minorversion.
- **TB-2:** adjusting entries read as QBO JournalEntry (Adjustment flag, memo) plus our own; source each.
- **TB-3:** add "never map to a CRA total code" and the optional .GFI tie.
- **TB-7, TB-9:** trace route TB row, GL or TransactionList row, entity by id, attachment.
- **TB-8:** unchanged; QBO gives no prior year.
- **TB-6:** confirmed by "S8 can't be completed by Workpapers": CCA stays a judgment input.
- **EV-5:** add a pointer kind "QBO line" = realm, entity type, id, line, pull id (README item 3 lists it; EV-5 does not).
- **EV-1, EV-2:** every QBO pull is a versioned, fingerprinted record; attachments copied and fingerprinted at read time.
- **EV-10, EV-11:** QBO books are client-prepared (amber dot) unless a bank statement agrees (EV-13 rule).
- **EV-14:** QBO UI exports, if ever used, need a composite key (date, type, number, account, amount).
- **New check (RT-20 analogue):** books changed after approval, found by re-pull and diff, not by CDC or the Audit Log.
