# 03 Evidence and books

## Records (append-only: nothing is overwritten)

| Record | Holds |
|---|---|
| Document | the file, a fingerprint, who gave it and when, type, period, entity, page images, every word with its box |
| Fact | one value with a meaning (a fact key), its source pointer, origin, method, status, version stamps |
| Account | one line of the working trial balance: the client's balance and its GIFI code |
| Adjusting entry | lines that net to zero, a type, a reason, sources, the author |
| Judgment input | a tax choice (CCA claim, dividend designation, election, business limit share): value, reason, author |
| Figure | one Taxprep input value: its figure key (GIFI code or schedule line, plus a row key for repeating rows), how it is built, its cell identifier |
| Link | "built from" (figure to accounts, entries, facts, inputs) and "agrees with" (two sources that match) |
| Event | every change: who, when, from what, to what, why |

## Documents and facts

- **EV-1** Records are append-only. A change writes a new version and an event; the database refuses updates and deletes of events and versions.
- **EV-2** Every document gets a fingerprint. A duplicate is caught by its fingerprint and linked, not read twice.
- **EV-3** A PDF holding several documents is split. A document for the wrong year or entity is flagged and not used.
- **EV-4** Each document gets tamper checks: its fingerprint, and whether its balances roll (opening plus activity equals closing). A failed check marks its facts suspect.
- **EV-5** A source pointer is exactly one of: a document page and box; a client answer (onboarding or Q&A); a CRA data capture; last year's return and assessment; an adjusting entry; a judgment input.
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
  | Client prepared | trial balance, financial statements, invoices the company issued |
  | Client said | onboarding and Q&A answers |
  | Judgment | an estimate, allocation or tax choice by a preparer, with its reason |

- **EV-11** The dot beside a number: green when a third-party source agrees with it; grey when its single source is third party, or last year's assessed return; amber when it rests only on the client (prepared, filed or said); purple when it rests on judgment. The weakest source feeding a figure sets the figure's dot.
- **EV-12** An open exception shows as a separate red flag on the number, never as a dot colour.
- **EV-13** "Agrees with" needs a written rule (for example, bank deposits agree with revenue only after known non-revenue items are removed). No rule, no green.

## The books (working trial balance)

- **TB-1** Each return has a working trial balance. Each account starts at the client's balance (from their trial balance or statements), or at zero when there are no books.
- **TB-2** Every change is an adjusting entry whose lines net to zero, with a type (reclass, accrual, allocation, estimate, correction), a reason and its sources.
- **TB-3** Each account maps to exactly one GIFI code. A GIFI figure is the sum of its mapped accounts. AI may propose a mapping; a person confirms it; a confirmed mapping is reused the next year.
- **TB-4** Bank-only files start from categorised bank lines. Each line is a fact with its statement page and row. Categories map to accounts. AI proposes categories; a person confirms them in batches.
- **TB-5** The balance sheet balances and retained earnings roll by construction. The checks still verify the Taxprep export (CK-10, CK-11).
- **TB-6** Tax choices (CCA claims, dividend designations, elections, business limit shares) are judgment inputs made in our app with a reason, then imported. They are never typed only in Taxprep.
- **TB-7** A figure's trace shows the client's balance, each adjusting entry, the final figure, and each source with its dot.
- **TB-8** Prior-year values come from last year's CPA-final and assessed version when we filed it; otherwise from the prior T2 PDF and notice of assessment. Converted values stay amber until tied to one of those.
- **TB-9** One document may feed many facts, and one figure may be built from many sources. The trace lists them all and steps through them in order.
