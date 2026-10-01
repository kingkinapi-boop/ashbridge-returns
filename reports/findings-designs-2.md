# Findings review 2: design re-test, before fix round 2 (four families)

1 Oct 2026, decision 0009. Opus findings reviewer (text returned to the Lead, who recorded it here). Read: `reports/design-retest-2026-10-01.md` (20 findings: Q1 to Q9, W1 to W4, C1 to C3, D1 to D4), `reports/findings-designs.md`, `.claude/rules/staff-screens.md`, `plan/cards/families/design.md`, the four designer reports and their CSS and JS on `claude/design-{queues-record,workbench,cpa-review,source-viewer}-2`. All 32 first-round fixes hold. What is left comes from 6 causes; the checks could not see 4 of them, because no verify script tests for them.

## Root causes (6)

- **RA: `hidden` loses to a display class (Q1).** Queues has no global guard: `a.css` patches `[hidden]` one class at a time (`.app-bulkbar`, `.app-opsform`, `.app-panel`), so `.govuk-error-message` (display:block) shows on load. Workbench `b.css:86`, CPA `ashbridge-v1.css:199` and the viewer `app.css:5` carry `[hidden]{display:none !important}`: safe by luck, not by rule. Bites next: D00 basis CSS, D05 upload forms, D09 ops forms, the build's `src/ui` error parts (render the message only on error; never toggle `hidden` on a GOV.UK class).
- **RB: An action moves the page (Q2, Q7, Q9).** `scrollIntoView` on the cited line inside a sticky pane scrolls every ancestor, including the window (`proto.js:164`, `:199`); the GOV.UK error summary at the top of the page makes an in-place form error jump there (rule 9 against rule 19); after browser Back nothing puts focus back on the row. Workbench `b.js:183` and viewer `work.js:109`, `:132` use the same calls (both `nearest`, safe today). Bites next: D05 uploads, D08 and D12 cite errors, D01 Back.
- **RC: The fold was measured on the list, never on the work inside a pane (W1, C2, D4, Q8).** Rule 18 and check 8 measure the first row and the pane heading only. Workbench puts the form above the excerpt and its sticky pane does not stay put (Cite at 916 / 966, excerpt at 1013 / 1088); the CPA comment panel gets about 290 px at 1093; viewer B's reason is in a closed fold 239 px down; queue rows wrap to 137 px. Bites next: D07, D08, D12, D05.
- **RD: Shared behaviour coded once per version (D1, D2, D3, C1).** Viewer B leaves focus in the box while A and C call the shared `advance`; C's done row keeps live buttons; CPA `a` targets only the Approve shown when every section is reviewed; three tab sets. Bites next: every family that embeds D03, D01's one shell (R13), D05's step-next.
- **RE: Words promise more than the data does (Q3, Q5, Q6, W3).** "Rework" means both mine (5) and all (33) with no scope word; the board caption keeps "All 300" while showing 33; search labels name year end and facts the index does not hold. Bites next: D10 owner board, D01 search, D09 ops counts, D05 "N of 6 steps".
- **RF: One verify script per family, one not committed (why RA to RE passed).** Four scripts, four sets of measures; Workbench's ran in a scratch folder. None checks no early error, scroll unchanged, action in view, focus not on body, a click changes something. Q4, W4, C3 and the font 404s are prototype limits, not faults.

## Fix list for round 2 (Q1, Q2 and Q7 before the sitting)

**Queues-record (A)**
1. One global `[hidden]{display:none !important}`; drop the per-class patches; no error until Assign or Upload is pressed (Q1).
2. Bulk and ops errors: summary at the top of the bar or form, focused, page scroll kept; the bar is one row high at 1093 (Q2).
3. Viewer: set the pane's own `scrollTop` to the cited line, never `scrollIntoView`; the identity bar stays in view (Q7).
4. Board: visible "Showing 33 of 300, state Rework", a caption that follows the filter, a Clear link (Q6).
5. Scope words on every Rework count: "My rework" and "All rework" (Q5).
6. Search matches year end as shown ("10 Dec 2025", "Dec 2025", "2025-12") (Q3).
7. Back focuses the row you came from (Q9).

**Workbench (B)**
1. The pane is pinned to the viewport and scrolls inside, on Trace, Books, Comments and Gaps (`align-self:start`, with a test that it stays put). Evidence first; the decision and its button pinned at the foot of the pane (W1).
2. One cite-or-reason part, shared with viewer B: typing a reason selects "A written reason" (or GOV.UK conditional reveal), never a "choose" error; the reason path takes 2 clicks (W2).
3. Search reaches trace cells by name and value, or the label drops "fact" (W3).
4. Commit the verify script under `design/prototypes/workbench/build/`.

**CPA review (V1)**
1. `a` with sections left focuses "Approve: N sections left" and announces why (C1).
2. At 1093 the comment panel opens over the trace and source panes, keeping the boxed figure's caption in its header; the 3 fields and Send in view with no scrolling inside (C2).
3. Local copies of the GOV.UK and MOJ files so the sitting works offline.

**Source viewer**
1. B calls the shared `advance` after Cite and Record (D2).
2. B uses the shared cite-or-reason part (Workbench fix 2); no closed fold (D4).
3. C: a done row shows a "Complete" tag and an "Undo" that asks for a reason; no live Complete button (D3).
4. D1 waits for D01 (one shell). No work now.

## Rule checks every verify script adds

One shared module, `design/verify/rules.mjs`, imported by every family; each first shown failing on a planted bad page, then run on every page and state at both rule-18 sizes.

- **V1 No early error.** On load and after any non-submit input: no visible `.govuk-error-message`, `.govuk-error-summary` or `--error` group; title does not start "Error: "; every `[hidden]` node computes `display:none`. Plant: a hidden error with `display:block`.
- **V2 The page stays put.** Every in-place action changes `scrollY` by at most 8 px and leaves the identity bar in view. Plant: `scrollIntoView` inside a sticky pane.
- **V3 The work is in view.** In every pane state, `data-evidence` and `data-primary` are inside the viewport with no page scroll; no primary action in a closed `details`. Plant: a form above a 1000 px excerpt.
- **V4 Focus lands.** After every in-place action and browser Back, `document.activeElement` is the result, the next row or the row you came from, never `body`; every listed shortcut focuses a visible control in every state. Plant: a cite that leaves focus in the box.
- **V5 Counts carry their scope.** Every visible count has a scope word or "N of M"; same name and scope, same number on every page; a filter updates the caption. Plant: "Rework 5" and "Rework 33".
- **V6 Search keeps its promise.** For each kind named in the search label or hint, a value copied in the format shown finds a match. Plant: a label naming year end with no year-end index.
- **V7 Every click does something.** A control whose click changes no DOM, URL, focus or announcement fails, in every state including done rows. Plant: a second "Complete".
- **V8 One choice, one action.** Typing in a field tied to an option never gives a "choose" error. Plant: the W2 form.

## Card and rule changes (Lead, amber; none red)

- Rule 9 gains "an in-place form puts its summary at the top of that form, not the page" (ends the clash with rule 19).
- Rule 20 gains "the evidence and the action are in view inside the pane".
- Design check 8 names the shared module and requires every verify script to be committed.
- D00 delivers the `[hidden]` guard, the pinned-pane part, the cite-or-reason part and the after-action helper; D01 the one shell, search scope and focus after Back; D03 owns `advance`.
- Also amber: the Q5 names; viewer chrome text at 14 px (A251).

## Risks and re-tests

- The global `!important` guard can hide parts scripts reveal by class while `hidden` stays set: re-run Queues' 34 task checks.
- Pinned panes that scroll inside bring back contrast "incomplete" results and need focusable scroll regions; at 320 px panes must still stack.
- Evidence above the form changes Tab order: keep "1 Tab from the box to the decision".
- The CPA panel over the source must not break rule 20 or CPA task 5.
- Typing that selects a radio: test both orders with picking a source.
- Undo with a reason: keep it to 3 fields, in place.
- Re-walk only: Queues bulk, ops forms, Documents, board, search, Back; Workbench P6 cite and reason, Books, Comments, Gaps; CPA tasks 5, 6, 7 (`a`); Viewer B cite and reason, C Complete. Then V1 to V8 on all four families.

## For Zo at the sitting, not fixed first

- Q8: whole rows at 1093 cost the filter line or the view tabs.
- The viewer pick: A, B or C.
- W1 after the fix, so he can feel the pinned pane when he answers question 2 (B or A).
- C2's panel over the panes.
- Questions (d) 1 to 6 of `reports/findings-designs.md` are unchanged. No new red question.
