# CRA My Business Account: what it can supply

Capability-only copy of Zo's CRA walk (2 Oct 2026), real data removed under decision 0003; the original stays on the laptop only.

A reference for digital client onboarding.

| | |
|---|---|
| **Purpose** | Establish what a CRA business account can supply on its own, so the firm only asks a new client for what CRA cannot supply. |
| **Method** | Three read-only walks of one live account in September 2026. Rules were checked against canada.ca, ontario.ca, ised-isde.canada.ca or alberta.ca on the walk date. |
| **Test subject** | <business name>, BN <BN>, an Ontario CCPC with four program accounts (RC, RT, RP, RZ). |
| **Access used** | Represent a Client, <RepID>. |
| **Portal build** | 26.08.3 (September 2026). |
| **Scope of actions** | Nothing was filed, submitted, paid, authorized, requested, downloaded, scheduled or changed. |

### How to read this document

Sections 1 to 4 describe capability: what the portal holds, where, and how deep. They apply to any client.
Sections 5 to 7 describe channels outside the portal: T2 Auto-fill, the Enquiries service and the representative layer.
Section 8 covers authorization levels. Section 9 covers other program account types. Section 10 is the onboarding matrix.
Sections 11 and 12 of the original held one taxpayer's data and are dropped (see below). Section 13 is deadlines, limits and sources.

### Corrections carried over from earlier drafts

1. A payroll account's Returns tab can say "no filed returns" while the balance page and ledger show assessed T4 returns. Do not trust one tab.
2. CRA does hold a books-and-records address; it shows on the Address information page.
3. The quick method election can be confirmed, with its effective date, on the Elections tab.
4. Schedule 50 can appear in several consecutive years' returns, not just one.
5. "List of notices issued" covers individuals only and takes a SIN, not a BN.

---

## 1. Account structure

### 1.1 Entry path

Authentication lands on a CRA account welcome page (screen WEL.01) offering the person's Individual Account and Representative Account side by side, each with an unread-mail count, plus What's New, Security settings and Add account.

Direct URLs into a client account do not work from a cold session; they bounce to this selector. Any automation must traverse selector, then representative, then client, rather than deep-linking.

### 1.2 Five client identifier types

| Field | Format | Opens |
|---|---|---|
| SIN | 9 digits | An individual's account |
| BN | 9 digits | A business account |
| T3 | 1 alpha, 8 digits | A trust account |
| NR | 3 alpha, 6 digits | A non-resident tax account |
| RP | up to 13 characters | A registered plan, by plan or specimen number |

### 1.3 Account overview page

Screen A-MBA-22. Shows for the business as a whole: outstanding returns flag, total amount owing, a Direct deposit transactions link, and a Progress tracker for files submitted to CRA. Then one card per program account with its number, outstanding-returns flag, amount owing, and a View and pay account balance link.

Filters on the account list: Account type, Amount owing, Outstanding returns.

A standing banner says CRA uses online mail as the default and points the user to Notification Preferences in Profile to add an email address. That section does not exist in the representative view (see 8.4).

---

## 2. What each program account holds

### 2.1 Corporation income tax (RC)

Screen A-MBA-RC-002. Tabs: Returns, Special elections & returns, SR&ED Client Portal, CCR-B.

| Element | Detail |
|---|---|
| Filed returns | Tax year end, status, status date, per year. Status value seen: Assessed. |
| Return detail | Click the status link to open the complete filed T2 with every schedule, both "Reported Value" and "Current Assessed Value" columns (see 3.1). |
| Return balances | Non-capital loss balance, capital loss balance, ERDTOH, NERDTOH, GRIP: live running balances with the tax year end they relate to. |
| Special elections & returns | Records of SERs filed (T2054 and similar). Links to a Capital gain and loss amounts page. |
| Capital gain and loss amounts | Screen A-B-SR-CG-05. Losses and gains assessed per tax year end. Returns "no balance for this account" when nil. |
| CCR-B tab | Canada Carbon Rebate for Businesses: period ending, status, notice date. The amount appears only in the transaction ledger, not on this tab. |
| SR&ED Client Portal | Informational; SALT self-assessment tool; contact an SR&ED specialist. |
| Program account information | Mailing address, physical location address, program account name, language preference, plus links to full address and name lists. |
| Balances | View and pay account balance leads to period-end balances (interim and assessed), View interest, View account transactions, Export to CSV, Request remittance vouchers. |
| View interest | Screen A-B-RC-VI-01. Per period end, back to the earliest period on the account. |
| Instalment tool | Calculate and pay instalment payments, behind a service disclaimer. Step 2 shows CRA's stored instalment base (actual federal and provincial tax for the two prior years) and pre-selects the instalment frequency CRA considers the corporation eligible for. |

### 2.2 GST/HST (RT)

Screen A-MBA-RT-002. Tabs: Returns, Rebates, Elections.

| Element | Detail |
|---|---|
| Expected returns | Reporting period, return type, status, due date for the next return. |
| Filed returns | Reporting period, return type, status, received date. |
| Return detail | Via the legacy "View expected and filed returns" page (B-RT-VR-01), then a per-period summary (B-RT-VR-02) with every line of the filed GST34 (see 3.2). |
| Elections | GST20 reporting period, GST70 fiscal year end, GST74 quick method with effective date. Also on a standalone View elections page (B-RT-VE-01). |
| Rebates | Rebate status. |
| Balances | Period-end balances by year plus "Prior periods", interim and assessed, CSV export. View interest per period. |

Note: the new Returns tab paginates and may show fewer periods than the legacy "View return details" page. Use the legacy page for the full list.

### 2.3 Payroll (RP)

Screen A-MBA-RP-002. Tabs: Reports, Returns, Remittances, Rejected T4FHSA individual records, COVID-19 subsidies.

| Element | Detail |
|---|---|
| Remittances | Remitter type in plain language, including the AMWA test CRA applied, the quarters, and the due dates. |
| Returns tab | Filed information returns. Unreliable; see the warning below. |
| Reports | Information return slips available to download; Invalid SIN / SIN-surname mismatch report (PIER); Maximum participation period report (FHSA). |
| Account balance | Tax-year balances table with columns: Amount paid, Amount unpaid, T4 return amount, Balance adjustment, Balance. This is where assessed T4 returns actually appear. |
| Account transactions | Full itemised ledger: T4 information return assessments, payments with received dates, balance adjustments. |
| COVID-19 subsidies | Link to wage and hiring subsidy balances. |

> Warning: do not trust a single "no returns" message. On the test account the Returns tab said "You have no filed returns" while the balance page and ledger showed several assessed T4 returns. Any onboarding rule that reads one tab and concludes a compliance gap will generate false alarms. Cross-check every "nothing on file" against the transaction ledger.

### 2.4 Information returns (RZ)

Screen A-MBA-RZ-002. Tabs: Returns, Reports, Notifications of errors.

| Element | Detail |
|---|---|
| Filed returns | Reporting year, return type, status, submission number, report type code (Original or Amended), slip count, date processed, and a "Request download" action per year. Filterable by reporting year and return type. |
| Notifications of errors | Part XVIII and Part XIX incomplete records (FATCA / CRS). |
| Reports | Information return slips; SIN mismatch report. |
| Balance | None. Returns "003 - no accounting transactions for this account (NDAT003)". The transaction tool offers no balance types for RZ. Information-return accounts carry filings, not money. |

---

## 3. The deep data: what a return actually yields

### 3.1 T2 returns

Clicking a return's status opens View Return, Initial Assessment (screen B-RC-VR-01) with an "Expand all" control. It returns the complete filed return, schedule by schedule, with reported and assessed values side by side.

Schedules observed on a simple CCPC: T2 Identification and Additional Information, Attachments, Taxable income, Small business deduction, Part I tax, Refundable dividend tax on hand, Summary of tax and credits, Schedule 141 (Notes Checklist), 100 (Balance Sheet), 125 (Income Statement), 1 (Net income for tax purposes), 3 (Dividends), 5 (Tax Calculation Supplementary), 8 (CCA), 24 (First-time filer), 50 (Shareholder Information), 55 (Part III.1), 524 (Ontario Specialty Types).

High-value fields, with the line number to key on:

| Line | Field | Why it matters |
|---|---|---|
| 040 | Type of corporation | Confirms CCPC status directly |
| 060 / 061 | Tax year start / end | |
| 070 / 071 | First year after incorporation / amalgamation | |
| 284 / 285 | Principal product or service, % of revenue | Free-text business description in the client's own words |
| 294 | Date ceased to be eligible for quarterly instalments | |
| 300 / 360 | Net income for tax purposes / taxable income | |
| 400 to 430 | SBD calculation and business limit | |
| 700 | Part I tax payable | |
| 750 | Provincial/territorial jurisdiction | A single code that decides which province gets taxed. Check it against the address on file. |
| 760 / 770 | Provincial tax / total tax payable | |
| 840 / 890 | Instalments paid / total credits | |
| 894 | Refund code | e.g. "2 - Transfer to Next Year" |
| 896 | Qualifies for one-month extension of balance-due day | Confirms the 3-month balance due date directly |
| 920 | Preparer EFILE number | Tells you who has been doing the work, and when it changed |
| 950 to 957 | Signing officer name, position, date, telephone number | A contact number the Profile page does not show |
| S100 / S125 | Full GIFI balance sheet and income statement | Effectively a set of financial statements |
| S8 | CCA by class: opening UCC, additions, AIIP/DIEP, rate, CCA, closing UCC | Full continuity schedule |
| S50 | Shareholder name, masked SIN, % common, % preferred | Only filed when a 10%+ shareholder exists |

### 3.2 GST/HST returns

The per-period summary returns every line of the filed GST34: 101 sales (and 90/91 split when reported), 103 GST/HST collected, 104/107 adjustments, 105 total, 106/108 ITCs, 109 net tax, 110 instalments and other annual filer payments, 111 rebates, 205, 405, 114 refund claimed, 115 amount owing, plus filing date and status.

### 3.3 The Account transactions ledger

The single densest source in the portal, and easy to miss. Reached from any account's balance page.

Query parameters: Program account (GST/HST RT, Payroll RP, Corporation Income Tax RC, Information Returns RZ, Wage and Hiring Subsidies SA RP), Account, Balance types, Period end / tax year (or All periods), Time frame (30/60/90/180 days, 1 to 7 years, Custom). Export to CSV.

Balance types vary by account: RP offers "Tax year balances / Arrears account balances"; RC and RT offer "Interim balance and balance / Interim balance / Balance"; RZ and SA RP offer none.

Transaction types observed: Previous Balance, Payment (with date received), Payment Applied, Part I Tax, Provincial Tax, Net Tax, Instalment Interest, Arrears Interest, Administrative adjustment, Balance adjustment, Transfer to/from another period or account, Refund, Canada Carbon Rebate Business, T4 Type Information Return, Interim Balance, Balance.

Two structural points:

- The period dropdown is the authoritative list of tax years, and it reaches further back than the Returns tab. On the test account the Returns tab started later than the ledger, which held an earlier fully assessed tax year on both RC and RT.
- A period end followed by "R" is a claim period, not a reassessment. CRA states this on the page.

---

## 4. Correspondence

The Mail section (screen MBA-CC-01) holds ten years of correspondence, selected by a year dropdown or "Last 12 months".

Filters: Account type, Account number, Correspondence type, Period end, plus free-text search and an Archive tab. Each item can be flagged or archived. A "Preferences" control governs preview-pane layout only, not notifications.

Notices open in full inside the portal. A corporation notice of assessment yields: address block, business number, date issued, legal name, total balance, results calculation, and a Summary section with federal Part I / III.1 / IV tax, provincial tax, instalments applied, net balance, and an Explanation of changes section breaking out provincial basic tax, provincial SBD and net provincial tax payable. A GST/HST notice yields the line summary, a reference number, and any instalment warning.

> Important: the correspondence-type filter is populated from the client's own data, not from a fixed catalogue. On an account with only notices, it offers exactly one value. You cannot discover what CRA is capable of holding by inspecting one client's account, and a scraper that reads filter options to infer a schema will derive a different schema per client.

Connect with us (MBA-CC-03) contains no client data: it is help links, Audit enquiries, Enquiries service and Contact CRA.

Audit enquiries (A-AUD.a2) is a submission service requiring an audit case number, with a "View audit enquiry mail" history view.

---

## 5. Enquiries service: what CRA produces on request

Linked from the RC, RT and RZ account pages. Screen A-MBA-ENQ-01. This is how you obtain records the portal does not display.

| Form | What it produces | Parameters |
|---|---|---|
| Request copies of notices | Notices older than the 10 years the mailbox holds. Notice of assessment and notice of reassessment, anything issued after 30 September 2000. | Correspondence item, reporting period end, daytime phone, confirmation. Screen B-RC-OR-02. |
| Request customized statements | A statement of account for a chosen date range. | Start and end date. The permitted range runs from an early start date to the date of the last assessment; the upper bound tracks assessment, not today. Screen B-RC-OR-03. |
| Request remittance vouchers | Remittance vouchers. Also a Quick link on balance pages. | Not opened. |
| View my previous enquiries | Status of submitted written enquiries. Read-only. Screen MBA-ENQ-05. | |

The 26-year reach of the notice-copy request is the useful part: for a client with a long history and no records, it is the difference between reconstructing a file and guessing.

Caveat: RC0001 and RT0001 offer an identical three-form set. CRA's published catalogue lists payment search, refund requests and transfers of misallocated payments under payroll specifically. A dormant payroll account exposes no Enquiries link at all, so the form set is account-type-specific and should be checked per client rather than assumed. Submitting any of these is a Level 2+ action (section 8).

---

## 6. T2 Auto-fill: the channel the portal does not expose

### 6.1 What it is

A machine-to-machine download of CRA-held corporate data directly into T2 tax software. It is not a portal feature: there is no download button and it cannot be triggered from a browser. The software authenticates to CRA and pulls data into the return being prepared.

### 6.2 What it delivers

| Category | Contents | Also in the portal? |
|---|---|---|
| T2 return information | Current year plus four previous calendar years | Yes, and the portal goes deeper |
| RDTOH | Tax years ending 2018 and earlier | No |
| ERDTOH / NERDTOH | 2019 onward | Yes |
| GRIP | | Yes |
| Non-capital and capital losses | | Yes |
| Capital gains and losses | With subcategories | Partly: portal shows a single balance or "no balance" |
| Capital dividend account | CDA balance | No. Nowhere in the portal. |
| Corporation account balances | Seven-year history, interim and assessed | Yes, via the ledger |
| Business information | Address, email, return mail indicator | Partly: email and return-mail indicator are not visible to a representative |

Excluded: outstanding assessments, amounts under dispute, held credits. Every field must be verified before filing.

### 6.3 Why it matters

CDA is the reason. The capital dividend account appears nowhere in the portal, which otherwise forces a firm to track CDA manually for every client indefinitely. Auto-fill converts that standing liability into a download. Pre-2019 RDTOH and capital-gains subcategories are the same story on a smaller scale.

### 6.4 Requirements

1. Certified T2 software that supports Auto-fill. Not all do.
   - Supporting: CCH iFirm Taxprep, Corporate Taxprep, CanTax T2/T2Plus, DT Max T2, ProFile T2, QuickBooks Online Accountant Pro Tax, TaxCycle T2, TaxTron Corporate, FutureTax T2, T2Express, CloudTax T2 Basic, Tax Chopper T2, AuraTax, VisualTax T2, WebTax4B.
   - Not supporting: TurboTax Business Incorporated Online, UFile T2, Gofile.ca, DataClub Tax.
   - No free option exists on CRA's certified list. CRA does not publish pricing or per-product certified tax years; confirm year coverage before buying if catch-up filings are in scope.
2. EFILE registration in the firm's own name. The EFILE number on a client's past returns belongs to the previous preparer.
3. A live Level 2 authorization, or the owner's own credentials.

### 6.5 CCH iFirm Taxprep specifically

Certified, supports T2 Auto-fill Return. CRA lists for it: T2 Auto-fill Return, Authorization request (formerly RC59), T2054 (capital dividend election), T2SCH89 (CDA balance verification), Corporation Internet Filing, T2 Barcode, Attach-a-doc, Submit E-Docs, T1135, T1134, T106, RC4649, T5013.

Only gap versus Corporate Taxprep: Attach-a-doc SERs, meaning attaching documents to a Special Elections and Returns filing rather than to a T2. iFirm can still file the T2054; it cannot staple documents to it electronically.

The Auto-fill + T2SCH89 + T2054 combination is worth more to an owner-managed practice than the filing mechanics: Auto-fill reads the CDA balance, T2SCH89 asks CRA to verify it, T2054 files the election that spends it.

---

## 7. The Represent a Client layer

Above the client account sits a layer that operates across the whole client base.

| Service | What it gives you |
|---|---|
| Profile, Clients | The definitive list of who has authorized this RepID, in five expanders: Individuals, Businesses, Trusts, Non-resident tax account holders, Registered plans. The business list shows name, masked BN, and authorization process date. |
| Profile, Associations | Business associations and GroupID associations the RepID administers, plus "Register your business as a representative" and "Create GroupID". |
| Transactions performed on business accounts | Screen A-RAC.215. A per-client audit log of every page the RepID viewed, timestamped, for 7 / 30 / 180 / 365 days. Your access is logged in detail. |
| Download options, Manage download schedules | Scheduled recurring or one-time bulk downloads of three lists: Individual client list, Business client list, Notice list. A practice-wide data feed rather than a per-client lookup. |
| Download options, Download files | Retrieves files produced by those schedules. |
| Authorization request | Submit a new authorization request, track pending requests, review and update active authorizations. The current flow requires the client to confirm in their own My Account or My Business Account. |
| List of notices issued | Screen A-RAC.370. Individuals only: takes a SIN, not a BN. Notice types: NOA issued No Change, NOA issued Changed, NOR issued Client or rep request, Other NOR issued. Date ranges 7 to 365 days. Not usable for business onboarding. |
| Business Registration Online (BRO) | Registers a BN and program accounts. Behind an "I agree" disclaimer leading into a live registration wizard. Its privacy notice confirms it registers CRA program accounts and Ontario and Nova Scotia program accounts. Gate only; interior not entered. |
| Trust account registration | Three-step wizard (trust info, trustee info, review and submit). New trust accounts only. Needs the trust type code (e.g. Personal trust 334). Gate only. |
| Mail (rep level) | Correspondence addressed to the representative. |
| Notification preferences | Actually "Register for online mail" (A-RAC.224). T1-only: pre-assessment and processing review letters; requires EFILE numbers, ownership of them, a T183 designation and EFILE contact code 2. |
| Submit documents | Link did not navigate in build 26.08.3. |

The scheduled download facility is the piece worth building around. A firm that schedules the Business client list and Notice list stops polling individual accounts to discover that something arrived.

---

## 8. Authorization levels

### 8.1 The levels

| Level | Allows | Notes |
|---|---|---|
| 1 | View information only | Read-only |
| 2 | View and update information | The working level for a tax practice |
| 3 | View, update, and authorize other representatives | Also the only level permitted to touch banking and direct deposit |
| Legal representative | Requires a legal document appointing the representative | Separate category |

Scope is independent of level: the entire business number, a whole program (e.g. all payroll accounts), or a single program account.

Level 3 cannot be held by a GroupID or an OrgBN, only by an individual RepID. Level 3 therefore does not scale to a firm identity; it attaches to a person.

### 8.2 What each level can do

Level 1 (view only): account balance, account transactions, address, endorsements, enquiries, future balances, mail, operating names, rebate/PSB rebate, registered charity status, return details.

Level 2+ (adds): file returns, file elections, submit enquiries, submit documentation, respond to notices, register formal disputes, submit nil remittances, request CPP/EI rulings, initiate payment searches, request refunds, transfer payments and credits, make account transaction entries, update address, operating names, language preference and mailing instructions.

Level 3 only: authorize and manage other representatives; banking information; direct deposit.

### 8.3 Which level a firm wants

Level 2, full BN scope. Not Level 3.

- Level 1 cannot file a T2 or even submit the enquiry that retrieves historical notices, so it is useless to a practice.
- Level 2 covers everything a T2 and year-end practice actually does.
- Level 3's two extra powers are liabilities. The ability to change where a client's refunds are deposited is the highest-risk permission CRA grants and should not sit inside an automated workflow. Declining it is a control, not a gap.

Hold the authorization at firm level, not personal level. A bare personal RepID means every client authorization attaches to one individual: staff cannot be added without every client re-authorizing, nobody else can reach any client if that person is unavailable, and a single authorization lapse removes the firm's entire client access at once. CRA's Profile page offers "Register your business as a representative" and "Create GroupID" for exactly this.

Set no expiry date, or track expiries. CRA does not display expired or cancelled authorizations at all: no reason code, no trace.

### 8.4 What a representative cannot see or do

Confirmed on build 26.08.3. The client Profile page in the representative view contains addresses, program account names, operating names, an empty phone-numbers panel and language preference, and no representatives section. CRA's own catalogue lists "authorized representatives" as a My Business Account service, confirming the asymmetry: the owner can see and manage the representative list, a representative cannot.

The same applies to Notification Preferences and the business email address, which the Overview banner points at and which does not exist in the representative view.

The portal displays no access-level indicator anywhere: not on the client Profile, not on the rep Profile, not on the client list. To determine a representative's level, the client must check My Business Account, Profile, Authorized representatives.

### 8.5 Diagnosing an authorization failure

Entering a correctly formed BN can return "Error: REP19 Invalid Business Number (BN)". This is misleading. REP19 means no authorization on file for that BN under this RepID, not a malformed number.

Diagnostic order: check Profile, Businesses that have authorized this RepID, before troubleshooting anything else. A cleared client list reads "There are no clients on your business list", with no business associations, no GroupID associations and no pending requests. In the walk, access was lost on one day and restored later, and a new authorization process date confirmed the re-establishment.

---

## 9. Other program account types

A typical client has four program accounts, so sections 1 to 4 describe roughly a third of what CRA's business portal can contain. This section is built from CRA's published catalogue, not from the account, for the reason given in section 4.

### 9.1 Program account identifiers

| Code | Program account |
|---|---|
| RT | GST/HST |
| RP | Payroll deductions |
| RC | Corporation income tax |
| RZ | Information returns (T5, T5018, T5013, TFSA and others) |
| RR | Registered charity |
| RM | Import / export, administered by CBSA since October 2024, not CRA |
| RD | Excise duty |
| RE | Excise tax and special levies |
| RN | Insurance premium tax |
| RG | Air travellers security charge |
| LT | Luxury tax |
| RU | Underused housing tax |
| PT | Global minimum tax |

Also addressable inside the portal but absent from CRA's registration list: SA RP (Wage and Hiring Subsidies), fuel charge, partnerships.

### 9.2 Services by program account type

| Program | Services CRA lists |
|---|---|
| All programs | Manage addresses, owner phone number, notification preferences, direct deposit, authorized representatives, business numbers, program account name, language preference, CRA security options, operating names; submit documents, view mail, message centre, audit enquiries, direct deposit transactions, outstanding returns and balances, filing and balance confirmation, pre-authorized debit, non-resident tax account, Provincial Partners (Nova Scotia) |
| GST/HST | File a return, view expected and filed returns, adjust returns, file and view rebates, adjust public service body rebates, file and view elections, view and pay account balance, register a formal dispute (Notice of Objection), view direct deposit transactions, calculate instalment payments, enquiries service, close account |
| Payroll | File a return, view return details, provide a nil remittance, respond to notices, PIER overview, request account closure, view and pay balance, view remitting requirements, register a formal dispute (Appeal), request a payment search, request a refund, transfer misallocated payments, download reports, request CPP/EI rulings and refunds |
| Corporation income tax | Transmit returns, view status and balances, view and pay account balance, view special elections and returns, register a formal dispute (Notice of Objection), view direct deposit transactions, calculate instalments, enquiries service, request account closure |
| Information returns | File a return, view return details, download error notifications (Parts XVIII and XIX), view direct deposit transactions, download reports, close account |
| Excise duty | File a return, request refunds, view transaction details and endorsements, view and pay balance, register a formal dispute, view direct deposit transactions, enquiries service |
| Excise tax | Same set as excise duty |
| Excise tax on insurance premiums | Request refunds, view transaction details and endorsements, view and pay balance, register a formal dispute, view direct deposit transactions, enquiries service |
| Air travellers security charge | File a return, request refunds, view transaction details and endorsements, view and pay balance, register a formal dispute, view direct deposit transactions, enquiries service |
| Fuel charge | File a return, view transaction details and endorsements, view and pay balance, register a formal dispute, view direct deposit transactions, enquiries service, fuel charge registry |
| Registered charity | View program account details, apply for registration, view application status, file and adjust returns, view expected and filed returns, update information |
| TFSA | File a return, view return details, download rejected records, view direct deposit transactions, download reports, close account |
| Partnerships | File a return, view transaction details and endorsements, view and pay balance, view special elections and returns, register a formal dispute, enquiries service, download reports, close account |
| Contract payments (T5018) | File a return, view return details, view direct deposit transactions, download reports, close account |
| Luxury tax | File a return, view account activities and endorsements, view and pay balance, register a formal dispute, request penalty and interest relief, view direct deposit transactions, enquiries service |
| Underused housing tax | File a return, view and pay balance, register a formal dispute, request penalty and interest relief, view direct deposit transactions, enquiries service |

### 9.3 Consequences for onboarding design

- Do not hard-code four account types. Read the account list from the Overview page. A construction client brings T5018, a landlord brings underused housing tax, an importer's RM account is not even at CRA any more.
- Check for live formal disputes. Notices of objection and payroll appeals are listed services on most account types. A client with a live dispute changes what the firm can safely do.
- Account closure and nil remittance are online services, relevant to any dormant account still generating filing expectations.
- Several high-value fields are owner-only and stay on the ask-the-client list permanently unless the client is walked through reading them.

---

## 10. The onboarding matrix

### 10.1 Where each field comes from

| Source | Fields |
|---|---|
| Portal, any authorized client | Legal name; BN; all program accounts, balances and outstanding-return flags; tax year end; three addresses per account (mailing, physical location, books and records); operating names; program account names; language preference; GST/HST filing frequency and all elections including quick method with effective date; payroll remitter type, frequency and due dates; every filed return with status and date; every line of every filed GST/HST return; every line of every filed T2 with all schedules including the GIFI balance sheet and income statement; non-capital and capital loss balances; GRIP; ERDTOH and NERDTOH; full dated transaction ledgers with CSV export; per-period interest; information-slip filings with submission numbers and slip counts; ten years of correspondence including full notices of assessment; Canada Carbon Rebate history; preparer EFILE number; signing officer name and contact telephone |
| Portal, owner login only | Authorized representative list and their access levels; notification preferences and business email address; CRA security options; pre-authorized debit; message centre |
| T2 Auto-fill (software required) | Capital dividend account; pre-2019 RDTOH; capital gains subcategories; return mail indicator; business email |
| Enquiries service (on request) | Notices of assessment and reassessment back to 30 September 2000; customized statements of account for a chosen date range; remittance vouchers |
| Rep portal, practice-wide | Business and individual client lists; notice lists; scheduled or one-time bulk downloads; per-client access audit log |
| Nowhere at CRA; must ask the client | Incorporation date and jurisdiction; current shareholder register and share-class terms; officers other than the signing director; Ontario and federal corporate registry filing status; banking and card access; provincial filings administered outside CRA (e.g. Alberta AT1) |

### 10.2 Build notes

1. Pull the ledger first, not last. One query per program account with the time frame at maximum returns the entire payment and assessment history, CSV-exportable.
2. Never trust a single "no returns filed" message. Cross-check against the ledger (see 2.3).
3. The returns tab is not the full history. The period dropdown in the ledger is authoritative and reaches further back.
4. Check line 750 against the address on file, automatically. One code silently decides which province gets taxed, and nothing in the portal flags a mismatch.
5. Reconcile dividends three ways: Schedule 3 line 450 against Schedule 100 line 3700 against the RZ slip count.
6. Check the elected GST method against the filed numbers. The election is machine-readable on the Elections tab and the implied rate is computable from the return lines.
7. Flag unread mail count on day one. A high count means the client is not receiving CRA correspondence, usually because no email address is on file.
8. Compute instalment obligations; the portal will not warn you. CRA gives the instalment base and expects you to do the arithmetic.
9. Verify the page you landed on. Build 26.08.3 does not reliably navigate from left-nav sub-links or some breadcrumbs.
10. Expect the selector, representative, client traversal. Deep links do not work from a cold session.

---

## 11 and 12. Dropped: one taxpayer's data and findings

The original sections 11 and 12 held one real corporation's verified data and findings: identity, multi-year T2 figures, balance sheet, CCA, GST/HST returns, payroll ledger, information-slip filings, shareholders, the mail inventory and a list of open items. A section like this shows what a live account yields for one client and the cross-checks that flagged problems (province code against address, dividend three-way reconcile, quick method against filed numbers, unpaid instalments, unread mail). No values are kept here. Use made-up clients under reference/sample-clients/ for worked examples.

---

## 13. Deadlines, limits and sources

### 13.1 Deadline rules as published

| Obligation | Rule as published |
|---|---|
| T2 return filing | Six months after tax year end |
| Corporate balance of tax | Two months, or three months for a CCPC that was a CCPC throughout the year, claimed the SBD in the current or previous year, and whose prior-year taxable income did not exceed the business limit. Line 896 of the T2 confirms eligibility directly. |
| Corporate instalments | Required unless tax payable is $3,000 or less in the current or previous year. Quarterly instalments fall a quarter less a day from the start of the tax year (Mar 31 / Jun 30 / Sep 30 / Dec 31 for a December year end). CCPC quarterly eligibility requires a perfect compliance history, taxable income of $500,000 or less and taxable capital of $10M or less, combined with associated corporations. |
| GST/HST return and payment, annual filer | File and pay three months after fiscal year end. The April 30 / June 15 variant applies only to self-employed individuals, not corporations. |
| GST/HST instalments | Required where the previous fiscal year's net tax is $3,000 or more. Due one month after each fiscal quarter (Apr 30 / Jul 31 / Oct 31 / Jan 31 for a December year end). |
| Payroll, quarterly remitter | The 15th of the month following quarter end: Apr 15, Jul 15, Oct 15, Jan 15. |
| T4 and T5 information returns | Last day of February following the calendar year. |
| Ontario annual return | Within six months of fiscal year end, filed with the Ontario Business Registry under the Corporations Information Act. No longer filed with CRA on the T2, so CRA holds no record of it. |
| Federal (CBCA) annual return | Within 60 days of the incorporation anniversary, filed with Corporations Canada. |
| Ontario initial return | Within 60 days of incorporation, once. |
| Alberta AT1 | Within six months of year end where the corporation had an Alberta permanent establishment at any time in the year, unless exempt. |
| Objection | 90 days from the date of the notice. |

Rate note: Ontario's small business rate is 3.2% (11.5% general less an 8.3% deduction), legislated to fall to 2.2% effective 1 July 2026, making a December 2026 year end a split-rate year. Proration mechanics not verified.

### 13.2 Limits of this reference

| Item | Status |
|---|---|
| Other program account types | Section 9 is documentation-based. No account of any other type was available to walk; none of it is screenshot-verified. |
| T2 Auto-fill payload | Section 6 is CRA's specification. No download was performed; it requires certified software. |
| Payroll Enquiries form set | Unverifiable on a dormant payroll account, which exposes no Enquiries link. |
| BRO interior | Behind an "I agree" gate into a live registration wizard. Not entered. |
| Trust account registration interior | Three-step wizard. Not started. |
| Submit documents (rep level) | Link does not navigate in build 26.08.3. |
| Instalment calculator step 2 | Opened with authorization; not completed, because it requires typing estimated tax into form fields. |
| Request remittance vouchers | Not opened. |
| Access level of the test RepID | Not determinable from the portal. Circumstantially Level 2, since the Enquiries service rendered submittable forms, but no Level 2 action was attempted. |

### 13.3 Sources

Checked in September 2026.

- Balance-due day: `canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-payments/paying-your-balance-corporation-tax/balance-day.html`
- Corporate instalment requirements: `.../corporation-payments/paying-instalments/instalment-requirements.html`
- Corporate instalment due dates and CCPC quarterly eligibility: `.../corporation-payments/paying-instalments/instalment-dates.html`
- GST/HST instalments, who must pay: `.../gst-hst-businesses/pay-instalment/need-to-pay-by-instalments.html`
- GST/HST instalment due dates: `.../gst-hst-businesses/pay-instalment/when-to-pay.html`
- Quick method of accounting, guide RC4058: `canada.ca/en/revenue-agency/services/forms-publications/publications/rc4058/quick-method-accounting-gst-hst.html`
- 2026 tax deadlines for Canadian businesses: `canada.ca/en/services/taxes/resources-for-small-and-medium-businesses/2026-tax-deadlines-canadian-businesses-self-employed-individuals.html`
- Ontario small business deduction: `.../provincial-territorial-corporation-tax/ontario-provincial-corporation-tax/ontario-small-business-deduction.html`
- Ontario corporate income tax rates: `ontario.ca/document/corporations-tax/corporate-income-tax`
- Ontario annual return: `ontario.ca/page/annual-return-filing-corporations-information-act`
- Federal annual return: `ised-isde.canada.ca/site/corporations-canada/en/annual-return-business-corporations`
- Alberta corporate income tax and AT1: `alberta.ca/corporate-income-tax`
- About T2 Auto-fill: `canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/about-t2-auto-fill.html`
- Corporation Internet Filing certified software: `.../digital-services-businesses/corporation-internet-filing/software.html`
- Services in My Business Account: `.../business-account/about-business-account/services-my-business-account.html`
- Program accounts you may need: `.../business-registration/business-number-program-account/need-program-accounts.html`
- Levels and scope of authorization: `canada.ca/en/revenue-agency/services/tax/representative-authorization/access/levels-scope.html`
- Services for representatives of businesses: `canada.ca/en/revenue-agency/services/e-services/represent-a-client/list-services-representatives-businesses.html`

### 13.4 Screenshot evidence

The original walk had a screenshot register in a Word document that stays on the laptop only. It is omitted here.
