# Design report: queues and return record (family queues-record)

Brief: `design/briefs/queues-record.md`. Branch: `claude/design-queues-record`. Open `design/prototypes/queues-record/index.html` (works from disk; fonts load from Google Fonts when online).

## Versions (differ in structure)
| Version | Path | Idea |
|---|---|---|
| A, tabs (the brief's recommendation) | `design/prototypes/queues-record/a-tabs/index.html` | One list screen per role with a view switcher, inline filter, chips with counts, sortable whole list; owner Board with the pipeline strip over 300 rows; record page = identity bar, facts, then MOJ sub navigation tabs (Overview, Workbench, Review, Documents, Exceptions, History, Ops). |
| B, split | `design/prototypes/queues-record/b-split/index.html` | Zendesk-style list at left, summary pane at right (no page load, j and k); record page with a left rail of sections and Previous and Next return links (n and p) for CPA triage. |
| C, pipeline first, two monitors | `design/prototypes/queues-record/c-pipeline/index.html` | Front door is the pipeline by state, a list screen for each of the 15 live states, each role's work list grouped by state, a lifecycle stepper on the record, and documents that open in a second "source window" that follows clicks. |

Parts used and anything composed outside GOV.UK or MOJ, with reasons: `design/prototypes/queues-record/basis.md`.

## States covered in each version
Normal, empty list, one-row list, 300-row list, search with no match, filter with no match (type "zzz"), blocked return (Halton, Eglinton Retail, Danforth), dated waiting-on-client flag (Lakeshore, Danforth) with chase and nudge confirmation, approval void alert (Eglinton Holdings), error (bulk assign with nobody chosen in A and B; confirmation number missing in C), success banner (nudge sent), holder and idle expiry (Halton), group link (Eglinton pair).

## Task scripts
Each version's index.html lists the click path for the nine tasks in the brief. Search: type "halton", "7798" or "eglinton" in the header box and press Enter.

## Not done or to know
- Only the ten sample clients have record pages; the 290 filler rows only exist to show the 300-row list.
- `_shared/app.js` stands in for MOJ's own scripts (ES modules do not load from file://); sorting and filter are real, in the browser.
- Workbench and Review tabs show only where the preparer or CPA stands; their content belongs to the workbench and CPA review briefs. Approve is absent by rule 8.
- No axe, keyboard or 320 px test was run; a script checks links, classes, h1 and dashes. Zo's choice between A, B and C is needed; my lean is A with C's strip on the Board (as the brief recommends), B's pane only if the CPA wants triage.
- Amber candidates: column sets per role; saved views per staff account; bulk assign as bar or page.
