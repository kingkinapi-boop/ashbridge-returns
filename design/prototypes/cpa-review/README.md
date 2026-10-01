# CPA review and its source viewer: design prototypes

Three clickable static versions of the CPA review family (RV-1 to RV-9, with the source viewer of RV-4, EV-5, EV-11, EV-14), from the brief `design/briefs/cpa-review.md`. For the usability panel and Zo's design sitting. Not product code.

Open `index.html` in a browser (works from disk; a local web server also works).

| Version | Folder | Structure |
|---|---|---|
| A | `a-record-tabs/` | Record page with tabs; return, trace and source side by side; the source can pop out to the second monitor (the brief's recommended pattern A) |
| B | `b-rail-split/` | A coverage rail of sections with their marks; section in the middle; trace above source on the right |
| C | `c-two-monitors/` | The return walked full width with the trace under each line; the source in its own window on the second monitor |

Two-monitor drawings: `layouts.html`. Parts used and composed parts, per version: the `README.md` in each folder.

## Reviewed marks (RV-5 as it is changing)
The designs show RV-5 as the Lead asked: an explicit **Reviewed** mark per section (button and key `m`), recording who and when. When a number in a marked section changes, the mark comes off and the section says why ("Mark removed 2 Oct 2026, 10:14 am: 6 numbers in Balance sheet changed after rework (adjusting entry 01-AJE-02)"). Approve appears only when every section is marked; until then the page lists the sections left as links. No disabled buttons.

## Scenarios (the same three in every version)
| Return | Tier | State | Shows |
|---|---|---|---|
| `r01` Maple Ridge Consulting Inc. (Test), year end 31 Dec 2025 | red | first review, nothing marked | 9 flags (3 red); a source that fails to load (Income statement line 9200); a number with no evidence (line 9275, CK-2) |
| `r08` Queen West Design Studio Inc. (Test), year end 30 Sep 2025 | green | 4 of 5 sections marked | mark Schedule 50 and Approve appears; empty comments |
| `r01b` Maple Ridge, back from rework | red | home office booked as 01-AJE-02 | 11 changed cells before and after (RV-7); 3 marks removed with the reason; 2 answered comments |

Every version also has `queue.html` (sortable, red first then due date), `queue-empty.html`, `states.html` (loading, failed source, no evidence, computed line, document page, flagged trace) and `viewer.html` (the second-window source viewer).

## What is real sample data and what is made up for the prototype
- From `reference/sample-clients/` (all made up, names end "(Test)"): this year's trial balance figures by GIFI code, the adjusting entries, the flags' subjects, the onboarding answers, and the bank and card CSV rows shown in the source viewer (read from the CSV files, with real row numbers).
- Made up for the prototype only, and not tax-checked: last year's income statement lines (a fixed factor per code; last year's balance sheet is the answer key's opening balances), last year's retained earnings start and dividends (set so retained earnings roll), the six tax numbers (a flat 9% federal and 3.2% Ontario on taxable income, standing in for Taxprep), Schedule 8 CCA amounts, flag severities, dollar effects, preparer answers, comments, staff names, dates and history. GIFI and Schedule 1 line numbers are shown for orientation and should be confirmed against the trial's cell map.
- Dot assignments (EV-11) are chosen per line to show every dot; the rule "the weakest source sets the dot" is applied to totals and computed lines from the lines that feed them.
- Highlighting (RV-8) reads "changed" as moved more than 10% and more than 1,000.00 (prototype reading; the clause does not set a threshold).

## Regenerate
```
node design/prototypes/cpa-review/build/render.mjs
```
`build/data.mjs` reads the sample clients; `build/returns.mjs` holds the three scenarios; `build/render.mjs` writes every page and `shared/data/*.js`. The stylesheet `shared/ashbridge.css` is compiled from `shared/ashbridge.scss` (GOV.UK Frontend 6.5.1 and MOJ Frontend 11.1.0 with the Ashbridge colours and Roboto through their settings; command in the file). State (marks, comments, approval) is kept in the browser's local storage per version; "Reset this prototype" in the banner clears it.

## Checks run (1 Oct 2026, Chromium 1194 in the cloud container)
- axe-core with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` on all 110 pages at 1440 x 900: no violations, no script errors.
- Click-through in all three versions: Approve absent until the last mark, then present; Approve by key; comment form errors (GOV.UK pattern, "Error: " title) then a saved comment; next flag goes red first across sections; next source; marks removed after rework with the reason; in C the second window follows the review window.
- 320 px wide: no sideways page scroll on the queue, brief and a section in each version (tables scroll inside labelled regions).
- Every "built from" breakdown adds up to its line (135 lines).
- No em dash in any file.
- Not checked: screen reader walk-through, the usability panel's click and time budgets, Firefox and Edge, 400% zoom.

## Brief height against the budget (whole brief on one laptop screen)
Bottom of the brief (the Start button), less the prototype banner, measured on Maple Ridge:
| Version | 1366 x 768 | 1440 x 900 | 1920 x 1080 |
|---|---|---|---|
| A | about 115 px over | fits | fits |
| B | about 490 px over | about 360 px over | about 120 px over |
| C | about 560 px over | about 430 px over | about 230 px over |
