# Blueprint: Ashbridge Returns

Version v1 DRAFT, 28 Sep 2026. Waiting for Zo's "blueprint ok" (TODO-ZO item 1). After that, only Zo changes it (skill `blueprint-change`). Built from Zo's design of 28 Sep (`reference/design-2026-09-28.md`) with the fixes from its review folded in as the Lead's recommendations (decision 0006).

## The end state on one page (for Zo)

1. Every corporation and year a client bought a T2 for becomes a return here, with no typing.
2. Documents are read as they arrive. Every figure keeps a pointer to its page and box, or to the client's answer, or to a reason a preparer wrote.
3. The client's own books become a working trial balance. Every change we make is a visible adjusting entry with a reason and a source.
4. The system writes the Taxprep import file. The preparer imports it, makes the judgment choices in our app, locks, and uploads Taxprep's exports. Four exports prove what Taxprep holds at each step.
5. Code runs the ties and reconciliations. AI runs the judgment checks and a red team, and every AI finding must point to something code can verify. AI never clears anything.
6. The CPA reviews the full return in a fixed order, flags first. Any number opens its source in under a second. Approve stays off until every section has been seen.
7. What we file must equal what the CPA approved. The system checks this before the T183CORP goes out and again before transmit.
8. Every difference between the AI draft, the preparer, the CPA and CRA is captured, blamed on the right cause, ranked, and turned into a build task with a failing test. Nobody has to log anything.
9. Clients never use this system. Their year-end questions and approval summary appear in the client app. No AI talks to clients.
10. Nothing costs money until go-live. Paid services sit behind switches that stay off.
11. It is built and tested on twelve made-up corporations and a Taxprep simulator. Going live needs a real Taxprep proof and Zo's yes on vendors and the live database.

Three things to notice: the adjustments layer (item 3) is the largest build item; client screens stay in the client app (item 9); at go-live this system shares the client app's database, in its own section.

## Files (agents read only what a card names)

| File | Holds | Clause prefix |
|---|---|---|
| `00-end-state.md` | What done looks like; the twelve return kinds | END |
| `01-rules.md` | Fixed decisions and design rules | RULE |
| `02-lifecycle.md` | States, moves, what voids approval, due dates | FLOW |
| `03-evidence.md` | Documents, facts, origins, dots, the books | EV, TB |
| `04-roundtrip.md` | Taxprep CSV protocol, exports 0 to 3, trace, gates | RT |
| `05-checks.md` | Ties, reconciliations, flags, AI, exceptions, tiers | CK, AI, EX |
| `06-screens.md` | CPA, preparer, ops and owner screens | RV |
| `07-learning.md` | Versions, causes, ranking, lessons into the build | LL |
| `08-security.md` | Access, masking, logs, retention | SEC |
| `09-architecture.md` | Stack, modules, adapters, test world, simulator | ARC |
| `10-go-live.md` | What must be true before real use (all red) | LIVE |
| `11-not-building.md` | Out of scope and future ideas | OUT |

A clause is one testable sentence with an ID (`- **RT-4** ...`). IDs are never renumbered; a removed clause stays, marked removed. Tests put the clause ID first in their names; `node tools/matrix.mjs` shows which clauses have tests.

## Words

- **Return:** one corporation, one tax year.
- **Fact:** one value with a meaning and a source.
- **Figure:** one Taxprep input value, built from facts, accounts, adjusting entries or judgment inputs.
- **Adjusting entry:** a change to the client's books that nets to zero, with a type, a reason and sources.
- **Judgment input:** a tax choice made in our app (CCA claim, dividend designation, election, business limit share) with a reason.
- **Export 0 to 3:** Taxprep CSV exports at baseline, receipt, lock and transmit.
- **Orphan:** a value in Taxprep that we never imported and cannot trace.
- **Tie:** two amounts that must agree to the dollar. **Reconciliation:** two amounts whose difference must be fully explained by typed, sourced items. **Flag:** something a person judges; code never passes or fails it.
- **Dot:** how strong a number's evidence is (green, grey, amber, purple). An open exception is a separate red flag.
- **Test world:** twelve made-up corporations with known right answers, and their documents.
