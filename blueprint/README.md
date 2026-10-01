# Blueprint: Ashbridge Returns

Version v1.1, 29 Sep 2026. The plain end state below is what Zo approves; he approved this version on 29 Sep (decision 0008, Z8-18). The numbered clauses in the files below are the Lead's to keep in line with it: a clause change is amber, checked by the Critic and the Reviewer, and tax rules also get a CPA's check. Changing the plain end state needs Zo's yes (skill `blueprint-change`). v1 was built from Zo's design of 28 Sep (`reference/design-2026-09-28.md`) and decision 0006; v1.1 brings back his build order and applies his answers of 29 Sep.

## The end state on one page (for Zo)

1. Every corporation and year a client bought a T2 for becomes a return here, with no typing. Where the client app leaves something unclear (the year end, which years), ops confirms it in one step.
2. The books live in QuickBooks Online. For clients with bank statements only (about 60%), the firm keeps their books in QBO; clients with their own QBO connect through the client app. QBO makes the financial statements and the GIFI mapping. Returns has no bookkeeping module.
3. Returns reads the books from QBO (trial balance, GIFI mapping, transactions, adjusting entries) and the client's documents (PDFs with every word's position; spreadsheets and CSVs cell by cell). Every figure keeps a pointer to its source: a document box, a QBO line, a client answer, CRA data, last year's return, or a reason a person wrote. Every adjustment needs a reason and a source.
4. Returns writes the Taxprep import file, so nobody types the numbers. The preparer imports it, makes the tax choices in Taxprep (CCA, dividends, elections, the business limit), gives any typed value a source with a cite button, locks, and uploads one export and the printed return.
5. Code runs the ties and reconciliations. AI reads messy documents and runs the judgment checks and a red team; every AI claim must point to something code can verify, and AI never clears anything. AI runs through Claude on the firm's subscription, in its own project with its own rules, not through a paid API.
6. The CPA (Zo) reviews the full return in a fixed order, flags first. Any number opens its source in under a second, on a second monitor if wanted. The CPA marks each section "Reviewed"; the mark comes off if a number in it changes; Approve appears only when every section is marked. AI drafts fixes for simple comments, and the preparer approves them.
7. What is filed equals what the CPA approved: a check export just before transmit is compared with the approval.
8. Every difference between the AI draft, the preparer, the CPA and CRA is captured and ranked, and a weekly lesson list proposes fixes. Nobody has to log anything.
9. Clients never use this system. Their year-end questions and approval summary appear in the client app, which the firm controls. No AI talks to clients.
10. Nothing costs money before go-live beyond the Claude subscription. Paid services sit behind switches that stay off.
11. It is built and tested on made-up companies (ten sample clients with a year of transactions, and more), in QBO test companies and in a real Taxprep trial. Going live needs Zo's yes on real data and vendors.
12. Staff screens use the GOV.UK look, built for repeat desk work on a laptop with two monitors: as many screens as the work needs, each with one job, in a logical order, with search everywhere. Every screen is designed first with made-up data, and Zo approves the designs before they are built.
13. Every piece is specified, built and checked by three different agents and merged only in batches that passed the full test suite.

Not in this build: financial statements or CSRS 4200 work (QBO makes the statements), a bookkeeping module, slip preparation (Returns only checks slips), measuring time saved.

## Files (agents read only what a card names)

| File | Holds | Clause prefix |
|---|---|---|
| `00-end-state.md` | What done looks like; the thirteen return kinds | END |
| `01-rules.md` | Fixed decisions and design rules | RULE |
| `02-lifecycle.md` | States, moves, what voids approval, due dates | FLOW |
| `03-evidence.md` | Documents, facts, origins, dots, the books read from QBO | EV, TB |
| `04-roundtrip.md` | Taxprep CSV protocol, the lock and check exports, trace, the check before transmit | RT |
| `05-checks.md` | Ties, reconciliations, flags, AI, exceptions, tiers | CK, AI, EX |
| `06-screens.md` | CPA, preparer, ops and owner screens; the design basis | RV |
| `07-learning.md` | Versions, causes, ranking, lessons into the build | LL |
| `08-security.md` | Access, masking, logs, retention | SEC |
| `09-architecture.md` | Stack, modules, adapters, test world, simulator; how it is built and tested | ARC |
| `10-go-live.md` | What must be true before real use (all red) | LIVE |
| `11-not-building.md` | Out of scope and future ideas | OUT |

A clause is one testable sentence with an ID (`- **RT-4** ...`). IDs are never renumbered; a removed clause stays, marked removed. Tests put the clause ID first in their names; `node tools/matrix.mjs` shows which clauses have tests.

## Words

- **Return:** one corporation, one tax year.
- **Fact:** one value with a meaning and a source.
- **Figure:** one Taxprep input value, built from facts, accounts, adjusting entries or judgment inputs.
- **Adjusting entry:** a change to the client's books, made in QBO and read from it, that nets to zero, with a type, a reason and sources.
- **Judgment input:** a tax choice typed in Taxprep (CCA claim, dividend designation, election, business limit share), with a source or reason from the cite button.
- **Lock export and check export:** the Taxprep CSV exports at lock and just before transmit.
- **Orphan:** a value in Taxprep that we never imported and that is not rolled forward from last year's return (RT-14).
- **Tie:** two amounts that must agree to the dollar. **Reconciliation:** two amounts whose difference must be fully explained by typed, sourced items. **Flag:** something a person judges; code never passes or fails it.
- **Dot:** how strong a number's evidence is (green, grey, amber, purple). An open exception is a separate red flag.
- **Test world:** the ten sample clients, extended to thirteen made-up return kinds with known right answers, and their documents.
