# Phase 3 card review, 3 Oct 2026 (T08, Q00, Q01, I01, I30, I40)

Independent review before the first spec job (CLAUDE.md loop step 2; A390). Read only: cards, `plan/slices.json`, blueprint 02, 04, 05, 06, 07, 08, 09, `src/contracts/{checks,ai,lifecycle}.ts`, `src/modules/lifecycle/index.ts`, `db/schema/60_versions.sql`, `.dependency-cruiser.cjs`, dep cards, decisions 0008 to 0024.

Every cited clause ID exists and says what the cards claim. No card lets AI clear, close or approve, talk to clients or carry client wording. No clash with `decisions/` found (0023 Z23-2 is import-file rounding, separate from CK-50).

## Verdicts

| Card | Verdict | Fixes |
|---|---|---|
| T08 | FIX | 1 to 6 |
| Q00 | FIX | 7 to 13 |
| Q01 | FIX | 14, 15 |
| I01 | FIX | 16 to 19 |
| I30 | FIX | 20 to 26 |
| I40 | FIX | 27, 28 |

## Fixes

### T08
1. [verified] `plan/cards/T08.md` line 3 and `plan/slices.json` line 6061: deps lack V00, yet `approve.ts` (line 17) reads the role and the source log through V00's access contract (`src/contracts/access.ts`, built by V00, phase 1, carded). Add V00. Also add L00 by name (used directly for `acceptFacts`, `sourcesOf`; today only transitive through T04 and N00).
2. [verified] Line 17 "In one transaction ... F02's move ... L00's `acceptFacts` ... N00's `saveVersion`" cannot be built: F02's `createLifecycle` (done) opens its own `db.transaction` and takes no caller transaction (`src/modules/lifecycle/index.ts` lines 54 to 60); L00 line 25 and N00 line 16 say each write is its own transaction; T08's Paths hold none of these files. Change: add one line to the L00 and N00 card builds ("each write takes an optional caller transaction"), and a small FX card before T08 giving F02 a move inside a caller's transaction (dep of T08). Acceptance 10 stays.
3. [verified] Line 18: `checkAgainstApproval` has callers "T02, L00 version events, B06, T09", but T02 and L00 land before T08 and cannot call it, B06 and T09 are `todo` with no card, and F10 (line 24 of F10.md) says `src/pipeline/handlers.ts` is the only place wiring lives. Nothing would void an approval in the product. Add `src/pipeline/steps/approval-watch.ts` (or the hook in `src/pipeline/handlers.ts`) to Paths (line 5, slices line 6067) and acceptance 11: "FLOW-5 through the pipeline: accepting a changed lock export (T02) and saving a new fact version (L00) each void a standing approval with no direct call in the test."
4. [inferred] Line 14 "values as strings": the contract allows `value: string | null` (`src/contracts/lifecycle.ts` line 26). Add to acceptance 2: "class test: null, empty string, the text `null`, whitespace-only, and NFC against NFD forms of the same value give distinct hashes (or the card states one normalization); keys sort by code point, never by locale."
5. [verified] Line 17 refuses "a return not in `review` (FLOW-2)" but no acceptance check covers it. Add to acceptance 7: "approval of a return in each state other than `review` is refused naming the state; nothing is stored."
6. [inferred] Line 3 "Size M": five files, five new append-only tables, four mutation-100 files, cross-module transaction and wiring. Set Size L (slices `size`).

### Q00
7. [verified] Line 3 and slices line 6088: `run.ts` (line 16) and `taxEffect.ts` (line 17) read T07's review lines (`src/contracts/roundtrip.ts`, built by T07), but none of F05, L00, SK0, F10 depends on T07. Add dep T07.
8. [verified] Line 16 "loads ... stored AI results": `.dependency-cruiser.cjs` lets `src/modules/checks/` import only contracts, core and itself, so the engine cannot read the ai module's stored outputs. Change line 14: "a check may carry `loadInputs(returnId)`, supplied by its own module through the pipeline step; the engine reads no AI table." Line 16: drop "and stored AI results", add "or the check's own `loadInputs`".
9. [inferred] Line 16: add "In one run, code checks run before AI checks, and an AI check's `run` receives the flags code checks raised in that run (I01's AI-2 duplicate rule needs them). A stored AI job result for the return starts a new run (new rows), so AI checks do not stay at 'not checked'." Acceptance 11: both behaviours.
10. [inferred] Lines 17, 18 and acceptance 8 (line 31): flags carry an amount but no tax effect, so "red, then absolute tax effect, then amount" leaves a $10,000 flag against a $100 exception undefined. Change: "every item with an amount gets `estimateTaxEffect`, flags included; a tie fail's amount is left minus right (signed), sorting uses absolute values." Acceptance 8 adds a flag with a large amount and an exception with a small one.
11. [inferred] Line 17: the return's rate (tax over taxable income) is itself a fraction, so "one rounding" holds only if the rate rounding is stated. Add: "the return's rate is rounded to whole basis points half away from zero, then the effect is rounded once; a missing review line uses the firm default, named." Acceptance 7 covers both roundings.
12. [verified] Single examples where the rule is a class: acceptance 3 (line 26) becomes "property (fixed seed): for any two cent amounts the tie passes exactly when the absolute difference is under 100"; acceptance 1 (line 24) adds "id and source link blank as a class: empty, spaces, NBSP, zero-width"; acceptance 2 (line 25) adds "input absent, null and empty list each give `not_checked`".
13. [inferred] Line 3 "Size M": engine, registry, run, tax effect, order, schema, pipeline and stub removal with ten checks. Set Size L.

### Q01
14. [verified] Line 16 requires a source of "a document id and page", but acceptance 7 (line 27) feeds F05's `roundStatementToDollars` item, whose source is the text "rounding of statement lines to whole dollars" (`src/contracts/checks.ts` line 161), so it would always be refused. Change acceptance 7: "the caller sets the statement's document id and page on the R21 item `roundStatementToDollars` returns; it then passes `acceptItem` whenever its absolute amount is at most the limit."
15. [inferred] Acceptance 5 (line 25) becomes a property (fixed seed): "every R21 amount with absolute value at most the limit is accepted and every larger one refused, both signs"; state whether a zero-amount item is refused (smaller option: refused). Acceptance 3 (line 23) adds "R22 note blank as a class: empty, spaces, NBSP, zero-width".

### I01
16. [verified] Line 16 "exports the `ai:checklist` job handler for F10 to register": F10 lands first and its card makes `src/pipeline/handlers.ts` the only register; I01's Paths (line 5, slices line 6900) lack it, and no line says who queues the job. Add `src/pipeline/handlers.ts` to Paths; line 16 adds "the checks step queues one `ai:checklist` job per topic after trace, once per input hash"; acceptance 9 covers both.
17. [verified] Line 18 "Each topic card adds its check to the pipeline's list": I10's Paths are only `src/modules/ai/checklist/personal-expenses/**`, so topic cards cannot edit `checks.ts`. Change: "`_core/registry.ts` finds topics by folder (`src/modules/ai/checklist/<topic>/topic.ts`); `checks.ts` takes I01's list once; topic cards never edit pipeline files." Acceptance: a fixture topic folder is picked up with no pipeline edit.
18. [inferred] Line 17 amount: "a fact cited twice counts once"; acceptance 4 property includes duplicate citations and negative cents. Acceptance 2 adds "prompt version blank as a class (empty, spaces, NBSP, zero-width) and two ids equal after NFC are a duplicate".
19. [verified] Path pair I01 and I30 both hold `src/pipeline/steps/checks.ts` (and `handlers.ts` after fixes 16 and 22) with no dep between them. Add I01 to I30's deps (slices line 7209) so they land in order.

### I30
20. [verified] Line 16 and acceptance 6 (line 28) expect a "missing" item citing a page, but F04's `red_team_item` is `step({ concern })` with citations limited to ledger, document box and return cell, and no `findingType` (`src/contracts/ai.ts` lines 31, 64, 104). Change line 16: "AI-5: an item about something missing cites the return cell or document box where it should be; there is no separate missing type." Acceptance 6: "an item citing an existing return cell where a form should be is kept; a page citation is refused by the F04 schema and counted."
21. [verified] Line 18 `craLikely` is set by a person, but I30's Paths have no schema file and Q00's `flags` table has no such column. Add `db/schema/73_redteam.sql` (append-only answers, `refuse_change` triggers, row-level security) to Paths (line 5, slices line 7215); acceptance: UPDATE, DELETE, TRUNCATE refused (db test).
22. [verified] Line 19, same gap as fix 16: add `src/pipeline/handlers.ts` to Paths; "the checks step queues `ai:redteam` once the printed return is accepted (T07)"; acceptance covers both.
23. [inferred] Lines 17 and 18: the cited cell's value is the amount at issue, not the dollar effect AI-3 names, and the tier table says "with a tax effect". Label it "amount at issue (cited)", pass it through Q00's `estimateTaxEffect`, and make the flag red only when that tax effect is non-zero. Log as amber.
24. [inferred] Acceptance 7 (line 29) is true by construction with recorded answers. Replace with: "the planted copy's job differs from the clean copy's only inside the data envelope, and the job offers no tool that writes (AI-8)". Add acceptance 10: "AI-6: a recorded `cannot_tell` becomes a flag for a person with its reason, never a value."
25. [inferred] Acceptance 3 (line 25) tests only extraction. Make it a table over every drafting step type (extraction, finding, category_proposal, gifi_mapping_proposal, question_slot_fill), and treat model ids differing only in case or surrounding spaces as equal.
26. [inferred] Line 3 dep T05 (diagnostics) is used nowhere in Build or checks. State why on line 7 (for example "runs only once diagnostics clear") or remove it from line 3 and slices line 7209.

### I40
27. [verified] Lines 15 and 17: false alarms per check, citation failure rate and the "I can't tell" rate are worse when higher, but "any score below the baseline's blocks" lets a rise through and blocks an improvement. Change: "each measure declares its direction in `data/ai/evals/measures.json` (higher-better or lower-better); the gate blocks any measure worse than baseline in its direction." Add a property (fixed seed): the gate blocks exactly when some measure is worse in its direction.
28. [inferred] Line 17: say what happens when a measure reads "no cases": "a measure with cases in the baseline and 'no cases' now blocks; 'no cases' in both is equal." Add to acceptance 2.

## Path pairs with unlanded cards (no change needed beyond fix 19)

- Q00 with E01, M00, T01, T04 on `e2e/skeleton/stubs.ts`, `stubs.md`, `e2e/steps/skeleton-*.ts`: the shared stub pattern; `tools/claim.mjs` holds paths per job, so they run in turn.
- T08 and Q00 with FX3 (`db/schema/**`, phase 0): FX3 lands first; serialized by claims.
- I40 with GL5 (`src/modules/ai/evals/report/**`) and A04 (`data/ai/approved.json`): both ordered by deps.
