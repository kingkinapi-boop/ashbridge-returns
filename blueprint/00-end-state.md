# 00 End state

## Done means

- **END-1** Every corporation and tax year a client bought a T2 for becomes a return here automatically, from the client app's data. Where that data leaves something unclear (the year end, which years, a year bought twice), ops confirms it in one step; the system never guesses.
- **END-2** Every value on a filed return traces to a source: a document box, a QBO line, a client answer, CRA data, last year's assessed return, or a reason a person wrote.
- **END-3** A CPA reviews the full return on one screen, flags first, and any number opens its source in under one second.
- **END-4** The filed return equals the CPA-approved return, proved by comparing Taxprep exports.
- **END-5** Every difference between the AI draft, the preparer version, the CPA-final version and the CRA assessment is captured, attributed and ranked with no one logging anything, and the top items become build tasks with failing tests.
- **END-6** Any evidence mix works, from a full file to onboarding answers alone. Missing evidence lowers the dot; it never blocks.
- **END-7** No AI output reaches a client. This system holds no client sentence.
- **END-8** Nothing costs money before go-live. Each paid service sits behind an adapter with a free stand-in and a switch that stays off.
- **END-9** All thirteen return kinds below, built on the ten sample clients in `reference/sample-clients/` (decision 0008, Z8-8), pass end to end, through the Taxprep simulator, on every merge to main.

## A day in the finished firm

- **Ops** sees new returns from the client app, CRA data to capture for returns with access, T183CORPs to send, returns to transmit, and notices of assessment to save.
- **A preparer** opens the queue, sorted by due date. A return shows its gaps and the draft question list (from the approved question bank), then the import file. The preparer imports it into Taxprep, makes the tax choices there, locks, uploads the lock export and the printed return, cites a source for every typed value, answers each exception and signs.
- **The CPA** opens the next return. The brief shows six numbers against last year, the tier and why, and the pinned flags. The CPA walks every section in order, clicks any number to see its source, then comments or approves.
- **The owner** sees the pipeline, due dates and the weekly lesson list.

## The thirteen return kinds (the test world)

Made-up corporations with known right answers. A card is done only when all thirteen still pass. The ten sample clients are the start; a kind with no sample client gets a new one in the same style (ARC-8).

| Kind | Corporation | What it proves | Starts from sample client |
|---|---|---|---|
| K1 | Returning client, clean books, full evidence | The green path; last year is ours | new |
| K2 | New to us; prior T2 from other software | Conversion; converted values amber until tied to the prior T2 and notice | 08 |
| K3 | First-year corporation with a short first year | No prior year; business limit prorated | 09 |
| K4 | Bank statements only | The firm books the bank lines in QBO; Returns matches them to the statements (TB-4) | 02 |
| K5 | Onboarding answers only | Every figure amber; nothing blocks | new |
| K6 | Physician professional corporation | OHIP reconciliation; exempt supplies; no HST return | new |
| K7 | Holding company with passive income, associated with operating company K7b | Two linked returns; association; Schedule 23 shared limit; passive income test | 05 and 06 |
| K8 | Consultant with personal services business signs | Shareholder loan past its deadline; a repay and re-borrow series | 01 |
| K9 | Retailer on the HST quick method, with payroll | Line 101 by method; T4 reconciliation; one bonus paid on day 180 (in time), one on day 181 or later (CK-47) | 04, with 03's bonus |
| K10 | Company paying dividends | Eligible and non-eligible; GRIP; T5s; a capital dividend election | 05 |
| K11 | Company with asset additions and a disposal | CCA by class; a vehicle; home office; meals at 50% | 08, with 10's vehicle |
| K12 | Messy file | Duplicates, a wrong-year statement, a tampered PDF, a missing bank month, a late document after lock, a correction after approval | 10 |
| K13 | Catch-up: two unfiled years for one corporation | Two linked returns in order; the second opens from the first; red tier | new |

## What the client app can hand over, and where each case is tested

From `reference/onboarding-contract.md` (client app read at commit f87a0043, 28 Sep). The bridge (card F07) names the client-app migration it was written against and is re-checked at go-live.

| The client app sends | Handled by | Tested in |
|---|---|---|
| One company, one T2 year | A return | K1 to K12 |
| One company, several years (catch-up) | One return per year, in order | K13 |
| A year end the client never confirmed | Ops confirms before the return starts (END-1) | K3, K13 |
| The same year bought twice | Ops confirms which one stands (END-1) | K13 |
| Two associated companies | Linked returns (FLOW-11) | K7 |
| Personal returns only, or a company with no T2 bought | Skipped without error (OUT-6) | Bridge tests (F07) |
