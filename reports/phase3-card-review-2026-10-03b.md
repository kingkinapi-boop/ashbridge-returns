# Phase 3 card review b, 3 Oct 2026 (V02, V03, V04, V09, V13, V15, B06, T09, T10, T11 and neighbours)

Independent review before the first spec job (CLAUDE.md loop step 2). Read only: the cards, `plan/slices.json`, blueprint README end state, 00, 01, 02, 03, 04, 05, 06, 07, 08, 09, 11 (cited clauses), decisions 0020, AMBER A34, A387, A421, A433, `design/map/navigation.md`, `src/modules/lifecycle/moves.ts` and `index.ts`, `src/contracts/{lifecycle,storage,bridge}.ts`, `db/schema/{05_bridge,80_jobs,90_learning}.sql`, and the neighbour cards T01, T02, T05, T07, T12, B03, F10, V00. The fixes of reports/phase3-card-review-2026-10-03.md are applied on T08, Q00, Q01, I01, I30, I40 and are not repeated.

Every cited clause ID exists and says what the cards claim. No card lets AI clear, close or approve, or holds client wording. One clash with `decisions/` (RED 1).

## Verdicts

| Card | Verdict | Fixes |
|---|---|---|
| V02 | FIX | C2, 1 to 6 |
| V03 | FIX | 7 to 11 |
| V04 | FIX | C3, 12 to 16 |
| V09 | FIX | C2, 17, 18 |
| V13 | FIX | 19 to 21 |
| V15 | FIX | 22 to 24 |
| B06 | FIX | 25, 26 |
| T09 | FIX | 27 to 30 |
| T10 | FIX | 31 to 34 |
| T11 | FIX | 35, 36 |
| T08 | FIX | C1, 37, 38 |
| X00 | FIX | C2 |
| X01 | FIX | C2, 39 |
| Q00, Q01, I01, I30 | OK | none |
| I40 | OK | the `fix_draft` set goes to V13 (fix 19) |

## Fixes

### Cross-cutting

C1. [verified] Every guard needs an owner. F02 names each move's guard `<from>_to_<to>` and refuses one not passed in with "guard ... is not built yet" (`src/modules/lifecycle/moves.ts` line 31, `index.ts` line 71). No card registers `review_to_approved`, so T08's `approve` (line 21, F02's move to approved) would always be refused. `filed_to_assessed` has no card (A433's known gap; it blocks T10, fix 31). Outside this review but same cause: T01 line 29 (`build_to_prepare`) and T12 line 21 (`trace_to_respond`) move the state and register no guard. Edits: T08 line 9 Paths and slices T08 `paths` add `src/pipeline/deps.ts`. T08 line 21 append: "Registers guard `review_to_approved` with F02's lifecycle in `src/pipeline/deps.ts`; it passes only for the move `approve` makes inside its own transaction." T08 acceptance 12: "a direct F02 move review to approved outside `approve` is refused by the guard." New rule test (SC or CQ row, runs on every merge): "every guard name in `MOVES` is registered in `src/pipeline/deps.ts` or listed in `data/lifecycle/unbuilt-guards.json` with the card that owns it; a guard in neither fails, and the list must be empty at the phase 4 gate." Lead to check T01 and T12.

C2. [verified] Nothing lets a person answer a flag. CK-5 sends every flag to a person; RV-2 shows "the preparer's answer" beside each pinned flag; T05 and Q00 store flags; but X00 answers exceptions only (line 14) and V09 lists exceptions only (line 21). Flags from Q00, I01, I30, B01 and B07 have no answer path, so V02's "preparer's answer" is always empty for them. Edits:
- X00 line 14: after "Three kinds." insert "The target is an exception or a flag (Q00's `flags`), exactly one of the two; a flag takes the same three kinds." Line 18: `exception_answers` gains `flag_id` with a CHECK that exactly one of exception id and flag id is set. Acceptance 1 adds: "each kind stored for a flag; an answer naming both or neither target is refused." `statusOf` works the same for a flag.
- X01 line 17: replace "an open flag counts as met for amber or red" with "a flag raised in the latest run counts as met for amber or red whether or not a person answered it, so no answer, and no AI output, lowers a tier". Acceptance 6 adds "an answered flag still counts as met".
- V09 line 18: `readyForReview` lists "every exception and every flag whose X00 `statusOf` is `open`". Line 21: "The list holds open flags and exceptions in one EX-4 list". Spec line 29 RV-24: add "a flag is answered from the same box; an open flag blocks the sign like an exception". Log as amber (a flag for a person rather than a silent pass).
- V02 line 20: "the preparer's answer from X00 (for a flag or an exception)".

C3. [verified] The rework row of blueprint 02 ("changed cells re-traced and re-checked; preparer signs") and RT-18 ("the lock export at sign-off is saved as the preparer version") are not met by V04's guard. T12's `signOff` (line 21) moves only trace to respond, so nothing saves a preparer version or proves a re-trace after rework. V04 line 21: replace the guard sentence with "Guard `rework_to_review`: every comment of the round has a response; when any response is `done`, a lock export accepted after `sendForRework` exists and the trace and checks have run on it; and V09's `readyForReview` passes. The sign saves that lock export as a new preparer version (N00 `saveVersion` kind `preparer`, RT-18) and makes F02's move in one transaction (FX5's caller transaction)." V04 line 3 deps add N00 by name; line 6 Clauses add RT-18. Spec line 32 FLOW-2 adds: "a `done` response with no new lock export refuses the sign naming it; a passed sign stores exactly one preparer version (property over response mixes, fixed seed)".

### V02
1. [verified] Line 3 and slices: deps replace Q46 with B03, T05, Q00, X00, each used directly (`priorYearValues`, `blockingDiagnostics`, flags, answers); Q46's flag reaches the brief through Q00 like any other.
2. [verified] RV-1 opens the brief with "identity, year, CCPC and association status, openings"; the card has none. Line 17 add a first bullet: "Identity (RV-1): corporation, business number, year end, CCPC status and association status (facts with their dots), and the openings (B03's prior closing values that open this year), each with its source pointer." Spec line 29 add a class: "RV-1 identity: each item equals its fact or B03 value; a missing one shows 'not known' with no blank cell".
3. [verified] RT-17 (cited) and T05 line 14 say a Warning's written reason is "shown in the brief"; the card does not show it. Line 23 append: "Each Warning diagnostic shows with its named preparer's written reason (T05); a Warning with none turns the diagnostics attestation red." Spec adds that case.
4. [verified] Two brief parts have no Spec class. Spec line 29 add: "What changed (property, fixed seed): new and gone lines exactly; the listed ten are the ten largest absolute changes, ties by natural key; fewer than ten lists all; the count is read from the parameter"; "Assumptions: exactly the client-answer facts feeding a figure and the cited tax choices, none missing, none extra".
5. [inferred] Line 4 and slices: tag security (true). The page is CPA and owner only, the same reason V15 carries it; `/security-review` before boarding. (Read RED 1 first.)
6. [verified] Line 35: replace "The CPA queue at /review (no card yet; see reports/cards-V02-V13-draft.md)." with "The CPA queue at /review (V15)."

### V03
7. [inferred] Spec line 35 RV-5: add "a cell added to or removed from the section (a new repeating-group copy, a cell emptied) takes the mark off; copies renumbered with equal values do not (LL-3, natural row key)". The stored-values rule in line 20 must compare by natural row key, not copy number: add those words to line 20.
8. [verified] Line 17 "raises a flag naming the form": V03 owns no check and no flag table. Replace with "is named on its section and in `readyToApprove` ('form not placed: <form>'), and the review passed to T08 names it". Fix 38 gives T08 the matching section.
9. [inferred] Line 26 add: "A section with no cells in this return shows 'nothing in this return for this section' and still needs a mark (RULE-7)." Amber.
10. [verified] Line 30: "calls T08's `approve` with every mark, every risk judgment, the seconds per section and the source-log ids of this review" (T08 refuses unjudged risks, A421; fix 37).
11. [verified] Line 22: the `comment` verdict "(V04 then takes it)" has no taker in V04 and V03 cannot call V04. Replace with "`accepted` with a reason; the `comment` verdict is written by V04 with its comment id (fix 14)".

### V04
12. C3 above.
13. [verified] Line 20 builds `resolve` but no screen offers it. Line 27 append: "each comment of the round with a response shows Resolve (CPA only)". Spec line 32 adds: "resolve by the CPA closes the comment; by a preparer, AI or system it is refused".
14. [verified] Line 18 append: "A comment on the cell of an accepted-risk exception may name that exception; it then records V03's `judgeRisk(exceptionId, 'comment')` with the comment id in the same transaction." Clauses line 6 add EX-1 and RV-6 (the `c` shortcut).
15. [inferred] Line 4 and slices: core true. V04 owns two lifecycle gates and who may comment, respond and resolve (permissions), as V09 is core for its gate; spec read and check by Opus.
16. [inferred] Line 3 and slices: Size L (module, migration, two guards, four screens).

### V09
17. C2 above.
18. [verified] Line 3 and slices: deps add T12 and V00 by name (`blockers` and the access contract are called directly; today only through V12 and V05). Tag security true (who may answer and sign), `/security-review` before boarding.

### V13
19. [verified] AI-11 (cited in "Not in this card", not in Clauses): I40 builds one set per step type that exists when it lands, and `fix_draft` is new here, so no card owns its evaluation set. Line 3 and slices: deps add I40. Line 5 and slices Paths add `data/ai/evals/sets/fix_draft.json`. Line 6 Clauses add AI-11. Spec adds: "AI-11: with the `fix_draft` triple absent from `approved.json` the project engine is refused and no draft shows; the set holds one case per recorded answer above".
20. [verified] Line 22 refuses "a draft whose sources changed since it was made", with no Spec class. Spec line 28 add it, naming the change.
21. [inferred] Spec line 28 RV-12: "a table over all four comment types: presentation and error get a job, question and missing evidence never".

### V15
22. [verified] Line 20 says "then filing due date, then id"; X01's Lead note (A433) puts the longest wait before id. Change to "then filing due date, then longest waiting, then id".
23. [inferred] "Overdue" has no stated meaning. Line 22 append: "Overdue means the pinned clock is past the filing due date (FLOW-12); a past balance-due date shows in words but does not count as overdue." Amber; the same words go on X01 (fix 39).
24. [verified] Line 33 "V00 or U02 owns the route mapping" becomes "V00 owns the route mapping (A421)". Slices title: replace "oldest first" with "in Zo's order (Z20-4)".

### B06
25. [verified] Line 6 and slices Clauses add SEC-7 (record refuses UPDATE, DELETE, TRUNCATE, line 21), SEC-11 (line 24) and AI-7 (line 23).
26. [verified] F10 line 24: pipeline steps run as queued jobs (`runPipeline` enqueues through F06), so the void through `approval-watch.ts` is not in the recheck's call. Line 31: `voided` means "void requested; the approval-watch job voids". Spec line 17 append: "the test runs F06's queue to idle before asserting the void".

### T09
27. [verified] Line 3 and slices: deps add T11. The fixture "moved to `ready_to_file`" (line 18) passes `approved_to_client_sign` and `client_sign_to_ready_to_file`, which F02 refuses until T11 registers them.
28. [verified] Line 36 "calls T08's `checkAgainstApproval` with the check export's cells" would void on an ignored cell (`IFirm.ContactPartner` is in the fingerprint). Change to "with the mismatched cells only (ignored cells are never passed)", as A433's T08 note allows. Spec line 22 add: "with `IFirm.ContactPartner` wiped and one input cell changed, the void names only the changed cell".
29. [verified] Line 6 and slices Clauses add TB-11 (Spec line 23) and SEC-2 (line 28).
30. [verified] Same as fix 26: Spec lines 22 and 23 run F06's queue to idle before asserting a void.

### T10
31. [verified] The fixture (line 14) needs the move filed to assessed; its guard `filed_to_assessed` has no card (A433 gap, C1). Card it (notice of assessment compare, FLOW-8 follow-up item, `assessed` version, deps E18, T09, N00) and add it and W29 to T10's deps (line 3, slices). T10's spec waits on it.
32. [verified] FLOW-9 says "read-only", but line 20 and line 32 guard only INSERT, and some tables take updates (`returns.client_handoff` status, `returns.jobs`). Line 20: "an insert, update or delete on any table with a `return_id` for that return is refused".
33. [verified] `returns.jobs` has `return_id` (`80_jobs.sql` line 7): the runner updates the freeze job's own row after the close in the same job, so fix 32 refuses it. `returns.differences` has `return_id` (`90_learning.sql` line 6): END-5's CRA-assessment differences and LL ranking may write after close. Line 20 exemptions add `returns.jobs` (runner bookkeeping) with its reason. For `returns.differences`, either exempt it with a reason or require the N cards to write before close; add the choice to line 32 and a note on N01's slice.
34. [verified] Line 6 and slices Clauses add SEC-2 (Spec line 24) and AI-7 (line 24).

### T11
35. [verified] Line 3 and slices: deps add A05 (write-once store, line 20), E00 (certificate words, line 20), W20 (fixture PDF, line 14), G01 (question rows, line 17).
36. [verified] Line 23 reads the filing date from "T09's filing record", which would make T11 depend on T09 while T09 needs T11 (fix 27). Change to "the date of F02's state event into `filed` (T09 makes that move)". Line 7 drops `plan/cards/T09.md`.

### T08
37. [verified] The A421 note makes `approve` refuse unjudged accepted risks, but T08's deps lack X00 and the judgments live in V03's `74_review.sql`, which lands after T08. Line 7 and slices: deps add X00. Line 21 append: "The `review` input carries the CPA's risk judgments (exception id, verdict, reason or comment id), stored with the review record; `approve` reads X00's `statusOf` through a port passed in and refuses while any `awaiting_cpa` exception has no judgment, naming them." Acceptance 12: that refusal.
38. [verified] Line 20: "RV-1's review sections as ids in their fixed order, then `not_yet_placed`; `approve` requires a mark on `not_yet_placed` only when the review names a form in it" (fix 8).

### X01
39. [verified] Line 20 and acceptance 8 still say "then due date, then id" under the A433 note. Fold the note in: "then due date, then longest waiting (`waitingSince`, passed in by the caller), then id", with fix 23's meaning of overdue.

## Gaps with no owner (cards to write)
- The notice of assessment compare and the move filed to assessed (fix 31; A433).
- FLOW-8's amended return: `MOVES` has no move out of filed or assessed, T11 line 22 and T10 assume a new return record, and no card creates it. A card, or a line on V10.

## RED

1. **Who sees the Review tab (V02, V03).** V02 line 24 and V03 line 25 make the brief and the full return "CPA and owner only", with "a preparer gets 'not found'" (V02 line 29, V03 line 35). Decision 0020 Z20-6 and A387 (`design/map/navigation.md` line 13) give every role the same record tabs, and V00's `canSee` lets the assigned preparer see the return (SEC-2). The cards clash with a decision, and either way changes who sees what. Recommendation: the assigned preparer sees the brief and the sections read-only (no mark, judge, approve or comment controls; comments hidden until `sendForRework`; opens still logged, SEC-3); ops stays as V00 has it (no access in review). Meanwhile: keep the cards' rule as one row in V00's access table, so the answer is a data change, and write the SEC-2 classes from that row.

Not red, for the Lead's AMBER rows: T11's `federal_tax` is T07's `part1_tax` (draft note 21). It is a tax figure the client will see, so give it a CPA check line like other tax rules. B06's `blocked` hold with no new move, and V03's added Approve condition, are already settled (A433, A421).
