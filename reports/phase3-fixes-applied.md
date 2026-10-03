# Phase 3 card review b: fixes applied, 3 Oct 2026

Source: reports/phase3-card-review-2026-10-03b.md, with the Lead's four decisions. Cards only; no code. Branch claude/phase3-fixes. Card line numbers in the review were matched by content.

## Cross-cutting
- C1 applied: T08 Paths and slices add `src/pipeline/deps.ts`; Build registers guard `review_to_approved` (passes only for `approve`'s own move); acceptance 12 added. Rule test is SC10's R89 (Lead decision 3). "Lead to check T01 and T12" taken as the report's recommendation (decision 4): T01 registers `build_to_prepare`, T12 registers `prepare_to_trace` and `trace_to_respond`, each with `src/pipeline/deps.ts` in Paths (card and slices).
- C2 applied: X00 (flag target, `flag_id` with exactly-one CHECK, acceptance 1, `statusOf` for flags), X01 (answered flag still met, acceptance 6), V09 (`readyForReview` covers flags, one EX-4 list, RV-24 class, open-flag fixture), V02 (answer for a flag or an exception). Amber row NOT written: the Lead logs it (a flag for a person rather than a silent pass).
- C3 applied: V04 guard sentence replaced (done response needs a lock export after `sendForRework`, trace and checks run; sign saves a preparer version through N00 and moves in one transaction); deps add N00; Clauses add RT-18; FLOW-2 spec cases added.

## Numbered fixes
1. Applied: V02 deps replace Q46 with B03, T05, Q00, X00 (card and slices).
2. Applied: V02 Identity bullet (RV-1) first in the brief; RV-1 identity class.
3. Applied: V02 Warning reasons shown; a Warning with none turns the attestation red; RT-17 class.
4. Applied: V02 What changed and Assumptions classes.
5. Applied: V02 tagged security (card Tags, Where line, slices). Reason reworded for RED 1's settlement (who sees the brief, preparer read-only, opens logged).
6. Applied: V02 Not in this card names V15.
7. Applied: V03 marks compare by natural row key (LL-3); RV-5 class adds added, removed and renumbered cells.
8. Applied: V03 unplaced form is named on its section and in `readyToApprove`, and reaches T08 in the review.
9. Applied: V03 empty section shows "nothing in this return for this section" and needs a mark (RULE-7). Amber for the Lead to log.
10. Applied: V03 Approve passes every risk judgment to T08; RV-11 class too.
11. Applied: V03 `judgeRisk` `comment` verdict written by V04 with its comment id.
12. Applied: see C3.
13. Applied: V04 Resolve shown (CPA only) on the rework view; resolve refusals in the spec.
14. Applied: V04 comment may name an accepted-risk exception and records V03's `comment` judgment in the same transaction; Clauses add EX-1 and RV-6 (card and slices); EX-1 and RV-6 classes added.
15. Applied: V04 core true (card Tags, Where line, slices).
16. Applied: V04 Size L (card and slices).
17. Applied: see C2.
18. Applied: V09 deps add T12 and V00; security true with `/security-review` (card and slices).
19. Applied: V13 deps add I40; Paths add `data/ai/evals/sets/fix_draft.json`; Clauses add AI-11; AI-11 class; Not in this card now says V13 writes the set.
20. Applied: V13 spec class for a draft whose sources changed, naming the change.
21. Applied: V13 RV-12 table over all four comment types.
22. Applied: V15 order adds "then longest waiting" before id.
23. Applied: V15 and X01 define overdue (past the filing due date; balance-due date not counted). Amber for the Lead to log.
24. Applied: V15 "V00 owns the route mapping (A421)"; slices title now "in Zo's order (Z20-4)".
25. Applied: B06 Clauses add SEC-7, SEC-11, AI-7 (card and slices).
26. Applied: B06 `voided` means void requested, the approval-watch job voids; the FLOW-5 class runs F06's queue to idle first.
27. Applied: T09 deps add T11 (card and slices).
28. Applied: T09 passes only the mismatched cells to `checkAgainstApproval`; IFirm.ContactPartner case added.
29. Applied: T09 Clauses add TB-11 and SEC-2 (card and slices).
30. Applied: T09 void classes run F06's queue to idle first.
31. Applied: T13 carded (Lead decision 2); T10 deps add T13 and W29 (card and slices); T09 and T10 "Not in this card" now name T13.
32. Applied: T10 closed guard refuses insert, update and delete (spec and build).
33. Applied: T10 exempts `returns.jobs` (runner bookkeeping) and `returns.differences` (learning written after close; chosen over making N cards write before close: smaller, and learning never races the freeze). N01's slice note added. Amber for the Lead to log.
34. Applied: T10 Clauses add SEC-2 and AI-7 (card and slices).
35. Applied: T11 deps add A05, E00, W20, G01 (card and slices).
36. Applied: T11 retention reads F02's state event into `filed`; Read drops `plan/cards/T09.md`.
37. Applied: T08 deps add X00 (card and slices); `approve` carries and stores risk judgments and refuses unjudged `awaiting_cpa` exceptions; acceptance 13. The A421 Lead note stays at the top.
38. Applied: T08 `sections.ts` adds `not_yet_placed`, marked only when the review names a form there; acceptance 13 covers it.
39. Applied: X01 `queueOrder` folds in the A433 note (longest waiting via `waitingSince`, then id; overdue meaning); acceptance 8; the A433 Lead note line removed as folded in.

## RED 1 (settled by the Lead: decision 0020 Z20-6 and A387)
Applied: V02 and V03 show the Review tab to every role V00's `canSee` allows; the assigned preparer sees it read-only (no mark, judge, approve or comment control); opens logged (SEC-3, added to V02's Clauses). SEC-2 classes are written from V00's table (CPA and owner see all; assigned preparer read-only; preparer B and ops in review get "not found"). "CPA and owner only" and "a preparer gets not found" removed. V04 now keeps a round's comments visible only to the CPA and the owner until `sendForRework`, with a SEC-2 case (V02 and V03 cannot test it: V04 comes after them). V00 unchanged. V15 (the CPA queue page, not a record tab) stays CPA and owner only.

## Gaps with no owner
- T13 carded: "Notice of assessment: compare with the filed return and the move from filed to assessed". Registers `filed_to_assessed`; follow-up items closed by the CPA or owner (`accepted`, `amend`, `objection`); T10's freeze waits while one is open (T10 edited to match). Slices: carded, after T12. Phase 4, not 3: it depends on T09 (phase 4), and T10 and N00's note ("the phase 4 card that reads notices") are phase 4. Lead to confirm.
- T14 carded (the second gap, FLOW-8's amended return): a new return in `prepare` linked to the original, facts carried as proposed, new T183CORP through T11. Phase 4, slices carded after T13.

## For the Lead
- Amber rows to log: C2, fix 9, fix 23, fix 33, T13's follow-up outcomes and T10's wait, T14's design (new linked return, facts carried as proposed).
- SC10 R89's starting list: no card owns `intake_to_evidence`, `evidence_to_gaps` or `qa_to_build`; G00 moves gaps to qa and gaps to build but its card registers no guard.
- J6 (the phase 4 journey) does not list T13 or T14 in its deps.
