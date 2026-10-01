# 03 Evidence and books

## Records (append-only: nothing is overwritten)

| Record | Holds |
|---|---|
| Document | the file, a fingerprint, who gave it and when, type, period, entity, page images, every word with its box |
| Fact | one value with a meaning (a fact key), its source pointer, origin, method, status, version stamps |
| Account | one line of the trial balance read from QBO: the account, its year-end balance, its GIFI code and the snapshot it came from |
| Adjusting entry | a journal entry read from QBO: lines that net to zero, a type, a reason, sources, the author |
| Judgment input | a tax choice typed in Taxprep (CCA claim, dividend designation, election, business limit share): its cell, value, source or reason from the cite button, author |
| Figure | one Taxprep input value: its figure key (GIFI code or schedule line, plus a row key for repeating rows), how it is built, its cell identifier |
| Link | "built from" (figure to accounts, entries, facts, inputs) and "agrees with" (two sources that match) |
| Event | every change: who, when, from what, to what, why |

## Documents and facts

- **EV-1** Records are append-only. A change writes a new version and an event; the database refuses updates and deletes of events and versions.
- **EV-2** Every document gets a fingerprint. A duplicate is caught by its fingerprint and linked, not read twice.
- **EV-3** A PDF holding several documents is split. A document for the wrong year or entity is flagged and not used.
- **EV-4** Each document gets tamper checks: its fingerprint, and whether its balances roll (opening plus activity equals closing). A failed check marks its facts suspect.
- **EV-5** A source pointer is exactly one of: a document page and box (or sheet, row and column, EV-14); a QBO line (an account or transaction in a dated QBO snapshot); a client answer (onboarding or Q&A); a CRA data capture; last year's return and assessment; a reason a person wrote.
- **EV-6** An extracted value is accepted only if it appears in the OCR words inside its box, after removing formatting such as dollar signs and commas. Otherwise it is rejected and counted.
- **EV-7** Arithmetic self-checks run in code: statements add up, trial balances balance, bank pages roll. A failure marks the extraction suspect.
- **EV-8** Fact status goes proposed, then preparer-verified, then CPA-accepted (at approval). Any change to a fact or its evidence resets it to proposed.
- **EV-9** Replacing a document first shows every fact and figure it feeds; only then does anything reset.
- **EV-14** Spreadsheets and CSV files (trial balances, ledgers, bank downloads) are read directly, not through OCR. Their source pointer is the sheet, row and column.

## Origins and dots

- **EV-10** Every source has one origin:

  | Origin | Examples |
  |---|---|
  | Third party | bank, lender and card statements; OHIP remittance advice; slips issued to the company; CRA's own records (instalments credited, assessments, notices) |
  | Client filed with CRA | HST returns, payroll remittances, T4 and T5 summaries |
  | Client prepared | trial balance, financial statements, invoices the company issued, the books in QBO |
  | Client said | onboarding and Q&A answers |
  | Judgment | an estimate, allocation or tax choice by a preparer, with its reason |

- **EV-11** The dot beside a number: green when a third-party source agrees with it; grey when its single source is third party, or last year's assessed return; amber when it rests only on the client (prepared, filed or said); purple when it rests on judgment. The weakest source feeding a figure sets the figure's dot.
- **EV-12** An open exception shows as a separate red flag on the number, never as a dot colour.
- **EV-13** "Agrees with" needs a written rule (for example, bank deposits agree with revenue only after known non-revenue items are removed). No rule, no green.

## The books (read from QBO; Returns has no bookkeeping module)

- **TB-1** Each return's trial balance (accounts and year-end balances, accrual basis) is read from the client's QBO company through the QBO API, and is never kept or edited in Returns.
- **TB-2** Adjusting entries are made in QBO and read from it; each one counts as explained only when its lines net to zero and it has a type (reclass, accrual, allocation, estimate, correction), a reason and at least one source. The type, reason and sources are written in the journal entry's memo as `AJE <type>: <reason> | source: <document or note>[; <document or note>]` (decision 0014). The memo, not the Adjustment flag, marks an adjusting entry: QBO's journal entry form showed no adjusting tick box and the Adj column read No (sandbox, 1 Oct 2026). Line descriptions are not the memo.
- **TB-3** QBO makes the GIFI mapping, and Returns reads it from the .GFI file the preparer downloads from QBO and uploads, keeping it as its own mapping record for the return; a GIFI figure equals the sum of its mapped accounts, and an account mapped to no GIFI code or to more than one, or mapped differently from last year, is flagged for a person. Plain QBO has no GIFI field in its chart of accounts and no GIFI screen (sandbox, 1 Oct 2026): the .GFI comes from QuickBooks Online Accountant's Workpapers.
- **TB-4** For bank-only clients the firm books the bank and card lines in QBO, outside Returns; Returns matches each QBO bank or card transaction to its statement line by account, date and amount, and flags any transaction or statement line left unmatched.
- **TB-5** A trial balance read from QBO that does not balance, or whose opening retained earnings differ from last year's closing, is refused with the reason; the checks still verify the Taxprep export (CK-10, CK-11).
- **TB-6** Tax choices (CCA claims, dividend designations, elections, business limit shares, loss and donation claims) are made by the preparer in Taxprep, and each typed value is a judgment input that needs a source or written reason through the cite button (RT-16, RV-22) before sign-off.
- **TB-7** A figure's trace shows the QBO balance of each account feeding it, each adjusting entry with its reason, the final figure, and each source with its dot.
- **TB-8** Prior-year values come from last year's CPA-final and assessed version when we filed it; otherwise from the prior T2 PDF and notice of assessment. Converted values stay amber until tied to one of those.
- **TB-9** One document may feed many facts, and one figure may be built from many sources. The trace lists them all and steps through them in order.
- **TB-10** Every read from QBO (trial balance, transactions, journal entries, attachments copied at read time) is saved as a dated, fingerprinted snapshot, and a QBO source pointer names the snapshot, the account and, for a transaction, its QBO Transaction ID. The trial balance carries no ids (account, debit, credit only), so a trial balance pointer names the snapshot and the account.
- **TB-11** Before the check export (RT-19), the QBO data is read again and compared with the snapshot the approval used; any changed balance, transaction or journal entry that feeds a figure is flagged "books changed after approval" and voids the approval as FLOW-5 says.
- **TB-12** An account mapped to a GIFI total code that CRA calculates (for example 2008, total tangible capital assets) is refused with the reason; amounts go on component codes. Source: RC4088.
- **TB-13** QBO's reports differ in what they carry (sandbox, 1 Oct 2026), and the reader takes each item from the one that carries it: the Trial Balance gives account, debit and credit, with no ids; the Transaction List by Date, with its Transaction ID and Memo columns added, gives one row per transaction with its id and full memo; the General Ledger gives each line's account, date, type, number, description and amount, with no id, and its CSV drops the memo; the Journal report gives the id only as a group heading and the line descriptions, with no memo. A line read without an id gets it by joining to the Transaction List on type and number; failing that it keeps a composite key (date, type, number, account, amount) and is flagged for a person. A report missing a column the reader needs is refused, naming the column.
