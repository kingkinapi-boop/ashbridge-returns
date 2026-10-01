# Brief: the preparer's workbench

Design research, 1 Oct 2026. Builds on `reference/research/2026-09-29-staff-ux-patterns.md` sections 5B and 5C (not repeated; its web facts were read on 29 Sep). Not opened this round, so [guess] until the sitting: Caseware Cloud, CCH Axcess Workstream, DataSnipper, QBO Accountant, Salesforce help pages. Clauses: RV-20 to RV-25, RV-50 to RV-55, FLOW-10, EV-8, EV-9, TB-3, TB-6, RT-6, RT-14 to RT-18, RT-20.
Zo's taste: Excel and Salesforce record pages with related lists; top-to-bottom order; separate tabs for separate things; /internal failed by putting everything on one page.

## 1. Task scripts (preparer; a few returns a day, each held over several days)

| # | Task | How often | Must see together | Decides | Next |
|---|---|---|---|---|---|
| P1 | Pick a return | many a day | queue by due date: state, tier, blocker, due and balance-due dates (FLOW-7) | which return | open it |
| P2 | Gap review (RV-23) | once per return | each draft question beside its evidence | keep, edit slots, merge, drop, add from bank | sign the list |
| P3 | Map trial balance to GIFI (TB-3) | once, then reused | QBO account, balance, AI-proposed code and why, last year's mapping | confirm or change | no unmapped account |
| P4 | Evidence and facts | many times | facts with status, dot, source; documents waiting to be read | verify a fact (EV-8) | verified facts feed the import |
| P5 | Round trip (RV-21) | each import cycle | steps in fixed order, each tied to its upload: import file, report and export 1 (RT-6), export 2, review-lines export, printed return | upload, Ready, lock | trace |
| P6 | Judgment inputs (RV-22) | once per return | CCA, dividend designations, elections, business limit shares, last year, reason | value and reason | back to the checklist |
| P7 | Trace (RV-24, RT-14 to RT-18) | after lock | each orphan or override: cell, value, cite action; uncleared diagnostics | a source or reason each | zero orphans |
| P8 | Exceptions and sign (RV-24) | once | exception list, one answer box each | answer, sign | hand-off |
| P9 | CPA comments (RV-25, RV-7) | after rework | comments by topic, type, severity, with before and after | resolve at the number | re-trace, sign again |
| P10 | Hand-off to review | each cycle | what is left, as links; attestations the CPA will see | sign | state: review |

## 2. Budgets (made-up returns, laptop, second monitor optional)

| Task | Page loads | Clicks to start | Fields | Time |
|---|---|---|---|---|
| P1 open the next return | 1 | 1 (name is the link) | 0 | under 3 s |
| Change tab inside a return | 0 or 1 | 1 | 0 | under 1 s |
| P2 one question | 0 | 1 key | 0 to 2 | under 10 s |
| P3 confirm one suggested mapping | 0 | 1; batch by checkbox | 0 | under 5 s |
| Open any source from a figure or fact | 0 | 1 | 0 | under 1 s (blueprint) |
| P5 start the import-file download | 1 | 2 from the queue | 0 | under 30 s |
| P6 one judgment input | 0 | 1 | 2 | under 30 s |
| P7 source one orphan | 0 | 2 | 1 to 2 | under 30 s |
| Find any return, account or fact | 1 | search on every screen, 1 key to focus | 1 | under 3 s |
No step asks the preparer to type their name (forensics: 14 name inputs). The hold (FLOW-10) shows who and since when, and never blocks reading.

## 3. Pattern options

### Option A (recommended): return record with sub navigation tabs, one job per tab
- Shape: a Salesforce record page. Top: MOJ identity bar as a quiet strip (corporation, year end, state, tier, due date, hold). Below: MOJ sub navigation in lifecycle order: Overview, Evidence, Gaps, Books (TB and GIFI), Judgment, Round trip, Trace, Comments. One URL and one job per tab, a table or a form, not both. A count badge on each tab; a strip under the header always names the one next step as a link.
- Overview is the GOV.UK task list of the same steps, with "Cannot start yet" plus the reason (the lifecycle order is fixed); it is also the hand-off page.
- Copy: Salesforce record page with related lists and tabs (help.salesforce.com [guess]); TaxCycle review sidebar counts and mark history (https://www.taxcycle.com/resources/help-topics/review-tools/review-sidebar/); Taxprep diagnostic tabs Take Action, My Diagnostics, All; UltraTax red chevron for an override with acknowledge or restore; Rossum Enter for the next unresolved field and Linear triage keys.
- Avoid: a wizard that forces the tab order (NN/g: wizards annoy repeat users); status by colour or count alone; piling everything onto Overview.
- Fit: sub navigation and identity bar are MOJ "to be reviewed" parts, the badge is official. Tabs are real routes, so back and bookmarks work; not the GOV.UK tabs component.

### Option B: side navigation of steps, one main area, a non-modal right pane
- Shape: MOJ side navigation lists the steps down the left; the main area is the tab's table; a row opens a detail and source pane at the right. Closest to CaseWare Working Papers and TaxCycle with DoxCycle follow mode, and to a mail client.
- Copy: DoxCycle return and document moving together; Linear peek with Space and arrows; GitHub file tree with markers for open items.
- Avoid: a modal for detail (NN/g data tables); a long left menu (MOJ side navigation scrolls sideways past three links on small screens, needs a width check).
- Trade-off: suits two monitors; the laptop alone loses width, but gives one-key peek from any row.

### Option C: grid-first worklists across returns, return page only for the round trip
- Shape: Excel-like views per task across all returns (unmapped accounts, unverified facts, open orphans) with saved filters, bulk confirm and keyboard cell movement; the return page holds only the checklist and sign. Could join A as a top-level Worklists tab.
- Copy: Excel and Salesforce list views with saved filters and inline edit; Karbon My Work saved views; MoJ Forms inline editing for repeat users (designnotes.blog.gov.uk, 2022).
- Avoid: a flat list where every flag looks alike (AHRQ alert fatigue); losing the return's name from the row (RV-50); MOJ sortable table sorts the loaded page only, so sort on the server.
- Trade-off: fastest for batch work (mapping 40 accounts), weakest for the one-return story and lifecycle order.

## 4. Where GOV.UK and MOJ parts fit, and where nothing exists
- Fit: header, tags for status, task list (Overview), summary list and check answers (hand-off, judgment review), inset text for "AI drafted, not verified", error summary, small radios and MOJ add another for gap and judgment forms, MOJ timeline for events and comments, identity bar, sub navigation, search, badge, multi file upload (round trip).
- No pattern, compose and write why (RV-52): dense editable tables with sticky header and keyboard cell movement; the source pane; an on-screen key legend; bulk confirm with a count. Dense rows need a modifier (default row is about 46 px).
- No disabled buttons: Ready and sign show what is left as links (by analogy with RV-5 [inference]).

## 5. Questions for the designer and the usability panel
1. Books and Judgment as two tabs or one "Tax work" tab? Show both.
2. Next-step strip as a button or a list of links? Test on five returns in different states.
3. AI-drafted state: a tag on the row or an inset on the tab? Never colour alone.
