# CRA My Account (Represent a Client) for individuals: what it can supply

Capability-only copy of Zo's CRA walk (2 Oct 2026), real data removed under decision 0003; the original stays on the laptop only.

A reference for digital client onboarding. Companion to reference/cra/business-account.md.

| | |
|---|---|
| **Purpose** | Establish what an individual (T1) client's account supplies to an authorized representative, so the firm only asks a new client for what CRA cannot supply. |
| **Method** | One read-only walk of one live account in October 2026. Rules were checked against canada.ca on the walk date. |
| **Test subject** | <client name>, an individual (SIN entry); an Ontario resident, salaried (T4) client with small investment accounts and about twelve assessed T1 years. |
| **Access used** | Represent a Client, <RepID>. Authorization process and effective dates: <date>. |
| **Portal build** | 26.08.3 (September 2026), the same build as the business walk. |
| **Scope of actions** | Nothing was filed, submitted, paid, requested, uploaded, downloaded or changed. No form that requires a SIN was filled in. One side effect: opening one notice of assessment marked it as read (unread count dropped by one). See 4.2. |

### How to read this document

Sections 1 to 4 describe capability: what the portal holds, where, and how deep. This part applies to any individual client.
Section 5 covers channels outside the portal: Auto-fill My Return and the Client Data Enquiry.
Section 6 covers the Represent a Client layer for individuals. Section 7 covers authorization levels. Section 8 is the onboarding matrix.
Sections 9 and 10 of the original held one person's figures and findings and are dropped (see below). Section 11 is deadlines, limits and sources.

### Differences from the business portal

| Topic | Business (RC/RT/RP/RZ) | Individual (T1) |
|---|---|---|
| Return detail | Full filed T2 with every schedule, reported and assessed values side by side | A CRA-selected subset of T1 lines, assessed values only (3.1) |
| Return history | Returns tab and ledger | Line-level view for every year assessed (about twelve years) |
| Transaction ledger | Multi-year, CSV export, 7-year window | Statement of account covers only the prior calendar year to date, no export (2.4) |
| Third-party data | None (the business files its own slips) | Box-level detail of every slip issued to the client, 10 years (3.3) |
| Highest-sensitivity page | Banking (owner only) | Proof of income statement shows the full unmasked SIN and date of birth (2.3.6) |
| Reading a notice | Did not change state | Opening a notice marks it read (4.2) |
| Submit documents | Link did not navigate | Works (4.4) |

---

## 1. Account structure

### 1.1 Entry path

From the Represent a Client home page (`#/rep/rac/welcome`), the representative enters the client's 9-digit SIN in the "Access SIN" field. The client account then loads at `#/ind/overview`. The same landing page takes BN, T3, NR and RP identifiers (see the business reference, 1.2).

Session behaviour, verified: inside a warm session, deep links to `#/ind/...` routes work, and a full page reload keeps both the session and the selected client. This differs from the business walk, which found that cold-session deep links bounce to the account selector.

### 1.2 Header

Every client page carries a strip reading "Individual client / <client name>" and a check-mark banner "Client has full My Account access." What this banner means is not documented on canada.ca. It may mean the client is registered for My Account, which is what makes the "client confirms in My Account" authorization route possible. That is inference, not verified. It is not an authorization-level indicator. Pages under `#/cus/...` (statement of account, submit documents, formal dispute, audit enquiries) drop this strip.

The representative's options menu (top right) shows the representative's own name and masked SIN, then: My Account, Represent a Client, View all accounts, Sign out.

### 1.3 Navigation map

| Left-nav item | Route | Screen ID |
|---|---|---|
| Overview | `#/ind/overview` | A-MAO.a1a |
| Client data enquiry | `#/ind/rep/client-data-enquiry` | A-SEND.001 |
| Client summary | `#/ind/rep/client-summary` | A-MAO.a1g |
| Tax returns | `#/ind/returns/tax-returns` | A-MAO.a1b |
| Accounts and payments | `#/ind/accounting/accounting-summary` | A-MAO.a1c |
| Benefits and credits | `#/ind/benefits/benefits-summary` | A-MAO.a1d |
| Savings and pension plans | `#/ind/savings/savings-plan-summary` | A-MAO.a1e |
| Progress tracker | `#/ind/progress-tracker` | A-UISP-PROGTRKR-001 |
| More services, Trust account registration | `#/ind/trust-account-registration/register` | A-TAR-01 |
| More services, Open a non-resident tax account | `#/ind/open-non-res-account/home` | A-NR-01 |
| More services, File a GST/HST rebate | `#/ind/returns/tax-returns/file-gst-hst-rebate` | A-SP-01 |
| More services, File an XE8 refund application | `#/ind/refund/xe8` | A-XE8-NBC-01 |
| Correspondence, Mail (unread badge) | `#/ind/communications/home` | MA-CC-01 |
| Correspondence, Submit documents | `#/cus/sdocs/home-history` | A-GEN-SD-05 |
| Correspondence, Connect with us | `#/ind/communications/connectWithUs` | n/a |
| Correspondence, Audit enquiries | `#/cus/audit-enquiries` | A-AUD.a1 |
| Correspondence, File a formal dispute | `#/cus/ffd` | (register page) |
| Correspondence, Request a CPP/EI ruling | `#/ind/cppei` | (request page) |

Sub-pages reached from these are listed in section 2 with their own routes and screen IDs.

### 1.4 What is not there

There is no Profile section for the client. A representative cannot see or change the client's marital status record, children, phone numbers, email, notification preferences, direct-deposit banking details, language, or authorized representatives list. CRA's service list reserves personal information, representative authorization, direct deposit, pre-authorized debit, DTC Part A and benefit applications for a legal representative (section 7). The home address is still visible to any representative on the statement of account, the notice of assessment and the proof of income statement. It just cannot be changed.

---

## 2. What each section holds

### 2.1 Overview (A-MAO.a1a)

Five cards plus quick links:

| Card | Contents |
|---|---|
| Tax returns | Latest year assessed, refund or balance and how it was paid (for example "deposited directly into your bank account on <date>"), link to that year's NOA, Change my return |
| Accounts and payments | Income tax balance, Statement of account |
| Benefits and credits | Whether any payments are expected |
| Savings and pension plans | Current-year RRSP deduction limit, HBP required repayment (with a year label, see 8.2 note 6), TFSA room as of 1 January with a "Warning" flag |
| Progress tracker | Files submitted to CRA being tracked |
| Quick links | Tax information slips (up to ten years), Uncashed cheques (6+ months old), Tax schemes (external) |

### 2.2 Client data enquiry (A-SEND.001)

A one-screen pre-filing check, the Represent a Client version of CRA's Client Data Enquiry (section 5.2). Three tiles:

| Tile | Text |
|---|---|
| Current tax year return | "A tax return has already been filed for the <year> tax year for this client." |
| No client debt | "There is no outstanding balance with the CRA or with any other federal, provincial, territorial, agency, or Crown corporation programs." This covers set-off debts outside CRA, which nothing else in the portal shows. |
| Recent page access | "Our records show that information on this client's account has previously been requested by another electronic filer since <date>." |

The third tile is an onboarding signal: it tells you another preparer has pulled this client's data this season, without saying who.

### 2.3 Tax returns

#### 2.3.1 Tax returns page (A-MAO.a1b)

| Element | Detail |
|---|---|
| NETFILE access code | Displayed in clear at the top of the page. Also printed on the NOA. Treat it as a credential. |
| Returns table | Year, Status (link), Notice of Assessment or Reassessment (link), Date processed. Paginated 5 per page. One row per assessed year. |
| Special elections & returns | Points to Mail for SER letters. "Our records do not show any special elections and returns to display." when none. Link to canada.ca SERs page. |
| Carryover amounts | Link to the carryover page (2.3.4). |
| Disability tax credit (DTC) | Claim history in one sentence, for example "According to our records, you have never claimed the disability amount." |
| Links | Change my return; Tax information slips; Proof of income statement; Underused housing tax; File a GST/HST rebate; File an XE8 refund application. |

#### 2.3.2 Assessment view (A-VMR.b2, `#/ind/returns/assessment`)

Reached by clicking a year's Status link (from Tax returns or Client summary). This is the T1 equivalent of the T2 "View Return" page, but shallower.

Header for every year: filing date, date of assessment, marital status, taxing province, province of residence.

Body, with Expand all / Collapse all and a Change my return button:

- Total income; Net income; Taxable income; Refund or balance owing
- Federal Tax, Schedule 1: federal non-refundable credits; net federal tax
- Federal Schedules: whichever apply. Seen: S3 capital gains, S6 Canada workers benefit, S7 RRSP, S8 CPP, S11 tuition, S13 EI, S14 Climate Action Incentive, T2209 foreign tax credits, T936 CNIL
- Provincial tax (ON428): non-refundable credits, Ontario Health Premium, Ontario tax, provincial S11 tuition
- ON-BEN application (Ontario Senior Homeowners' Property Tax Grant question)
- Link: Carryover amounts

Depth: one "$ Amount" column holding assessed values only. There is no reported-versus-assessed comparison. It is a subset of the return: some items (for example an HBP withdrawal, or refundable credits beyond those listed above) may not show. Pre-2019 years use the old 3-digit line numbers (101, 150, 236, 260, 300...) and 4-digit provincial lines (5804...).

Reach: every assessed year, including the earliest, which may have no NOA link at all. Opening this view did not change the mail read count.

#### 2.3.3 Notice of assessment view (MA-CC-02, `#/ind/communications/ricc-view/<token>/08`)

A full HTML rendering of the notice with a PDF button and Print/Save.

| Block | Contents |
|---|---|
| Notice details | Name and full home address, SIN masked to last three digits, tax year, date issued, tax centre, access code |
| Account summary | Refund or balance |
| Tax assessment summary | Line, description, final amount, CR/DR: 15000, deductions from total income, 23600, 26000, 35000, 61500, 42000 net federal tax, 42800, 43500, 43700, 48200, balance, direct deposit |
| Explanation of changes | CRA's free-text notes, for example the RRSP-limit basis, or a request for a birth certificate because the date of birth on the return differs from CRA's record |
| RRSP deduction limit statement | Unused room at end of year, 18% of earned income vs dollar cap, PA, PSPA, PAR, next year's limit, unused contributions previously reported, available contribution room |
| HBP statement | Total withdrawals (by year), repayments, balance, years left, minimum required repayment for next year |
| Standard footer | Phone numbers, change-return and dispute routes, the 90-day dispute reference |

Opening a notice marks it read in Mail (4.2).

#### 2.3.4 Carryover amounts (A-VMR.b4, `#/ind/returns/carryovers`)

Four paginated tables where the client has data:

| Table | Columns |
|---|---|
| Capital gains and losses | Year, inclusion rate, line 127, unapplied net loss, net loss applied from prior year, net loss applied from subsequent year |
| Capital gains deduction | Year, CGD claimed, net investment gain/loss, farm property, small business shares |
| Federal tuition, education and textbook | Year, amount from prior year, current year amount, current year applied, transferred, prior year applied, available to carry forward |
| Provincial tuition, education and textbook | Same columns |

The same four tables also appear on the Client summary. Tables appear only where the client has data. No table was rendered for non-capital losses, donations, medical or other carryforwards, because the test client had none. Do not infer the catalogue from one client (the same lesson as the business reference, section 4).

#### 2.3.5 Tax information slips (A-TIS.01, `#/ind/returns/infoslips`)

The densest third-party source for individuals.

| Element | Detail |
|---|---|
| Selectors | Tax year (ten years: 2016 to 2025 on this build) and Information slip (populated per year from the client's own data, plus "All slips"). Then View. |
| List | Issuer's name, slip type, type (Original / Amended, as a link), date processed. "Open PDF" for the list. |
| Detail | `#/ind/returns/infoslips/{year}/all/{index}`: every box with box number, box name and value, plus "Other information" boxes, Print/Save as PDF and a download icon. |
| Slip types seen | T4, T4A, T5, T3, T5008, T4RSP, T2202, RRSP contribution receipt, TFSA record. |

Detail-screen specifics:

- T4: boxes 10, 14, 16, 16A, 17, 17A, 18, 20, 22, 24, 26, 28 exemptions, 44, 45, 46, 52, 55, 56, plus other-information codes (seen: 40, 57 to 60, 84, 90).
- T3 (A-TIS.24): beneficiary code, boxes 21, 23, 26, 30, 32, 39, 49, 50, 51, plus other information (seen: 25, 34, 37, 52, 53, 58, 59). Labels for boxes 53, 58 and 59 render as raw template keys ("slip.17.box.58.name"). A display bug in build 26.08.3.
- T5008: security description, CUSIP/ISIN, quantity, cost or book value and proceeds. Enough to recompute the gain.
- RRSP contribution receipt (A-TIS.30): specimen plan number, contract number, spousal flag, "Amount prior year" and "Amount current year" (the two contribution windows).
- TFSA record (A-TIS.41): contract number, new-account flag, number of transactions, total contributions, total withdrawals, year-end FMV, closure, death and successor-holder fields, non-qualified investment acquisitions/withdrawals, marriage-breakdown transfers. Marked "for information purposes only".
- T2202 (A-TIS.51): school type, program, up to four session periods (from, to, fees, part-time and full-time months), totals.
- T4RSP: spousal flag, box 27 HBP withdrawal.

The "date processed" column matters. Slips processed after the client's filing date are the commonest cause of reassessment. Compare each slip's date processed with the return's filing date.

Mechanics: a detail route only renders after that year's list has been loaded in the same session. Switching straight from one slip route to another can render the previous slip's content. Reload, or hop through another route, between slips.

#### 2.3.6 Proof of income statement (A-POI.001 to A-POI.004, `#/ind/returns/poi`)

Tax year selector 2016 to 2025 (ten years; CRA's own help text says three), then Search, then a statement with Print/Save PDF and download.

The statement header carries name, home address, tax year, taxing province, filing date, date of assessment, the full unmasked SIN, province of residence, the full date of birth, and marital status. The body repeats the assessment-view lines (2.3.2).

> This is the only page in the representative view that exposes the full SIN and date of birth. Exclude it from any scraping, logging or screenshot pipeline by default. Generate it only when a client asks for one.

#### 2.3.7 Change my return (A-NRO.a1, `#/ind/returns/cmr/begin`)

A four-step flow: select tax year, change my return, provide additional information, review and submit. Year selector 2016 to 2025. The "Ineligible changes" panel lists: unassessed returns; years with 9 reassessments already; bankruptcy returns and the year before; certain international and non-resident returns (sojourners, s.116/216/217, OASRI); returns needing T2203 (multiple-jurisdiction business income); returns filed by CRA under s.152(7). Not started.

#### 2.3.8 Underused housing tax (`#/ind/uht`)

File a UHT return; make a payment ("select Individual income tax (T1)", debit only, no credit cards); View UHT return table (year, property address, status, action, with filters). Empty when none filed.

### 2.4 Accounts and payments (A-MAO.a1c)

| Element | Detail |
|---|---|
| Account balance | Income tax balance; Statement of account |
| Available payment(s) | Balance (credit); Make an online request with two buttons: Payment transfer (A-MAOR.01: select payment, destination, review and submit) and Refund (C-MAOR.01: select payment, review and submit). Both read "You have no payments to transfer or refund at this time." when none. |
| Payments made on filing | Payments sent with a return not yet assessed |
| Instalments | Year and "Total amount of instalment payments to be entered on line 47600". |
| Uncashed cheques (A-UISP-UNCHQ-001) | CRA cheques 6+ months old. Shows a generic "Sign up for direct deposit" banner even when direct deposit is set up. |
| Request relief of penalties and interest (A-TRR.a1) | Three steps. Personal accounts only. Representatives with many clients and the same reason are told to use RC4288 via Submit documents (bulk topic). |
| Request a remittance voucher (A-UISP-RMV.001) | Two steps. Mailed in 10 to 14 business days. Cannot be printed. |

Statement of account (A-ACC.a2a, `#/cus/soa`). The page shows the client's name and full home address. Account type selector: Income tax or Canada Carbon Rebate. Columns: date, details, debited, credited, balance.

- Window: begins with the prior calendar year's activity: a "Balance forward" line, then the assessments (provincial tax, federal tax, tax deductions applied, refund issued). There is no date-range control and no CSV export. This is the biggest gap against the business ledger, which reaches seven years.
- The Canada Carbon Rebate view (`#/cus/soa/benefits/CIISS`) shows rebate underpayment and deposit lines. Selecting it from the dropdown and pressing View returned no transactions; the direct route worked.

### 2.5 Benefits and credits (A-MAO.a1d)

| Program | Detail |
|---|---|
| Canada child benefit | Received or not, with a link |
| Canada Groceries and Essentials Benefit (formerly the GST/HST credit) | Payments page (A-CFBO.fp, `#/ind/benefits/payments/GSISS`): current benefit year, next payment date and amount. The rename took effect July 2026 (verified on canada.ca). |
| Canada Carbon Rebate | Payments (A-CFBO.ap: benefit year, payment date, amount, status) and Statement of account |
| Ontario trillium benefit | Payments (A-CFBO.gp: benefit year, next payment date and amount) |
| Disability tax credit | Claim history plus a table of digital DTC applications (name, year submitted, Part A, Part B, application summary). Paper and Submit-documents applications are tracked in Progress tracker instead. |
| Statement of income (A-SOI-01) | A three-step form (marital status and mailing address, income information, review and submit) for world income of newcomers and non-resident spouses, for CCB and CGEB. Not started. |

Benefit payment pages show the current benefit year only. There is no payment history and no entitlement calculation. Historical benefit notices exist only in Mail.

### 2.6 Savings and pension plans (A-MAO.a1e)

| Element | Route / Screen | Detail |
|---|---|---|
| RRSP deduction limit | A-MAO.a1e | Current-year limit |
| Calculation of current-year limit | `#/ind/savings/overview/cy-deduction-calc/<year>`, A-RSP.b1 | Three steps: unused limit at prior year end (limit, minus deducted, minus employer PRPP); 18% of prior-year earned income (the earned income figure itself is shown) vs dollar cap, minus PA and prescribed amount; plus or minus PSPA and PAR. |
| Prior years RRSP deduction limits | `.../py-deduction`, A-RSP.b2 | 35 years, from 1991, one figure per year |
| Unused contributions | `.../unused`, A-RSP.c1 | Opening unused + contributions (including transfers) - HBP/LLP repayments - deducted = closing unused |
| Prior year RRSP contribution history | `.../py-contribution` | 34 years, from 1991, the same five-line roll-forward per year. This is CRA's record of what the client reported on Schedule 7, not what the issuer receipted. Compare it with the receipts in 2.3.5. |
| TFSA | `#/ind/savings/tfsa/tfsaMainMenu` (A-TFSA.a1), then Contribution room (A-TFSA.a2) | Room on 1 January for the current and prior year; per-year calculation; a warning when issuer data for the prior year is missing; room history back to the first eligible year (2009 onward for those eligible), each date linking to that year's calculation; a calculator (TFSA.a18) showing CRA's 8-line calculation plus a "do your own calculation" mode that CRA states it does not keep. The room page only renders when reached by clicking from the TFSA menu; a direct reload renders it empty. |
| HBP | `#/ind/savings/hbp-llp/hbp-details` (A-HBP.a1) | Participation year; withdrawals, prior repayments, cancellations, income inclusions paid and owing, spousal transfer, balance; required repayment, repayments to date and remaining for the current repayment year, and next year's required repayment |
| FHSA | | Held or not, with instructions if Schedule 15 data is missing |
| LLP | | Held or not |

### 2.7 Progress tracker (A-UISP-PROGTRKR-001)

"Progress tracker: All files". Tracks submitted files (paper DTC applications, Submit-documents uploads and the like).

### 2.8 More services (application gates only)

| Service | Steps behind the gate |
|---|---|
| Trust account registration (A-TAR-01) | New trust accounts only: trust information, trustee information, review and submit. Needs the trust type code (for example Personal trust 334). |
| Open a non-resident tax account (A-NR-01) | Account information, income information, payment information, review and submit. A representative can open one for a Canadian payer, a withholding agent or a non-resident payee. |
| File a GST/HST rebate (A-SP-01) | Select rebate, upload support, claimant information, review and submit. Five forms are offered: GST189 (reason codes 1A, 1C, 7, 9, 12, 13, 16, 20 only), GST190 (types 2, 3, 5 only), GST191, GST495, GST524 (types 6, 7, 9A, 9B only). |
| File an XE8 refund application (A-XE8-NBC-01) | Claimant information, claim information, review and submit. Needs medical certification (letter or T2201) of a permanent mobility impairment. |

---

## 3. The deep data: what the portal yields per individual

### 3.1 Return data, by year

From the assessment view (2.3.2), for every assessed year:

- Filing date and assessment date, which give a late-filing history directly
- Marital status, taxing province, province of residence as assessed
- Total, net and taxable income, with the component lines the client used
- Tax withheld, total payable, refund or balance
- Federal and provincial non-refundable credits by line
- Schedule-level detail for S3, S6, S7, S8, S11, S13, S14, T2209, T936 where used

High-value lines to key on:

| Line | Field | Why it matters |
|---|---|---|
| Header | Filing date | Late-filing history without asking |
| Header | Taxing province vs province of residence | Province mismatch detector |
| 10100 | Employment income | Tie to T4 box 14 |
| 12100 / 12700 | Interest / taxable capital gains | Tie to T5, T3 box 21, T5008 |
| 20800 / 24500 | RRSP deducted / RRSP contributions (S7) | Tie to receipts; unused contributions |
| 22900 | Other employment expenses | T2200 must be on file |
| 32300 / S11 | Tuition claimed | Tie to T2202 |
| 38102 | "Claiming the basic Canada workers benefit?" | Software default noise: check it is answered on purpose |
| 43100 / 52730 to 52780 | Foreign tax credit by country | Tie to T5 box 15/16 and T3 box 25/34 |
| 43700 | Tax deducted at source | Tie to slip box 22 totals |
| 47600 | Instalments | From the Instalments table (2.4) |

### 3.2 Slip data, by year

Ten years of box-level slip data (2.3.5). This makes automated reconciliation of slips to filed returns possible for every year in that window.

### 3.3 Registered-plan data

| Data | Years available |
|---|---|
| RRSP deduction limit | 1991 to current |
| RRSP contributions reported, deducted, unused | 1991 to prior year |
| RRSP contribution receipts (issuer side) | 10 years (slips) |
| TFSA room | First eligible year to current |
| TFSA issuer records | 10 years (slips) |
| HBP / LLP | Participation year to current, plus next year's requirement |
| FHSA | Status only unless held |

### 3.4 Depth by data type

| Data | Years in portal |
|---|---|
| Assessment status table | Every assessed year (about 12) |
| Line-level assessment view | Every assessed year |
| NOA documents | About 11; in Mail about 10 |
| Tax slips | 10 |
| Proof of income | 10 |
| Change my return | 10 |
| Mail | About 10 years |
| Statement of account | Prior calendar year to date |
| Benefit payments | Current benefit year only |

---

## 4. Correspondence

### 4.1 Mail (MA-CC-01)

| Element | Detail |
|---|---|
| Controls | Access services, Print/Save, Preferences; filters Correspondence type (Letters, Notices: populated from the client's own data), Date range (year), Tax year; Mail and Archive tabs; search; sort by date |
| Per item | Title, unread marker, reference number (NOAs), date, flag, move to archive |
| Count | "<n> items (<n> unread)" |
| Item types seen | Notice of assessment; Notice of assessment (HTML version) (a duplicate entry per NOA from 2022 on); Canada Carbon Rebate notice; CGEB notice and OTB notice (older benefit notices, now labelled CGEB); Home Buyers' Plan: Important information |

No "mark as unread" control was visible.

### 4.2 Viewing changes state

> Opening a notice marks it read. Opening an NOA from the Tax returns page dropped the unread count by one. The read item was the "Notice of assessment" entry, not the HTML-version entry. The line-level assessment view (2.3.2) and the slips pages did not change the count. An onboarding scraper should take NOA figures from the assessment view and read only the Mail list, so the client's unread state stays intact. This differs from the business walk, which recorded no state change from reading.

### 4.3 Connect with us

Help links only: help with My Account, authorize a representative, about My Account, cancel a representative's authorization, help with your CRA account, social media; plus summaries of audit enquiries, formal dispute and CPP/EI rulings. No client data.

### 4.4 Other correspondence services

| Service | Detail |
|---|---|
| Submit documents (A-GEN-SD-05 history, then A-MAU.a1b) | History ("No documents have been submitted" when none), then a three-step upload: case/reference number, attachments, review and submit. Works at the individual level (the business walk found the rep-level link dead). |
| Audit enquiries (A-AUD.a1) | Requires an audit case number. Two steps. "View audit enquiry mail" history link. |
| File a formal dispute (`#/cus/ffd/register`) | Notice of objection to an assessment, reassessment, determination or redetermination, sent to the Appeals intake centre; also CPP/EI ruling appeals to the Minister. States the individual time limit (11.1). |
| Request a CPP/EI ruling (`#/ind/cppei/request`) | Worker-status rulings only. Not for EI or CPP benefit applications. No hypothetical situations. |

---

## 5. Channels outside the portal

### 5.1 Auto-fill My Return (AFR)

The T1 equivalent of T2 Auto-fill: a download from CRA into EFILE-certified tax software, not a portal feature. Requirements per canada.ca: registered electronic filer, CRA account with Represent a Client, a RepID, GroupID or BN, EFILE-certified software, and client authorization.

canada.ca names, among other items: T4E, T4A, T4A(P), RC210, RC62, social assistance and workers' compensation, Canada workers benefit, HBP and LLP repayment status, federal and provincial tuition carryforwards, DTC eligibility, balance owing, reassessment information, CEB debt indicator. The full list on canada.ca sits in collapsed sections that could not be expanded, so it is not verified whether AFR also delivers T4/T5/T3 box data, RRSP limits or TFSA data to representatives. [inference] It probably does for slips and RRSP; unverified.

### 5.2 Client Data Enquiry (CDE)

canada.ca describes CDE as a service delivering current-year client information through AFR, and states "CDE is also available in Represent a Client". That is the page in 2.2. Listed contents include: HBP/LLP repayment, social assistance and workers' compensation, T4E, CWB, UCCB, tuition carryforwards, CPP and pension income, DTC eligibility, balance owing and refund set-off, bankruptcy and insolvency indicators, GST/HST return status, immigration and emigration dates, EFILE ineligibility and non-resident deduction indicators, CEB debt. The Represent a Client screen showed only three tiles on the test client. Fields with nothing to report probably do not render, but that is unconfirmed.

---

## 6. The Represent a Client layer for individuals

| Service | What it gives you | Verified |
|---|---|---|
| Profile, Individuals that have authorized this RepID (A-RAC.08) | Search by last name; table of individual name, masked SIN, authorization process date and authorization effective date. Expired, cancelled or non-online authorizations are not shown. Clicking a name leads to deleting the authorization, so it was not clicked. | Yes |
| Transactions performed on individual accounts (SIN) (A-RAC.82) | The individual version of the business audit log: requires the client's SIN and a timeframe (7, 30, 180, 365 days). | Gate only; not run, because it requires entering a SIN |
| List of notices issued | Individuals only, by SIN (NOA no change, NOA changed, NOR at client or rep request, other NOR), 7 to 365 days. See business reference, section 7. | Gate only (business walk) |
| Download options | Scheduled or one-time Individual client list and Notice list. See business reference, section 7. | Business walk |
| Notification preferences | Register for online mail of T1 pre-assessment and processing review letters (needs EFILE number, T183 designation, EFILE contact code 2). | Business walk |
| Authorization request (A-RAC.379) | Step 1: select representative identifier, then Submit. Not continued. Per canada.ca, for individuals the client either confirms in My Account within 10 business days, or the representative supplies information from a notice of assessment processed at least six months ago, with no waiting period. Since 15 July 2025, EFILE software can no longer submit individual authorizations. | Gate only + canada.ca |

---

## 7. Authorization levels for individuals

From CRA's "Services for representatives of individuals" page (seen September 2026):

| Level | Allows |
|---|---|
| Level 1 (view only) | Benefits and credits, returns, proof of income (view), account balance and statement, available payments, carryover amounts, HBP/LLP, instalments, mail, NOAs, RRSP, tax slips, TFSA |
| Level 2 (view and change) | All of Level 1, plus: audit enquiries, change returns, open a non-resident account, register a formal dispute, request remittance vouchers, request CPP/EI rulings, request relief of penalties and interest, Submit documents, move, transfer and reallocate payments |
| Legal representative | All of Level 2, plus exclusively: personal information (address, children in care, marital status, phone numbers), representative authorization, direct deposit, DTC Part A, pre-authorized debit, apply for benefits |

There is no Level 3 for individuals.

The portal shows no level indicator. Every Level 2 service rendered its start page on the test client, but none was submitted, so the level is still not determinable from the portal. The same was true on the business walk.

Which level a firm wants: Level 2. It covers everything a T1 practice does after filing: Change my return, objections, relief requests and payment transfers. Address, marital status, children and direct deposit remain the client's own updates.

---

## 8. The onboarding matrix

### 8.1 Where each field comes from

| Source | Fields |
|---|---|
| Portal, any authorized representative | Legal name; home address (view only); marital status as assessed, by year; province of residence and taxing province, by year; filing date and assessment date for every assessed year; line-level return data for every assessed year; NOAs with explanation-of-changes text; 10 years of box-level slips with dates processed; RRSP deduction limits from 1991; RRSP contribution, deduction and unused history from 1991; TFSA room and history; TFSA issuer records; HBP/LLP balances and schedules; FHSA status; capital-gain, CGD and tuition carryforwards; DTC claim history; benefit status and current-year payments; account balance; current and prior-year transactions; instalments paid; direct-deposit status (set up or not, no banking detail); unread mail; whether another preparer pulled the client's data this season; set-off debts at other governments; uncashed cheques; UHT returns; NETFILE access code |
| Portal, the most sensitive page | Full SIN and date of birth (Proof of income statement) |
| Legal representative or client login only | Changes to address, marital status, children, phone; email and notification preferences; direct-deposit banking; pre-authorized debit; authorized representatives list; DTC Part A; benefit applications |
| AFR / CDE (certified software) | Bankruptcy and insolvency indicators, immigration/emigration dates, EFILE ineligibility, CEB debt indicator, plus the slip and carryforward data above (5.1 caveat) |
| Representative layer | Individual client list with authorization dates; per-client access log (needs SIN); notices issued (needs SIN); scheduled bulk downloads |
| Nowhere at CRA: must ask the client | Receipts behind non-slip claims (medical, donations without slips, moving, childcare, home office/T2200); T2125 business details (only line totals appear); adjusted cost base for securities (T5008 cost is the issuer's figure); foreign property holdings and whether T1135 was filed (not visible anywhere in the representative view); spouse or common-law partner details; dependants; RRSP/TFSA/FHSA statements from the institutions; slips before the 10-year window; any income without a slip (foreign accounts, rental, crypto, cash) |

### 8.2 Build notes

1. Reconcile slips to returns automatically, every year. T4 box 14/22 to lines 10100/43700; T5 to 12100; T3 box 21 to 12700 and 17600; T5008 cost and proceeds to Schedule 3; RRSP receipts to S7 line 24500 and to CRA's contribution history; T2202 to the tuition carryforward; T4RSP box 27 to HBP; T4 box 90/91 to line 24900. On the test client this caught several findings in about a minute.
2. Compare "date processed" with the filing date. Any slip processed after filing is a reassessment risk.
3. Read NOA figures from the assessment view, not the notice. Opening a notice changes the client's unread state (4.2).
4. Fence off the Proof of income statement. It is the only page with the full SIN and DOB.
5. Treat the NETFILE access code as a credential. It is printed on the Tax returns page and every NOA.
6. Do not trust summary labels. The year label on the HBP "required repayment" can differ from the year the obligation actually falls in. The TFSA warning can contradict issuer records on file. Check both against the detail pages.
7. Use the assessment view for history and the statement of account only for the current cycle. The statement covers barely 18 months.
8. Route handling. Inside a warm session deep links work and reloads are safe. Changing only a route parameter (slip index, benefit code) can leave the previous page's content on screen; reload or hop routes. Slip details need the year list loaded first; the TFSA room page needs the menu click.
9. SIN-gated rep tools (access log, notices issued) need the client's SIN as input. Design for that deliberately rather than storing SINs in automation.
10. Check "Recent page access" on day one. It tells you whether another preparer is still active on the client.

---

## 9 and 10. Dropped: one person's data and findings

The original sections 9 and 10 held one real person's verified data and findings: identity and status, a multi-year T1 table (income, tax, refunds, dates), selected line detail, a slip-by-slip list with named issuers, RRSP, TFSA and HBP balances, and a list of findings and open questions from reconciling slips to returns. A section like this shows what a live account yields for one client and which cross-checks flagged problems (unreported slip income, RRSP receipts against reported contributions, tuition against T2202, HBP year labels, security options deductions, foreign income, scholarships, software defaults on Schedule 6). No names, values or dates are kept here. Use the made-up clients under reference/sample-clients/ for worked examples.

---

## 11. Deadlines, limits and sources

### 11.1 Rules as published (2025 and 2026 tax years)

| Obligation | Rule as published |
|---|---|
| T1 filing and payment | 30 April for the prior year's return; 15 June filing if the individual or spouse is self-employed, payment still 30 April |
| RRSP contribution deadline | 60 days after year end (first 60 days of the next year) |
| RRSP dollar limit | $32,490 (2025); $33,810 (2026) |
| TFSA annual limit | $7,000 (2024, 2025, 2026) |
| YMPE / YAMPE | $71,300 / $81,200 (2025); $74,600 / $85,000 (2026) |
| Instalments | Required if net tax owing exceeds $3,000 ($1,800 in Quebec) in the current year and in either of the two prior years. Due 15 March, 15 June, 15 September, 15 December. Reminders mailed in November. |
| HBP repayment start | Second year after withdrawal; for first withdrawals 1 January 2022 to 31 December 2025, the fifth year after. 15-year period. Repayment window runs to 60 days after year end. |
| Objection, individual | The later of one year after the return's filing deadline or 90 days after the notice |
| Change my return | Not for 2015 or earlier. ReFILE: 2021 onward only. Refunds not issued for adjustments beyond 10 calendar years. Online processing about 2 weeks. |
| Security options deduction | Line 24900 = total of T4 codes 39, 41, 91 and 92 |
| Scholarships | Generally exempt if the student is full-time qualifying in the year, the prior year or the following year for that program |
| Ontario tuition credit | Discontinued for studies after 5 September 2017; unused amounts still carry forward |
| CGEB | The GST/HST credit, renamed July 2026; same eligibility and structure; amount increased 25% from July 2026 |

### 11.2 Limits of this reference

| Item | Status |
|---|---|
| NOA documents | Only one was opened, to avoid further changes to read state. Line data for all years came from the assessment view instead. |
| Mail items | List read; no item opened besides one NOA. Contents of the HBP letter, CCR, CGEB and OTB notices not read. |
| Transactions log and List of notices issued (individual) | Not run: both require entering the client's SIN. |
| Authorization request | Stopped at step 1 (representative identifier, which requires Submit). Flow described from canada.ca. |
| All Level 2 forms | Start pages only. No form entered. |
| AFR payload | From canada.ca; the full item list sits in collapsed sections and was not fully retrieved (5.1). |
| "Client has full My Account access" | Meaning not documented; interpretation in 1.2 is inference. |
| Access level of the RepID | Not determinable from the portal. |
| Reconciliation findings | Arithmetic and matching on CRA data only; the client's own records were not seen. Not computed reassessments. |
| Other client profiles | One single, salaried Ontario client. Pensioners, self-employed, families with CCB, non-residents, deceased, bankrupt and Quebec clients will show sections not seen here (CCB detail, T2125 lines, OAS, instalment history, legal representatives). |

### 11.3 Sources

Checked in October 2026.

- Services for representatives of individuals (levels): `canada.ca/en/revenue-agency/services/e-services/represent-a-client/list-services-representatives-individuals.html`
- Representatives: request authorization: `canada.ca/en/revenue-agency/services/e-services/cra-login-services/help-cra-sign-in-services/representatives-request-authorization.html`
- New T1 authorization process (15 July 2025): `cpanewbrunswick.ca/.../Information-about-the-new-representative-authorization-process-for-T1-accounts.aspx`
- Help with My Account: `canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/account-individuals/help-account.html`
- Auto-fill My Return for professional tax preparers: `canada.ca/en/revenue-agency/services/e-services/about-auto-fill-return.html`
- Changing a tax return: `canada.ca/en/services/taxes/income-tax/personal-income-tax/after-you-file/change-return.html`
- Change your return (CMR/ReFILE limits): `canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/change-your-return.html`
- Due dates for individuals: `canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals.html`
- Instalments: who pays: `canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments/who-pays-instalments.html`
- Instalments: due dates: `.../income-tax-instalments/due-dates.html`
- HBP repayments: `canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/what-home-buyers-plan/repay-funds-withdrawn-rrsp-s-under-home-buyers-plan.html`
- RRSP, TFSA, YMPE limits: `canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html`
- P148, objection rights: `canada.ca/en/revenue-agency/services/forms-publications/publications/p148/p148-resolving-your-dispute-objection-appeal-rights-under-income-tax-act.html`
- Line 24900 security options deductions: `canada.ca/.../deductions-credits-expenses/line-24900-security-options-deductions.html`
- Employee security options (T4 codes): `canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/benefits-allowances/security-options.html`
- Line 13010 scholarships: `canada.ca/.../line-13010-scholarships-fellowships-bursaries-artists-project-grants-awards.html`
- Ontario information (2017 package, tuition credit): `canada.ca/.../archived-general-income-tax-benefit-package-2017/ontario/5006-pc/information-residents-ontario.html`
- Canada Groceries and Essentials Benefit: `canada.ca/en/revenue-agency/services/child-family-benefits/canada-groceries-essentials-benefit.html`
