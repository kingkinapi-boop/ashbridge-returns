# Cards V02, V03, V04, V09, V13: draft notes for the Lead

Drafted 3 Oct 2026 by a helper. Cards in `plan/cards/`; `plan/slices.json` entries set to `carded` with paths and clauses. Every choice below is amber for the Lead to log (what, why, how to reverse). Nothing here is red, except where flagged as a question for the Lead to judge.

## Across all five

1. **Addresses and folders differ.** `design/map/screens.md` gives addresses such as `/returns/{returnId}/review/{section}`; the slices' Paths put files under `src/app/(staff)/review/<name>/` (as V12 and V14 already do). No card says how one maps to the other. Settled: the cards keep the slices' folders and name the map's screens; the shell (V00) or U02 owns the route mapping. Reverse: move the folders under `src/app/(staff)/returns/[returnId]/...`. Worth one line on V00 or U02.
2. **Lifecycle guards.** F02 refuses `respond_to_review`, `review_to_rework` and `rework_to_review` as "not built yet". Settled: V09 builds `respond_to_review`, V04 builds the other two, each registered with F02's lifecycle in `src/pipeline/deps.ts` (F10's composition root). Both list `src/pipeline/deps.ts`; V04 depends on V09, so they run in order. Reverse: a single guards card.
3. **Shared files, serialized by deps** (same pattern as T01, T04, T12 sharing `45_roundtrip.sql`): V03 takes V14's `review/early/**` and `e2e/staff/review-early.spec.ts` (V03 folds the early slice in and retires its route, so there is one CPA review screen, RV-1); V04 adds the Comment control to V03's `review/sections/actions.tsx`; V13 mounts its panel in V04's `prepare/comments/comment-card.tsx`. V13 shares `src/pipeline/handlers.ts` with T08, I01 and I30 (the one register, as before) and `src/contracts/ai.ts` with FX3 (phase 0, lands first). New migrations 74, 75 and 76 sit under FX3's `db/schema/**` claim; FX3 lands long before phase 3.
4. **New migration numbers:** 74_review (V03), 75_comments (V04), 76_fixes (V13); 71 to 73 are taken (X00, X01, I30).

## V02 the brief

- **Dep added: T12** (the attestations need `blockers`; it is not reached through the other deps). B03 and T05 are reached through Q46 and T12.
- **Q46 kept** as listed, but the brief needs it only as one more pinned flag; RV-2's "instalments" is T07's review line, not next year's instalments. Drop Q46 if the Lead agrees.
- "What changed since last year" had no testable meaning. Settled: new lines, gone lines, and the ten largest changes by absolute amount, by natural key; 10 is a firm parameter. Reverse: another count, or every change.
- "Assumptions and client decisions" settled as: facts whose source is a client answer, plus tax choices typed in Taxprep with their cite.
- Attestations are worked out at render time from T12, T05 and N00, never stored claims; a failed one shows red with what remains.
- An unconfirmed T07 review line shows "not confirmed in Taxprep yet" beside its value (T07 keeps unconfirmed placeholders until the trial confirms them).
- **Gap: no card owns the CPA queue** (`/review` in the map: RV-8 queue order, FLOW-7). V05 is the preparer queue only. Recommend a new card (screen, phase 3, deps V00, X01, D02 or D04, U02) using X01's `queueOrder`. Not folded into V02, to keep V02 at M.

## V03 sections, coverage, approve

- **Size raised to L** (marks module, data file, three panes for every cell, approve). Hard kept. Tagged core and security.
- **Clauses added:** RV-4, EX-1, AI-7, SEC-2, SEC-3, SEC-7 (each is tested in the Spec).
- **Section placement is data:** `data/review/form-sections.json` maps each Taxprep form to an RV-1 section and a view (`cells` or `printed`, RV-9). A form it does not name goes to "Forms not yet placed", still needing a mark, and raises a flag (RV-1's "nearest section" rule is not testable as written). Reverse: a coded nearest-section rule.
- **RV-9 page finding:** printed pages are found by the form's header words in T07's printed return (E00's words); T07 does not map pages to forms. If the header words are not found the section shows the whole printed return and still needs a mark.
- **Marks survive between rounds** and come off only when a cell value in their section changes (RV-5, RV-7): each mark stores the section's cell values when made.
- **Time per section** (RV-11): from view events on the injected clock, gaps over 5 minutes idle not counted (firm parameter). Reverse: raw open-to-close time.
- **CPA judgment on accepted risk.** X00 leaves "the CPA's judging of accepted risk" to V03, and no clause says how. Settled: `judgeRisk` (accepted with a reason, or comment), and Approve shows only when every section is marked and every accepted risk is judged. **This adds a condition to RV-10's Approve rule.** It follows EX-1 ("for the CPA to judge") and is the smaller reversible option, but the Lead should check it is amber, not red. Recommend also adding one line to T08 (not yet specced): `approve` refuses while an accepted-risk exception is unjudged, so the screen is not the only gate.

## V04 comments and rework view

- **Deps added: V09** (shared `readyForReview` for the rework sign) and **D08** (the preparer's CPA comments page is in D08's design, which carries RV-25).
- **RV-25 moved here from V09.** The map puts "CPA comments" (RV-25, RV-7, RV-12) on its own preparer screen; V09 is the exceptions screen.
- **Severity list** had no values. Settled: must fix, should fix, note (codes never renumbered). Reverse: another list.
- **"Grouped by topic"** settled as the RV-1 section of the commented cell, in section order. Reverse: group by comment type.
- **Comments are on a number only** (the map has only "Comment on a number"). A comment on a whole section is not offered.
- **When comments reach the preparer:** comments are saved during review and released together when the CPA presses "Send for rework" (review to rework). Where that button sits is for D02 to show; **D02's brief must include it** (the map's navigation has no such row yet). Reverse: release each comment at once without a state move.
- **Comment life:** open, then the preparer's response (done or answered), then resolved by the CPA on re-review. Unresolved comments do not block Approve (the blueprint names no such gate).
- Rework sign (rework to review): every comment of the round answered, plus V09's `readyForReview`.

## V09 exceptions, orphans and overrides

- **Dep added: V12** (V09 reuses V12's rows and cite action by import; A225).
- **RV-25 dropped** (moved to V04). D08's slices clauses still list RV-25: correct, since D08 designs both pages.
- **The sign from respond to review** lives here (`src/modules/respond/`), calling T12's `blockers` again as T12's note requires. An accepted-risk exception does not block (it goes to the CPA).
- Tagged core (the gate). Not tagged security: permissions come from V00 and X00.
- The page also works in trace and rework (the map lists trace and respond); rework is added so re-run exceptions can be answered.

## V13 AI-drafted fixes

- **Dep added: D08** (the draft sits on the CPA comments page). **D08 should also list RV-12** in its slices clauses and brief; no design card names RV-12 today.
- Hard, core and security set (citations, AI cannot change anything).
- **New AI step type `fix_draft`** in `src/contracts/ai.ts` (the step list is closed). Two kinds of change only: a new value for one fact behind the commented figure (applied on approval through L00 `changeFact` then `verifyFact` by the preparer, so T01 re-imports only that cell, RT-8), or a value to type in one Taxprep cell (recorded as the preparer's to-do; the next trace checks it). Anything else is no draft. Reverse: add a books (QBO mapping) kind later.
- **"Simple" in code** (A34): presentation, or error on exactly one cell. Since V04's comments are always on one number, every error comment qualifies; question and missing evidence never do.
- **Scope check by code** on top of I00's citation checks: the drafted fact must be among the figure's `sourcesOf`, and its new value must appear in a cited box or ledger record.
- **Only the assigned preparer approves** (RV-12 names the preparer); the CPA cannot approve a draft. Approving never responds to or resolves the comment.
- **AI-11:** the `fix_draft` triple must pass I40's evaluation set before the project engine runs it; until then no draft shows. Tests use recorded answers only.

## Clashes found

- None with `decisions/`. The one to judge is V03's added Approve condition (accepted risks judged), noted above.
- `design/map/screens.md` lists "Exceptions and orphans" in trace and respond only; V09 adds rework. A one-line map edit at the next design pass.
