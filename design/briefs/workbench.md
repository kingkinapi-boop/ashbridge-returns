# Brief: the preparer's workbench (v1.2)

Re-checked 3 Oct 2026 against blueprint v1.2 (main, with the Oct 3 clauses CK-51 to CK-59 and AI-13) and ambers A164, A246, A314, A421, A433, A444, A485. First written from b9c5003 (29 Sep) and rewritten 1 Oct after the design findings review (`reports/findings-designs.md`, RC1). If a commit newer than this re-check touches the clauses listed here, re-check before design starts.

Builds on `reference/research/2026-09-29-staff-ux-patterns.md` sections 5B and 5C. Clauses: RV-12, RV-20 to RV-25, RV-50 to RV-55, FLOW-10, EV-8, EV-9, EX-1 to EX-4, TB-2, TB-3, TB-6, TB-11, TB-12, RT-1, RT-2, RT-7, RT-8, RT-14 to RT-18, RT-20, RT-25, RT-26, AI-12, END-7; decisions Z19-1, Z20-2, Z20-3, Z20-6; ambers A164, A246, A314, A421, A433, A444, A485.
Zo's taste: Excel and Salesforce record pages with related lists; top-to-bottom order; separate tabs for separate things; /internal failed by putting everything on one page.

## 0. What v1.1 settles (these are not questions for the designer or Zo)

- The books live in QuickBooks Online. QBO makes the GIFI mapping; Returns reads it from the .GFI file the preparer downloads from QBO and uploads, and flags an account mapped to no code, to more than one, differently from last year, or to a total code CRA calculates (TB-3, TB-12). Returns never proposes codes and has nothing to confirm.
- Tax choices (CCA claims, dividend designations, elections, business limit shares, loss and donation claims) are made in Taxprep, not on a Returns form. Each typed value is read from the lock export and gets a source or written reason through the cite button, beside the orphans (TB-6, RV-22, RT-16). Returns has no separate form for them.
- The round trip is RV-21's checklist, a GOV.UK task list in this order (A164, A246): GIFI mapping (the .GFI upload); Import file (download); In Taxprep (import, tax choices, lock), ending with a Ready button; Upload (lock export and printed return, one form); Diagnostics (paste); Cite and explain; Sign off. "N of 6 steps" is a count computed from the list, never typed.
- The lock export classes each cell as traced, overridden, dropped, rolled forward, orphan or calculated (RT-14). Dropped blocks sign-off (RT-18).
- Diagnostics are NOT read from the printed return (RT-11: the printed return is the binder record only; A314, Z19-1). The preparer copies the list from Taxprep's Diagnostics panel (All tab, Hidden rows included) and pastes it with the lock export, each row keyed `<code>_<cell id>` (RT-17). By iFirm category: Error or Filing error blocks with no override; a Warning needs a named preparer's written reason, shown to the CPA; an Informative or Filing warning may stay with a logged reason; Hidden or Ignored never counts as cleared; an unparsed row, unknown code or unknown severity counts as Error until a person classes it.
- For a simple CPA comment AI drafts the fix with citations and nothing changes until the preparer approves it; it goes through the normal round trip (RV-12).
- Keys follow D01's one list (A485 K1): n next flag, p previous flag, m next number, o open the number's source (in the second window when it is on), r reviewed and next, a focus Approve, c comment, ] and [ source steps, s search. A single key never unmarks, approves, sends or deletes. The second window is a checkbox beside "Open in a second window", saved per signed-in person, default off (A485 K2, Z20-3); it opens only when asked.
- Steps are a vertical side navigation inside the Workbench record tab, not tabs; no Worklists tab (Z20-2, Z20-6, rule 23). No Today page: each role lands on its own list (A485 M4).
- Retired terms are listed in design card check 6 (`plan/cards/families/design.md`); none may appear in this brief or in a prototype.

## 1. Task scripts (preparer; a few returns a day, each held over several days)

| # | Task | How often | Must see together | Decides | Next |
|---|---|---|---|---|---|
| P1 | Pick a return | many a day | queue: state, tier, blocker, filing due and balance-due dates (FLOW-7) | which return | open it |
| P2 | Gap review (RV-23, AI-12) | once per return | each draft question beside its evidence | keep, edit slots, merge, drop with a reason, add from the bank (bank items only) | sign the list ("Nothing to ask" when empty) |
| P3 | Upload and read the .GFI (TB-3, TB-12, A164) | once, then after a new .GFI | code lines read (one per GIFI code, no account column), firm, tax year end beside the return's year end, flags | refused: header-only file, layout mismatch, a code CRA calculates, unknown code, so fix in QBO and upload again; accept a change from last year with a reason | no flag left |
| P4 | Evidence and facts | many times | facts with status and source; documents waiting (a link to the Documents tab) | verify a fact (EV-8) | verified facts feed the import file |
| P5 | Round trip (RV-21, RT-7, RT-8, A246) | each import cycle | the task list in the fixed order; waiting and held-back rows beside Download; the "Taxprep still holds" list (cells whose figure is gone, each with "Clear in the next file" and a reason) | download, import, tax choices, lock, press Ready, upload, paste diagnostics | trace |
| P6 | Trace (RV-22, RV-24, RT-14 to RT-16, RT-20, TB-6) | after the upload | each orphan (tax choices among them), override, dropped and changed-outside cell: cell, value, class, cite action, source beside it; allowed and linked cells collapsed | one source or one written reason each | zero left |
| P7 | Diagnostics (RT-17, A314) | after the upload | the pasted list grouped by category; the panel's All count typed by the preparer; "list incomplete" when counts differ; "gone since the earlier paste" | a named reason for a Warning, a logged reason for Informative, nothing for an Error (fix in Taxprep); acknowledge a "gone" row | none not cleared |
| P8 | Exceptions (RV-24, EX-1 to EX-4) | once | one list, red first then dollar effect; radios Fixed, Explained, Accepted risk, none preselected | answer; "Use last year's answer" is a click, never applied by itself; an accepted risk is tagged "for the CPA" | all answered |
| P9 | CPA comments (RV-25, RV-12, RV-7) | after rework | comments by RV-1 section; type (error, question, missing evidence, presentation) and severity (must fix, should fix, note); the drafted fix for a simple comment, with before and after and citations | answer in place; approve or reject (reason) a drafted fix, only the assigned preparer | re-trace, sign again |
| P10 | Hand-off to review | each cycle | blockers as links (uncited orphans, overrides with no reason, dropped cells, changed-outside cells, blocking diagnostics, "no accepted lock export", "no diagnostics list for the latest lock export"); attestations the CPA will see | Sign and send to review, present only when nothing blocks | state: review |

## 2. Budgets

Measured at **1366 x 650** and **1093 x 525** (125% zoom), made-up returns, second monitor optional. A **page load** is a full document navigation. A step or tab change inside a return is a client-side route with its own URL and counts 0 loads. Opening a source adds no history entry. Panes never stack at either size.

| Task | Page loads | Clicks to start | Fields | Time |
|---|---|---|---|---|
| P1 open the next return | 1 | 1 (the name is the link) | 0 | under 3 s |
| Change step inside a return | 0 | 1 | 0 | under 1 s |
| P2 one question | 0 | 1 key | 0 to 2 | under 10 s |
| P3 accept one change from last year | 0 | 1 | 1 (reason) | under 30 s |
| Open any source from a figure or fact | 0 | 1 | 0 | under 1 s |
| P3 upload the .GFI | 0 | 2 (choose, Upload) | 1 file | under 30 s, result in view |
| P5 start the import-file download from the queue | 1 (opening the return) | 2 (name, then Download on the Checklist strip) | 0 | under 30 s |
| P5 clear a cell Taxprep still holds | 0 | 2 | 1 (reason) | under 30 s |
| P5 press Ready after Lock | 0 | 1 | 0 | under 1 s, focus on the Upload step, announced |
| P5 upload lock export and printed return; read a refusal | 0 | 3 | 0 | refusal and fix in view without page scroll |
| P7 paste the diagnostics list | 0 | 3 (paste, type count, Check) | 2 | under 60 s |
| P7 acknowledge "gone since the earlier paste" | 0 | 1 | 0 | under 10 s |
| P6 source one orphan | 0 | 2 | 1 to 2 | under 30 s |
| P6 reason for an override or dropped cell | 0 | 2 | 1 | under 30 s |
| P7 give a Warning its reason | 0 | 2 | 1 | under 30 s |
| P8 answer one exception | 0 | 2 | 1 | under 30 s; "Use last year's answer" 1 click |
| P2 gap review: keep, edit, merge, drop, add, sign | 0 | 1, 2, 2, 2, 2, 1 | 0, 1, 0, 1, 0, 0 | under 15 s each |
| P9 approve a drafted fix | 0 | 2 | 0 | under 15 s |
| P9 reject a drafted fix | 0 | 2 | 1 (reason) | under 20 s |
| P9 answer one CPA comment | 0 | 3 | 1 | under 30 s |
| P10 Sign and send to review | 0 | 1 | 0 | blockers visible without scrolling |
| Find any return, account or fact | 1 (results page) | search on every screen, `/` to focus | 1 | under 3 s |

No step asks the preparer to type their name (forensics: 14 name inputs). The hold (FLOW-10) shows who and since when and never blocks reading.

## 3. Default order and names for each list (rule 6)

| List | Default order | Clause |
|---|---|---|
| Queue | earliest filing due date, then tier (1 first), then name | RV-20 |
| Facts | the order of the return | RV-1 (printed order) |
| Accounts | QBO account number | TB-3 |
| Trace cells | needs-action first, then class (orphan, overridden, dropped, changed outside the trace), then cell | RT-14, RT-18, RT-20 |
| Diagnostics | iFirm category, most severe first | RT-17 |
| Exceptions and flags | red first, then dollar effect | EX-4 |
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

## 7. Screens this brief covers, and what each must draw (A164, A246, A314, A421, A444, A485)

- **D07 Gap review steps**: states keep, edit slot values, merge, drop with a reason, add from the bank; "Nothing to ask"; sign refused naming each empty slot; read-only with "held by <name>" for a non-holder (FLOW-10). Staff labels only, no client wording (END-7). At least two returns with gap lists, plus empty, error and approved.
- **D05 Gaps and Round trip**: the task list above. GIFI mapping states: before upload; read; refused (header-only file: "pick T2 Corporation on the Tax mapping tab in Workpapers, then export again"; layout mismatch; a code CRA calculates, counted as unmapped; unknown code); flagged for a person. Import step (RT-7): a new natural key goes to the next free copy ("CCA class 10 goes to copy 3"); with no export since the return was created, new rows are held back ("export once, then re-import"); rows waiting on verification are listed with links; a re-import lists only changed and cleared cells (RT-8). The Lock step ends with Ready (the return moves from prepare to trace; "I imported it" is not proof, RT-26). Upload step (one form, two files): accepted with a count per RT-14 class; accepted with the flag "business number not entered" (RT-1); refused, each with reason and fix: another client's return, year end differs, header GUID differs, stale by content (RT-2), number format (cents are refused: whole dollars only, RT-25), a character outside Windows-1252 (row named), not a PDF, over the size cap. Diagnostics step: paste box, the typed All count and instruction text; the result by category; sample rows from the made-up day 3 probe file. Sign off appears only when nothing blocks (RT-18, rule 8).
- **D08 Trace**: the six classes in words (traced, overridden, dropped, rolled forward, orphan, calculated), each seen at least once across the sample returns (A246's gate); collapsed groups for allowed cells and "linked from another return" (RT-15) and for Auto-filled "imported from CRA" cells (an edited one is an override); an override shows imported and typed values side by side; dropped links to re-import; "changed outside the trace" is its own flagged row (RT-20); the Schedule 100 rounding line reads "rounding" (RT-25). D08 also draws the exceptions page (P8) and the CPA comments page (P9, A421): one h2 per RV-1 section; a drafted-fix panel for simple comments only, tagged "AI draft" in words, with two kinds of change (a fact value, or an entry typed in Taxprep that becomes the preparer's to-do), Approve draft and Reject for the assigned preparer only; "cannot tell" shows its reason. An accepted-risk exception reads "for the CPA to judge"; the preparer's page offers no judge control.
- **D12 Comments and cite**: the cite step records exactly one of an EV-5 source pointer or a written reason; candidates list the exact value first, "rounds to this value" apart, none preselected; typing a reason selects "A written reason"; tax choices are tagged by kind (CCA claim, dividend designation, election, business limit share, loss or donation claim); an empty reason uses the error pattern; no AI suggestion is drawn as a choice (RT-16, RV-22, TB-6).
- **Flag list (CK-51 to CK-59, AI-13, CK-38)**: the one EX-4 list may show these made-up test-world flags, each with its tax effect and a source pointer: a non-capital loss continuity gap (CK-51), a pre-registration input tax credit claim (CK-52), pay to a relative with no T4 (CK-53), small supplier limit (CK-54), late-filing exposure (CK-55), foreign-currency balance (CK-56), inventory differing from the onboarding count (CK-57), prepaid expense not deferred (CK-58), quick method eligibility (CK-59), slips the return implies, now including T5018 and T4A (CK-38), and two checklist topics raised by code with citations (AI-13: a government receipt in suspense or income; a research account that is not nil). The CPA decides each outcome. No new screen: only rows in the one list.
- **Not owned**: no D card or clause owns a Books screen (A164 put the .GFI inside the round trip); designers treat any Books view as context, not for approval. Every source opens through D03; the second window follows rule 20 and A485 K2.
