# Brief: the preparer's workbench (v1.1)

Written from blueprint commit **b9c5003** (blueprint v1.1, 29 Sep 2026; the plain end state items 2 to 4 and the clauses below as they stand at that commit). Rewritten 1 Oct 2026 after the design findings review (`reports/findings-designs.md`, RC1: the first brief was written from pre-v1.1 clauses). If a commit newer than b9c5003 touches the clauses listed here, re-check this brief before design starts.

Builds on `reference/research/2026-09-29-staff-ux-patterns.md` sections 5B and 5C. Clauses: RV-12, RV-20 to RV-25, RV-50 to RV-55, FLOW-10, EV-8, EV-9, TB-3, TB-6, TB-12, RT-14 to RT-18, RT-20.
Zo's taste: Excel and Salesforce record pages with related lists; top-to-bottom order; separate tabs for separate things; /internal failed by putting everything on one page.

## 0. What v1.1 settles (these are not questions for the designer or Zo)

- The books live in QuickBooks Online. QBO makes the GIFI mapping; Returns reads it from the .GFI file the preparer downloads from QBO and uploads, and flags an account mapped to no code, to more than one, differently from last year, or to a total code CRA calculates (TB-3, TB-12). Returns never proposes codes and has nothing to confirm.
- Tax choices (CCA claims, dividend designations, elections, business limit shares, loss and donation claims) are made in Taxprep, not on a Returns form. Each typed value is read from the lock export and gets a source or written reason through the cite button, beside the orphans (TB-6, RV-22, RT-16). Returns has no separate form for them.
- The round trip is RV-21's checklist: download the import file; import it into Taxprep; make the tax choices in Taxprep; lock; upload the lock export and the printed return (one upload); cite every orphan.
- The lock export classes each cell as traced, overridden, dropped, rolled forward, orphan or calculated (RT-14). Dropped blocks sign-off (RT-18).
- Diagnostics are read from the printed return by iFirm category: Error or Filing error blocks with no override; a Warning needs a named preparer's written reason; an Information or Filing warning may stay with a logged reason; Hidden or Ignored never counts as cleared (RT-17).
- For a simple CPA comment AI drafts the fix with citations and nothing changes until the preparer approves it; it goes through the normal round trip (RV-12).
- Retired terms are listed in design card check 6 (`plan/cards/families/design.md`); none may appear in this brief or in a prototype.

## 1. Task scripts (preparer; a few returns a day, each held over several days)

| # | Task | How often | Must see together | Decides | Next |
|---|---|---|---|---|---|
| P1 | Pick a return | many a day | queue: state, tier, blocker, filing due and balance-due dates (FLOW-7) | which return | open it |
| P2 | Gap review (RV-23) | once per return | each draft question beside its evidence | keep, edit slots, merge, drop, add from the bank | sign the list |
| P3 | Read the books (TB-3, TB-12) | once, then re-read after a new .GFI | QBO account, balance, QBO's GIFI code, last year's code, flag | accept a change from last year with a reason; for the other flags, fix in QBO and upload again | no flag left |
| P4 | Evidence and facts | many times | facts with status and source; documents waiting (a link to the Documents tab) | verify a fact (EV-8) | verified facts feed the import file |
| P5 | Round trip (RV-21) | each import cycle | six steps in fixed order, each tied to its file | download, import, tax choices, lock, upload, cite | trace |
| P6 | Trace (RV-22, RV-24, RT-14 to RT-16, TB-6) | after the upload | each orphan (tax choices among them), override and dropped cell: cell, value, class, cite action, source beside it | a source or a reason each | zero left |
| P7 | Diagnostics (RT-17) | after the upload | each diagnostic by iFirm category, the printed return beside it | a named reason for a Warning, a logged reason for Information, nothing for an Error (fix in Taxprep) | none not cleared |
| P8 | Exceptions (RV-24) | once | exception list, one answer box each | answer | all answered |
| P9 | CPA comments (RV-25, RV-12, RV-7) | after rework | comments by topic, type, severity, before and after; the drafted fix for a simple comment | resolve at the number; approve or reject a drafted fix | re-trace, sign again |
| P10 | Hand-off to review | each cycle | what is left, as links; attestations the CPA will see | sign | state: review |

## 2. Budgets

Measured at **1366 x 650** and **1093 x 525** (125% zoom), made-up returns, second monitor optional. A **page load** is a full document navigation. A step or tab change inside a return is a client-side route with its own URL and counts 0 loads. Opening a source adds no history entry. Panes never stack at either size.

| Task | Page loads | Clicks to start | Fields | Time |
|---|---|---|---|---|
| P1 open the next return | 1 | 1 (the name is the link) | 0 | under 3 s |
| Change step inside a return | 0 | 1 | 0 | under 1 s |
| P2 one question | 0 | 1 key | 0 to 2 | under 10 s |
| P3 accept one change from last year | 0 | 1 | 1 (reason) | under 30 s |
| Open any source from a figure or fact | 0 | 1 | 0 | under 1 s |
| P5 start the import-file download from the queue | 1 (opening the return) | 2 (name, then Download on the Checklist strip) | 0 | under 30 s |
| P6 source one orphan | 0 | 2 | 1 to 2 | under 30 s |
| P7 give a Warning its reason | 0 | 2 | 1 | under 30 s |
| P9 approve a drafted fix | 0 | 2 | 0 | under 15 s |
| Find any return, account or fact | 1 (results page) | search on every screen, `/` to focus | 1 | under 3 s |

No step asks the preparer to type their name (forensics: 14 name inputs). The hold (FLOW-10) shows who and since when and never blocks reading.

## 3. Default order and names for each list (rule 6)

| List | Default order | Clause |
|---|---|---|
| Queue | earliest filing due date, then tier (1 first), then name | RV-20 |
| Facts | the order of the return | RV-1 (printed order) |
| Accounts | QBO account number | TB-3 |
| Trace cells | needs-action first, then class (orphan, overridden, dropped), then cell | RT-14, RT-18 |
| Diagnostics | iFirm category, most severe first | RT-17 |
| Round trip steps | fixed order, not sortable | RV-21 |
One measure, one name: "Filing due", "Balance due", "Tier", "Flagged for a person", "Not cleared". One date format: day, month name, year ("30 Jun 2026"). The identity bar and the queue use the same words.

## 4. Pattern carried forward (recommended in the findings review; Zo confirms at the design sitting, question 2)

The split pane (round 1 version B): steps in a list on the left, one table per step in the middle, and the detail, the action and the shared source viewer in a non-modal pane at the right, with no page load. It sits inside the one record shell (identity bar plus record tabs; the workbench fills the Workbench tab). Versions A (plain record tabs) and C (worklists with a second window) stay in the repository as round 1 history and are not carried forward. Worklists across returns only if Zo asks; a bulk action never includes a row flagged for a person.

## 5. Where GOV.UK and MOJ parts fit, and where nothing exists
- Fit: Generic header, tags for status, task list (Checklist), summary list, inset text for "AI drafted, not verified", error summary and message, small radios (none preselected), file upload, details, MOJ identity bar, sub navigation (record tabs), notification badge, sortable table, search.
- No pattern, compose and write why (RV-52): the list-and-detail layout, the source pane and viewer with a second-window control, a sticky bulk bar with a count, a button drawn as a link for choosing a row, the step list with counts. Listed in each version's PARTS.md.
- No disabled buttons: an action that cannot run yet is absent and the page says what is left, with links (rule 8).

## 6. Sizes and checks the designer reports (design card checks 6 to 9, designer.md step 5)
Retired-term lint, prototype lint, axe (contrast "incomplete" counts as a failure until checked), a keyboard Tab walk, 320 px reflow and the budget counter at both sizes, numbers in `reports/design-workbench.md`.
