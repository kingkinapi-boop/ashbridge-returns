# Draft cards: D11, V10, V11, N01, N20, GL1 (3 Oct 2026)

Drafted by a helper for the Lead from each card's `plan/slices.json` entry, blueprint 00, 02, 06, 07, 08, 09 and 10, `plan/PHASES.md` (all six are phase 4: "Learning list and sign-off"), `design/map/screens.md` and `navigation.md`, the neighbouring cards (V15, T09, T10, T11, T13, T14, N00, X00, I00, I40, A04, A05, A06, A08, B04, FX2, FX13, SC3, SC5, SC11) and the reports named in GL1's note (A06-findings, A06-security-review, FX2-security, A04-findings; ambers A352, A404, A435, A441). Decisions read: 0002, 0008, 0010, 0020 (and the titles of all 26). Status of all six stays `todo` until the Lead accepts them.

## For the Lead: slices.json changes (amber, each reversible by reverting the entry)

| Card | Size | Deps (changes in bold) | Paths added | Status |
|---|---|---|---|---|
| D11 | S | D02, D03, D04, D05, D07, D08, D09, D10, D12, **D13** | none | **parked** (design lane, A352) |
| V10 | M | V00, T09, T11, E19, D09, U02, **T13, T14, E00, N01** | `src/modules/ops/**`, `src/modules/access/assign.ts`, `e2e/staff/ops.spec.ts` | todo |
| V11 | M | V00, N20, D10, U02 | `src/modules/board/**`, `e2e/staff/board.spec.ts` | todo |
| N01 | **L** | N00, **X00, I00** | `src/contracts/learning.ts`, `src/modules/learning/causes/_core/**`, `src/modules/learning/index.ts`, `db/schema/91_differences.sql`, `data/learning/earliest-stage.json`, `src/pipeline/handlers.ts` (90_learning.sql is not edited: see choice N01-2) | todo |
| N20 | **L** | N10 to N18, **I30, I40** | `src/modules/learning/measures/**`, `db/schema/92_lessons.sql`, `data/learning/ranking.json`, `data/learning/lesson-templates/**`, `tools/lessons.mjs`, `src/pipeline/handlers.ts` | todo |
| GL1 | **L** | A01, A02, A04, A05, A06, **A08, B04** | `src/core/env.ts`, `src/core/golive.ts`, `src/core/engines.ts`, `src/instrumentation.ts`, `src/modules/auth/**`, `src/modules/ai/runner/**`, `src/modules/ai/project/**`, `src/modules/ocr/index.ts`, `src/modules/storage/**`, `src/modules/qbo/**`, `data/live/**`, `tools/golive-check.mjs` | todo |

Clauses to add to slices: D11 + RV-50, RV-52, RV-54, RV-55; V10 + FLOW-2, FLOW-7, SEC-2, RV-50, LL-6; V11 + FLOW-7, SEC-2, RV-50, LL-7, LL-8; N01 + LL-1, LL-2, LL-4, SEC-7, ARC-13; N20 + LL-5, LL-6, ARC-13, SEC-11; GL1 + SEC-1, SEC-10, SEC-11, LIVE-5, AI-7.

New card gap found (amber, Lead writes it): **N19 "AI cause proposal, unconfirmed"** (LL-4's last sentence: "AI proposes a cause only when no rule applies, marked unconfirmed"). No card owns it. N01 stores "no rule applied" so N19 can fill it later; N20 ranks such groups under "cause not confirmed". Suggested deps: N01, I00, A04, I40.

---

# D11 Design review pack for Zo: one look at every screen

Phase 4. Size S. Deps: D02, D03, D04, D05, D07, D08, D09, D10, D12, D13. Where: design lane (a designer and Zo's sitting; never a queue spec or build, A352).
Tags: screens.
Paths: design/review/**
Clauses: RV-53, RV-50, RV-52, RV-54, RV-55
Read: blueprint 06 (RV-50 to RV-55), `plan/cards/families/design.md` (acceptance checks 1 to 9 apply here too), `decisions/0020-zo-design-sitting-1.md` (Z20-1 to Z20-8), `design/map/screens.md` and `design/map/navigation.md` (every screen, role and link), `.claude/rules/staff-screens.md` (rules 4, 7, 14, 16, 18, 21, 23), `design/basis/parts.md`, each design card's approved pages in `design/screens/<family>/` and its `notes.md`, `reports/design-retest-2026-10-01.md`.
Spec commit: (none: design lane; the designer's verify script is the test)

## When it starts
When every dep's approved pages are in `design/screens/<family>/` (the Lead marks each design card done on Zo's approval). If a dep is still open, the pack is not started; it is never assembled from unapproved prototypes.

## Goal
One pack Zo can walk in one sitting that shows every staff screen as it will be built, in the order the work flows, so he sees the system as one service rather than ten families. The pack adds no design of its own: it gathers the approved pages, walks one made-up return from new to filed and on to the board, and lists every place where two families disagree. Disagreements become fix items on the owning design card, never edits in the pack.

## Spec
- Coverage (class rule): `design/review/verify.mjs` reads every row of `design/map/screens.md` and fails naming any screen with no page in the pack; it also fails on a pack page that names no map row. It asserts it read at least 30 rows and finds a named sentinel row, so an empty or misread map cannot pass.
- Source of truth: every pack page is the approved page from `design/screens/<family>/` (byte-identical copy or an iframe of it, recorded with the file's hash in `design/review/index.json`); verify fails on a hash that no longer matches the family folder, so a later design fix forces a pack refresh.
- The walk (RV-53): one made-up return from the test world (C01, "(Test)" in the name) followed through New returns, CRA data capture, the preparer queue, gap review, the round-trip checklist, cite, exceptions, the CPA queue, the brief, the full return, the three-pane view, comments and rework, approve, T183CORP, check export, filing confirmation, notice of assessment, and the board's three pages, in lifecycle order (blueprint 02). Each step names its screen, its role and the budget from that family's brief; the pack's index shows the measured clicks and page loads against each budget at both sizes of rule 18.
- Consistency across families (class rules, each a check in verify.mjs over every pack page): the same Generic header and logo (Z20-8, RV-55); the identity bar names corporation and year end on every return page (RV-50); one record shell with the same tab set and order for every role (rule 23, Z20-6); one status word and one colour per status everywhere (rule 7); the same date and money formats; service navigation per role exactly as `navigation.md` lists it. A difference is reported naming both pages and the owning design cards.
- Every page: axe clean (RV-54, rule 3, contrast "incomplete" counts as a failure until checked), keyboard Tab walk, 320 px reflow, no dead link, no `#` link, no placeholder, no em dash (rule 16); every link in the pack resolves to another pack page or the index.
- The findings list `design/review/findings.md`: one row per inconsistency or missed budget (pages, rule, owning card, proposed fix); empty when there is none. The Lead turns each row into a fix on the owning design card before the sitting.
- No client wording: the pack holds staff screens only; a lint finds no page from the client app.

## Build
- `design/review/index.html`: the walk, step by step, with links to each page, the role and the budget numbers; a second table by family.
- `design/review/pages/`: the gathered pages; `design/review/index.json`: page, map row, family, source path, hash.
- `design/review/verify.mjs` and `design/review/findings.md` as above; served over http for axe (design family check 8).

## Check
The Lead (design lane): verify.mjs green, findings.md empty or every row carded, axe and keyboard numbers in the designer's report. Then the to-do item for Zo's sitting (RV-53), which is the gate the Lead marks done on his answer.

## Not in this card
Changing any design (the owning D card). Building screens (V cards). The usability panel (the design flow before each family's sitting).

---

# V10 Ops screens: new returns, CRA capture, T183CORP, check export, filing, notice

Phase 4. Size M. Deps: V00, T09, T11, E19, D09, U02, T13, T14, E00, N01. Where: local for unit tests; cloud for the journeys (security: `/security-review` before boarding).
Tags: security (ops screens are never shown to a preparer; only ops, the CPA and the owner act; closing a follow-up and starting an amended return are the CPA's and the owner's only), screens.
Paths: src/app/(staff)/ops/**, src/modules/ops/**, src/modules/access/assign.ts, e2e/staff/ops.spec.ts
Clauses: RV-30, FLOW-8, FLOW-2, FLOW-7, SEC-2, LL-6, RV-50, RV-53, RV-54
Read: blueprint 06 (RV-30, RV-50 to RV-55), 02 (the evidence, approved, client_sign, ready_to_file and filed rows; FLOW-2, FLOW-7, FLOW-8, FLOW-12), 08 (SEC-1, SEC-2), 07 (LL-6), `design/map/screens.md` (Ops queue, New returns, CRA data capture, T183CORP, Check export upload, Filing confirmation, Notice of assessment) and `design/map/navigation.md` (the ops rows), `design/screens/ops/` (D09, the approved pages and budgets), `.claude/rules/staff-screens.md` (rules 6, 7, 8, 9, 16, 19, 21, 23), `decisions/0020-zo-design-sitting-1.md` (Z20-1: bulk assign on the list), `plan/cards/V00.md` (`visibleReturns`, the assignments table), `plan/cards/V15.md` (the same table pattern), `plan/cards/T09.md` (`checkBeforeTransmit`, `recordFiling`, the mismatch), `plan/cards/T11.md` (`recordT183Sent`, `receiveT183Certificate`), `plan/cards/T13.md` (`receiveNotice`, `closeFollowUp`, `openFollowUps`), `plan/cards/T14.md` (`startAmendedReturn`, `amendmentsOf`), `plan/cards/E00.md` (intake), E19's entry (the CRA capture reader), `plan/cards/N01.md` draft (`recordClientDispute`).
Spec commit: (spec-writer fills)

## When it starts
After D09 is approved by Zo at a design sitting (RV-53) and the Lead marks it done. D09's brief must hold three things this card builds that the screen map does not show yet (Lead adds them to D09's brief now): bulk assign on New returns (Z20-1), the follow-up item's close and "Start amended return" on Notice of assessment (shown to the CPA and the owner only), and "Record a client dispute" on T183CORP in `client_sign`. If D09's approved pages lack any of the three, the spec job releases the job and reports which.

## Goal
Ops works every return from arrival to the notice of assessment on its own screens: assign new returns to a preparer, capture CRA data where the firm has access, record the T183CORP and upload the signed certificate, upload the check export before transmit, enter the confirmation number, and save the notice of assessment. Each page calls the service card that owns the rule (T09, T11, T13, T14, E00, E19); this card adds no business rule of its own except who may assign.

## Spec
- Fixtures (test world, pinned clock): returns in `intake`, `evidence` (one with CRA access, one without), `approved`, `client_sign`, `ready_to_file` (one whose check export matches, one that mismatches by one cell), `filed`, and `assessed` with an open follow-up item; one past its filing due date; one 28 Feb year end; returns in preparer and CPA states (never listed); users: two ops, the CPA, the owner, two preparers, an AI actor.
- Classes:
  - SEC-2 (every ops address, class rule over the route table, not a list): ops, the CPA and the owner reach every `/ops` page; a preparer gets the same "not found" as an address that does not exist, on every `/ops` route and every server action, and the ops data functions return nothing for a preparer. The sweep asserts it found at least seven routes and a named sentinel route.
  - FLOW-2 (the ops queue lists by state): the Ops queue lists exactly the returns in `approved`, `client_sign`, `ready_to_file` and `filed`; New returns lists exactly `intake` and `evidence`; property (fast-check, fixed seed): for any set of returns in random states, each list equals the set in its states.
  - FLOW-7 with FLOW-12: every row shows the filing due date and the balance-due date as F02 computes them (28 Feb year end due 31 Aug); overdue says so in words and a non-colour cue (rule 7). Default order: overdue first, then filing due date, then lifecycle order of the state, then id, unless D09's approved page states another order (then that one); the caption states the order and `aria-sort` is set (rule 6).
  - Assign (Z20-1): bulk assign sets one preparer on every selected return in one transaction, as rows in V00's assignments table with an event each (who, when, from, to); assigning by ops, the CPA or the owner works; a preparer or an AI actor is refused and nothing is stored (AI-7); assigning a user without the preparer role is refused naming the user. After assigning, the preparer's `visibleReturns` holds exactly those returns more (V00's property still holds).
  - RV-30 CRA data capture: a return with CRA access shows the fixed checklist and the upload; the uploaded PDF goes through E00's intake and E19's reader, and the page lists the facts read with their sources; a return without access says so in words and offers no upload (rule 8: the action is absent, never disabled).
  - RV-30 T183CORP: "Record sent" calls `recordT183Sent` and the certificate upload calls `receiveT183Certificate`; each of T11's refusals (wrong corporation, not a PDF, wrong state, no sent record) shows in the GOV.UK error pattern (rule 9) with T11's reason; the flag "certificate not checked" shows for a person.
  - LL-6 client dispute: in `client_sign`, "Record a client dispute" takes one or more of the six summary items (or "other") and a non-blank reason and calls N01's `recordClientDispute`; it never changes state or the approval; a preparer or AI actor is refused.
  - RV-30 check export (RT-19): the upload calls `checkBeforeTransmit`; a match shows the passed check; a mismatch shows an interruption panel listing every changed cell with before and after, and says the approval was voided and the return went back to trace (FLOW-5).
  - RV-30 filing: the confirmation number form calls `recordFiling`; a blank number is refused at the field; before a passed check the form is absent and the page says what is left, with a link to the check export page.
  - RV-30, FLOW-8 notice: the upload calls `receiveNotice`; the page shows T13's compare (filed and assessed values per line, differences in cents); when they differ the follow-up item shows. "Close follow-up" (outcome and reason) and "Start amended return" are present only for the CPA and the owner, and call `closeFollowUp` and `startAmendedReturn`; for ops they are absent and the page says the CPA closes it. The amended return's link shows both ways (`amendmentsOf`).
  - RV-50, rule 16, rule 23: every return page sits in the one record shell with the identity bar naming corporation and year end; every control leads to a built page or action; no placeholder, no dead control.
  - Rule 19, rule 21: forms of three fields or fewer run in place; search by corporation name and a state filter narrow both lists; Back keeps search, filter, sort and scroll.
  - RV-53: each page matches D09's approved page within the visual threshold, and D09's budgets hold ("assign five new returns", "upload a certificate", "enter a confirmation number").
  - RV-54: U02's sweeps pass on every page in empty, normal, error and flagged states; every task works by keyboard alone; golden ARIA snapshots of the Ops queue and New returns for the fixture set (`e2e/staff/__golden__/`).

## Build
- `src/modules/ops/`: `opsQueue(user, view, deps)` and `newReturns(user, deps)` (rows from V00's `visibleReturns`, F02's due dates and overdue flag, sorted as above; reads only); `// @mutate` on the sort and the overdue pick (mutation 100, ARC-15).
- `src/modules/access/assign.ts`: `assignReturns(returnIds, preparerId, actor, deps)` writing V00's assignment rows and events in one transaction; actor and role checks as above.
- `src/app/(staff)/ops/`: the seven pages of the screen map at their addresses, built to D09's approved pages with U00's components; each form posts to a server action that calls the owning service through its contract (T09, T11, T13, T14, E00, E19, N01) and shows its refusal in the GOV.UK error pattern. Shortcuts through U01: next row, open, search.
- `e2e/staff/ops.spec.ts`: one journey per page on the production build (ARC-21).

## Check
By a third worker: acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, the cloud journeys on the production build, axe clean in every state, `/security-review` clean, scope clean.

## Not in this card
Any rule the services own (T09, T11, T13, T14, E19). Sending the T183CORP (ops, in CCH Digital Signature) and transmitting (ops, in Taxprep, OUT-3). The CPA queue (V15). The board (V11). Client wording.

---

# V11 Owner board: pipeline, weekly lessons, measures

Phase 4. Size M. Deps: V00, N20, D10, U02. Where: local for unit tests; cloud for the journeys (security: `/security-review` before boarding).
Tags: security (the board is shown only to the owner and the CPA; preparers and ops get "not found"; marking a lesson fixed is a person's act, never AI), screens.
Paths: src/app/(staff)/board/**, src/modules/board/**, e2e/staff/board.spec.ts
Clauses: RV-40, LL-9, LL-7, LL-8, FLOW-7, SEC-2, RV-50, RV-53, RV-54
Read: blueprint 06 (RV-40, RV-50 to RV-55), 07 (LL-5 to LL-9), 02 (states in order, FLOW-7, FLOW-12), 08 (SEC-2), `design/map/screens.md` (Pipeline, Weekly lessons, Measures: roles cpa and owner) and `navigation.md` (the owner's and the CPA's Board rows), `design/screens/board/` (D10, the approved pages and budgets), `.claude/rules/staff-screens.md` (rules 5, 6, 7, 8, 16, 21, and "any chart comes with its table"), `plan/cards/N20.md` draft (`weeklyList`, `lessonDetail`, `markLessonFixed`, `measures`), `plan/cards/V15.md` (the table pattern), `plan/cards/I40.md` (the score shape: basis points, "no cases").
Spec commit: (spec-writer fills)

## When it starts
After D10 is approved by Zo at a design sitting (RV-53). D10's brief must hold "Mark fixed" on a lesson (owner and CPA, with the card id) and the measures' period filter; the Lead adds both now. If D10's approved pages lack them, the spec job releases the job and reports it.

## Goal
The owner sees the whole firm on three pages: every return by state and due date, this week's lesson list with why each item ranks where it does, and the measures that say whether the system is getting better. Every number on the board comes from N20 or F02; the board computes nothing of its own beyond grouping and display.

## Spec
- Fixtures (test world, pinned clock on a Tuesday): returns in every state of blueprint 02, two overdue, one 28 Feb year end; N20 outputs from its fixtures: a weekly list of ten lessons including one caught by CRA, one caught by a client, one recurred after a fix, one with an unconfirmed cause and one with conflicting causes; measures for 4, 13 and 52 weeks including one measure with no cases; users: the owner, the CPA, ops, a preparer, an AI actor.
- Classes:
  - SEC-2 (class rule over the route table): the owner and the CPA reach every `/board` page; ops and a preparer get the same "not found" as an address that does not exist on every `/board` route and action; the board's data functions return nothing for them. The sweep asserts it found at least three routes and a named sentinel.
  - RV-40 pipeline: every return appears exactly once, under its current state, with states in lifecycle order; property (fast-check, fixed seed): for any set of returns, the count per state equals the count in F02, and the sum equals the number of returns. Within a state, due-date bands (overdue, due in 14 days, due in 30 days, later, unless D10's approved page sets others) with counts; each count links to the list of those returns.
  - FLOW-7: every return row shows both due dates as F02 computes them; overdue in words and a non-colour cue (rule 7).
  - RV-40, LL-7, LL-8 weekly lessons: the table shows exactly N20's `weeklyList` for the current week (Monday, Toronto time) in N20's order, each row with rank, cause in words, figure or signal, count, tax effect in dollars, caught at, and tags for "caught by CRA", "caught by a client", "recurred after fix", "cause not confirmed" and "causes conflict" (words plus a non-colour cue). A week with no list yet says so in words. A "Why this rank" detail shows N20's score parts.
  - Lesson detail: N20's `lessonDetail` (signature, the draft card text, the test file name, and the differences as links to their returns); every return link passes V00's `canSee`.
  - Mark fixed: the owner or the CPA records a fix with a non-blank card id through N20's `markLessonFixed`; ops, a preparer or an AI actor is refused (AI-7) and nothing is stored; a fixed lesson shows "fixed" with the card id and date, and one that recurred shows "recurred after fix" at the top (N20's order).
  - LL-9 measures: the seven measures of LL-9, each with its definition in words, hits, cases and the score as a percentage with one decimal, from N20's `measures` for the chosen period (4, 13 or 52 weeks; default 13); "no cases" shows as words, never 0 or blank. A chart, if D10 has one, comes with its table first.
  - Rule 5, rule 6: money in numeric cells with tabular figures; tables over five rows are MOJ sortable with the default order in the caption.
  - RV-50, rule 16: no placeholder, no dead control; every count and every row links to a built page.
  - RV-53: each page matches D10's approved page within the visual threshold; D10's budgets hold.
  - RV-54: U02's sweeps pass on all three pages in empty and normal states; keyboard alone; golden ARIA snapshots of the three pages for the fixture set.

## Build
- `src/modules/board/`: `pipeline(user, deps)` (counts and rows by state and band from V00's `visibleReturns` and F02; reads only; `// @mutate` on the band pick, mutation 100), `lessons(user, week, deps)` and `measuresFor(user, period, deps)` (pass-through to N20's contracts with the access check).
- `src/app/(staff)/board/`: Pipeline (`/board`), Weekly lessons (`/board/lessons`, with the lesson detail and "Mark fixed" in place, rule 19) and Measures (`/board/measures`), built to D10's approved pages with U00's components.
- `e2e/staff/board.spec.ts`: one journey per page on the production build.

## Check
By a third worker: acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` file, the cloud journeys on the production build, axe clean in empty and normal states, `/security-review` clean, scope clean.

## Not in this card
Ranking, the weekly list, lesson cards and the measures themselves (N20). Differences and causes (N01, N10 to N18). The CPA queue (V15). The ops queue (V10).

---

# N01 Differences by natural key, where they were caught, and what else is captured

Phase 4. Size L. Deps: N00, X00, I00. Where: cloud (core: spec read and check by Opus).
Tags: core (money: each difference's amount in integer cents), security (differences are insert-only; after a return closes, only `returns.differences` takes rows, and no other table this card adds carries a return id).
Paths: src/modules/learning/diffs/**, src/modules/learning/causes/_core/**, src/modules/learning/index.ts, src/contracts/learning.ts, db/schema/91_differences.sql, data/learning/earliest-stage.json, src/pipeline/handlers.ts
Clauses: LL-3, LL-5, LL-6, LL-1, LL-2, LL-4, SEC-7, ARC-13
Read: blueprint 07 (LL-1 to LL-9), 00 (END-5), 02 (FLOW-5, FLOW-9, the review and rework rows), 05 (AI-4, EX-1), 08 (SEC-7), 09 (ARC-10, ARC-13, ARC-15); `plan/cards/N00.md` (`saveVersion`, `cellsByKey`, owners, version kinds), `db/schema/90_learning.sql` (`returns.differences` as F01 made it), `plan/cards/T10.md` (line 20: `returns.differences` is the learning table exempt from the closed-return guard), `plan/cards/T13.md` (the `assessed` version), `plan/cards/X00.md` (answers on flags), `plan/cards/I00.md` (dropped citations and the per-step counter), `plan/cards/families/cause.md` (what the cause rules need from this card), `reports/phase3-card-review-2026-10-03b.md` (fix 33).
Spec commit: (spec-writer fills)

## Goal
Every difference between two of a return's versions is found by figure key and natural row key (never by copy number), stored once with its owner, its amount and where it was caught, and handed to the cause rules (N10 to N18) through one contract. The other things LL-6 names (flags the preparer dismissed, client disputes at approval, questions whose answers changed nothing, AI citations that failed) are captured in the same table. Nobody logs anything (END-5).

## Spec
- Fixtures (simulator, test world, pinned clock): C01 through the versions N00 saves: `ai-raw-facts`, `ai-draft`, a first `preparer` version, a review that sends it to rework, a second `preparer` version, `cpa-final`, `check` and `assessed` (from T13's one-cent Part I tax notice); a second lock export after S01's reordered copies; a flag answered `explained` and one `fixed` (X00); a dropped citation (I00); a question sent and answered with the fact unchanged, and one that changed its fact; a client dispute; C01 taken to `closed` (T10).
- Classes:
  - LL-3: the version chain is ordered by save time (ai-draft, each preparer, cpa-final, check, assessed); each version is compared with the one before it in the chain through N00's `cellsByKey`; a difference is `changed` (both sides, values differ), `added` or `removed`. Reordered copies (S01) give no difference. Property (fast-check, fixed seed): for any two cell sets and any permutation of copy numbers, the differences found equal those of the unpermuted sets.
  - Facts: `ai-raw-facts` is compared with each fact's value at the `cpa-final` approval (N00's history), by fact key, giving `fact` differences that carry the document type (for LL-9's extraction accuracy by document type).
  - LL-2: each cell difference carries the owner of its before cell; `counts_against_ai` is true exactly when that owner is `ai-filled`.
  - ARC-13 amount: when both values parse as money, `amount_cents` is after minus before in integer cents through the money helpers; otherwise null. Property (fixed seed): for any two money values the amount equals their difference exactly.
  - LL-5 caught at: from the version pair: ai-draft to preparer is `preparer`; preparer to preparer with a move review to rework between them is `cpa`, without one is `preparer`; preparer to cpa-final is `cpa`; cpa-final to check is `check`; check (or cpa-final when no check exists) to assessed is `cra`; a client dispute is `client`. Stages are ordered draft, preparer, cpa, client, check, cra. `earliestStage(cause, evidence)` reads `data/learning/earliest-stage.json` (cause to stage; late information takes the stage in force when the late document or answer arrived, from F02's state events); an escape is a difference caught later than its earliest stage.
  - LL-6 captured, each as a `signal` row naming its source by id only: a flag the preparer answered `explained` or `accepted_risk` (X00; a `fixed` answer is not a dismissal); a client dispute through `recordClientDispute(returnId, items, reason, actor)` (ops, the CPA or the owner; AI and preparers refused, AI-7); a question whose answer left its fact's value unchanged; each citation I00 dropped (step, job id, reason).
  - Once (class rule, SC3 R64 shape): comparing the same version pair twice, or eight times in parallel, stores one set of differences (a unique index on version pair and key, not a JavaScript check); capturing the same signal source twice stores one row.
  - Cause contract (for N10 to N18): `CauseRule` is `{ cause, judge(difference, evidence) -> 'yes' | 'no' | 'cannot tell' }`; causes exactly the nine of LL-4 (`late-information`, `reading`, `classification`, `mapping`, `client-data`, `question-design`, `judgment`, `tax-knowledge`, `missing-check`); `causeEvidence(differenceId, deps)` gathers the trail (events, document and answer arrival times, the extracted fact with its box words, the mapping row used, the judgment input, the checks that ran on the figure) through ports passed in. `assignCause(differenceId, rules, deps)`: exactly one yes stores that cause, confirmed by code, with its earliest stage; no yes stores `none yet` (for N19's AI proposal, unconfirmed); two or more yes stores every yes cause with `needs a person`, never picking one. A planted rule that answers yes to everything makes every planted difference `needs a person`, never a silent pick.
  - LL-4 class rule: late information is never counted against the AI or the preparer: a difference with cause `late-information` has `counts_against_ai` false whatever its owner.
  - SEC-7, FLOW-9: `returns.differences` takes inserts only (UPDATE, DELETE and TRUNCATE refused, db test on PGlite and Postgres 16); after C01 closes, a difference for C01 can still be inserted and an insert into any other table this card adds that names C01 is impossible because none has a `return_id` column (catalog scan, with T10's closed-guard sweep still green).
  - Pipeline: a saved version, an X00 answer on a flag, an I00 drop and an answered question each enqueue one diff or capture job (F06, idempotent by source id); the job is retried and never duplicates rows.
- Golden file (`src/modules/learning/diffs/__golden__/`): C01's differences across the whole chain, with owners, amounts and caught-at stages.

## Build
- `src/contracts/learning.ts` (zod, strict): the difference row (kind `cell`, `fact` or `signal`; version pair; figure key and natural row key; change; owner; `counts_against_ai`; `amount_cents`; caught at; signal type and source id; document type), the cause row, `CauseRule`, `CauseEvidence`, the stage list and the service interface.
- `src/modules/learning/diffs/`: `compareVersions(returnId, fromVersionId, toVersionId, deps)`, `compareRawFacts(returnId, deps)`, `captureSignal(kind, sourceId, deps)`, `recordClientDispute(...)`; `// @mutate` on the compare, the amount and the caught-at pick (mutation 100, ARC-15).
- `src/modules/learning/causes/_core/`: `CauseRule` registry (one entry per cause folder, N10 to N18 add theirs), `causeEvidence`, `assignCause`, `earliestStage`; `// @mutate` on `assignCause` and `earliestStage`.
- `data/learning/earliest-stage.json`: cause to earliest stage with a reason per row (start: reading, classification, mapping and question-design `draft`; client-data and judgment `preparer`; tax-knowledge `cpa`; missing-check `check`; late-information is computed from the arrival time instead; each row's stage is the first stage whose work could have seen it; changed only by an amber row).
- `db/schema/91_differences.sql`: new columns on `returns.differences` (added here, not by editing F01's 90), `returns.difference_causes` (difference id, cause, confirmed by `code` or `ai` or `none`, earliest stage, `needs a person`; no `return_id`), both insert-only with F01's `refuse_change` triggers, row-level security on, no policies, `is_test`, CHECK lists on kind, change, stage, cause and signal type, the unique indexes above.
- `src/pipeline/handlers.ts`: the four job triggers above.

## Check
By a third worker (Opus read): acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, the db tests on PGlite and Postgres 16, T10's closed-guard sweep green with this card's tables, scope clean.

## Not in this card
The nine cause rules (N10 to N18). The AI cause proposal (N19, to be carded). Ranking, the weekly list, lesson cards and measures (N20). The screens (V10's dispute form, V11). Saving versions (N00, T08, T09, T13).

---

# N20 Ranking, the weekly lesson list, lesson cards and measures

Phase 4. Size L. Deps: N10, N11, N12, N13, N14, N15, N16, N17, N18, I30, I40. Where: cloud (core: spec read and check by Opus).
Tags: core (money: tax effects and scores in integer cents, property-tested), security (lesson cards and their tests carry structure only, never a value, name or identifier from a return, so nothing from a real return reaches the build at go-live; marking a lesson fixed is a person's act).
Paths: src/modules/learning/ranking/**, src/modules/learning/measures/**, db/schema/92_lessons.sql, data/learning/ranking.json, data/learning/lesson-templates/**, tools/lessons.mjs, src/pipeline/handlers.ts
Clauses: LL-7, LL-8, LL-9, END-5, LL-5, LL-6, ARC-13, SEC-11
Read: blueprint 07 (all), 00 (END-5), 05 (AI-3, AI-4), 09 (ARC-5, ARC-10, ARC-13, ARC-15, ARC-16), 08 (SEC-11), decision 0008 (the Auto-fill test keeps structure only, never values: the same rule for lesson cards), decision 0010 (nothing on a timer for build runs), `plan/cards/N01.md` draft (differences, signals, causes, stages), `plan/cards/families/cause.md`, `plan/cards/I40.md` (the score shape), the I30 entry (red-team items), `plan/cards/T07.md` (review-line meaning keys), `plan/cards/F06.md` (jobs), `tools/claim.mjs` and `plan/slices.json` (the queue the lesson cards join).
Spec commit: (spec-writer fills)

## Goal
Every Monday the system ranks what went wrong, by how often times how much tax it moved, puts anything a client or CRA caught first, and writes the top ten as draft build cards, each with a failing test built from made-up data shaped like the case (LL-8). A lesson that was fixed and comes back reopens at the top. The measures of LL-9 are computed from the same records, so the owner can see whether the system is getting better.

## Spec
- Fixtures (pinned clock, fixed seeds): N01 differences and signals across at least eight test-world returns over 60 weeks: one signature on five returns with small effects, one on one return with a large effect, a zero-dollar signature (non-money cell), one caught by CRA, one by a client, an unconfirmed and a conflicting cause, a lesson marked fixed in week 50 that recurs in week 58, red-team items (I30) of which some match a later difference; flags raised and dismissed per check (Q00, X00).
- Classes:
  - Signature: differences group by cause, figure key (or signal type and source kind) and earliest stage; a group counts distinct returns.
  - ARC-13 tax effect: for one difference, `|amount_cents|` when its figure key is a tax line (`data/learning/ranking.json` lists the review-line meaning keys, from T07); otherwise `|amount_cents|` times the return's effective rate at CPA-final (federal plus Ontario tax over taxable income, capped at 1; when taxable income is zero, the fallback rate in the data file, with its source), rounded half away from zero to the cent; a non-money difference has effect 0. Property (fast-check, fixed seed): the effect is a non-negative integer, never above `|amount_cents|`, and equals a hand computation in rational arithmetic.
  - LL-7 score: per group over the window (52 weeks, data), the sum over its returns of the larger of that return's total effect and the zero-dollar weight (data, start $100, named the firm's own, changed by an amber row). Order: groups with "recurred after fix" first; then any group with a difference caught at `client` or `cra`; then score descending; then count; then signature text. Property: any shuffle of the input gives the same order.
  - LL-8 weekly list: `weeklyList(week, deps)` for the week starting Monday 00:00 Toronto time holds the top ten groups; written once per week by an idempotent job (a unique index on the week; eight parallel runs store one list) that the job worker enqueues when it finds the current week missing (no timer; decision 0010). A list never changes after it is written; next week's is a new list.
  - LL-8 lesson cards: each listed group gets one draft card (title, signature in words, count, effect, caught at and earliest stage, links to its differences by id) and one test file filled from the cause's template in `data/learning/lesson-templates/<cause>/`; the template builds its case only from the test world and the group's structure (figure key, cause, stage pair, kind of difference, amount band, sign). Class rule (SEC-11, decision 0008 pattern): with sentinels planted in a source return (a unique corporation name, a unique amount, a unique document id), no generated card or test contains any of them; the scan asserts it ran on all ten files.
  - `tools/lessons.mjs import <folder>`: adds each draft as a `todo` card with family `lesson` to `plan/slices.json` and `plan/cards/`, runs its test once, and keeps the test only when it fails; a test that passes or does not compile is dropped and the card says "spec job writes the case" (a flag for a person, never a silent pass). It never overwrites an existing card id.
  - Fixed and recurrence: `markLessonFixed(groupId, cardId, actor)` by the owner or the CPA stores a status event (who, when, card id, non-blank); an AI actor, ops or a preparer is refused (AI-7). A difference with the same signature on a return whose CPA-final version was saved after the fix marks the group "recurred after fix" and puts it first on the next list.
  - LL-9 measures, each in I40's shape (`floor(10000 * hits / cases)`, or "no cases"), for a period of 4, 13 or 52 weeks: AI draft match (ai-filled cells of `ai-draft` unchanged at `cpa-final` over all ai-filled cells); extraction accuracy by document type (raw facts unchanged at approval over raw facts, from N01's `fact` differences); preparer match (cells of the last `preparer` version unchanged at `cpa-final`); repeat rate after a fix (fixed groups that recurred over fixed groups); escape rate (caused differences caught after their earliest stage over caused differences); false alarms per check (flags dismissed over flags raised, by check id); red-team hit rate (I30 items that match a later difference on the same figure key over I30 items). Golden file of all seven on the fixtures, equal to hand counts.
  - SEC-7: list, card and status rows are insert-only (UPDATE, DELETE and TRUNCATE refused, PGlite and Postgres 16); no table this card adds has a `return_id` column (so the closed-return guard never blocks learning, T10).
- Golden files (`src/modules/learning/ranking/__golden__/`): the fixture week's list and its ten draft cards (structure only).

## Build
- `src/modules/learning/ranking/`: `taxEffect`, `score`, `rank`, `weeklyList`, `lessonDetail`, `markLessonFixed`, the card writer (to the file store, A05, under `lessons/<iso week>/`); `// @mutate` on `taxEffect`, `score` and `rank` (mutation 100, ARC-15).
- `src/modules/learning/measures/`: `measures(period, deps)` with the seven definitions above; `// @mutate`.
- `data/learning/ranking.json`: window, zero-dollar weight, tax-line meaning keys, fallback rate with its source; refused on load if any is missing.
- `data/learning/lesson-templates/`: one template per cause of LL-4 and one for each LL-6 signal type.
- `db/schema/92_lessons.sql`: weekly lists, list rows, lesson status events; insert-only with F01's triggers, row-level security on, no policies, `is_test`, unique week. F01's `returns.lessons` is left unused (its one `difference_id` cannot hold a group; GL2's migration draft may drop it).
- `tools/lessons.mjs` as above; `src/pipeline/handlers.ts`: the weekly job's enqueue.

## Check
By a third worker (Opus read): acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, the db tests on PGlite and Postgres 16, the sentinel scan green, `/security-review` clean, scope clean.

## Not in this card
Finding differences and causes (N01, N10 to N18, N19). The board pages (V11). Writing the build card's real spec (the spec job, as for every card). Moving lesson files off a live host (go-live; see RED 3).

---

# GL1 Live adapters, switched off, no keys; the go-live switch

Phase 4. Size L. Deps: A01, A02, A04, A05, A06, A08, B04. Where: cloud (Postgres 16 for the lock-out and pool tests; security: `/security-review` before boarding).
Tags: security (the one switch between made-up and real data; stand-ins refuse real data and live engines refuse until go-live; no key in the repo; staff sign-in), core (permissions).
Paths: src/modules/live/**, src/core/env.ts, src/core/golive.ts, src/core/engines.ts, src/instrumentation.ts, src/modules/auth/**, src/modules/ai/runner/**, src/modules/ai/project/**, src/modules/ocr/index.ts, src/modules/storage/**, src/modules/qbo/**, data/live/**, tools/golive-check.mjs
Clauses: ARC-6, END-8, LIVE-3, SEC-9, ARC-20, SEC-1, SEC-10, SEC-11, LIVE-5, AI-7
Read: blueprint 09 (ARC-6 and its adapter table, ARC-20, ARC-22), 10 (LIVE-3, LIVE-5, LIVE-9), 08 (SEC-1, SEC-9, SEC-10, SEC-11), 00 (END-8), `.claude/rules/code.md` (the pooled-connection rule, A441), `reports/A06-findings.md` (RC1, RC2, fix 5 and 6), `reports/A06-security-review.md` (the `is_test` default and READ COMMITTED notes), `reports/FX2-security.md` (NODE_ENV unset), `reports/A04-findings.md` (RC3: `GO_LIVE_ON` removed), `plan/cards/A01.md`, `A02.md`, `A04.md`, `A05.md`, `A06.md`, `A08.md`, `B04.md` (each engine switch and its live slot), `plan/cards/SC3.md` (R62, R63, R64, R65), `plan/cards/SC5.md` (R72, R88), `plan/cards/SC11.md` (R90 to R92), `src/core/env.ts`.
Spec commit: (spec-writer fills)

## Goal
One setting, `GO_LIVE`, is the only switch between the build (made-up data, free stand-ins) and go-live. While it is off (always, until Zo's yes), every live engine refuses and no key may be set. When a test turns it on, every stand-in refuses to start, every live engine needs its key and an approved vendor, and the host must say it is production. The live side of each adapter exists in code and is tested against a fake of its vendor (ARC-20), so nothing is first run at go-live. No vendor is chosen here (LIVE-3).

## Spec
- Fixtures: injected settings objects only (never `process.env` in a test); fakes of each vendor interface (Google Drive v3 read-only, B04's QBO fake API, A08's fake Claude program, a vendor-neutral OCR fake and file-store fake); made-up staff users; a PGlite and a Postgres 16 database; a key-shaped sentinel value for every key setting.
- The switch (class rules):
  - `GO_LIVE` is read only through `src/core/env.ts` (`off` or `on`; unset or blank is `off`; anything else is refused naming the setting, never the value) and only `isGoLive(settings)` in `src/core/golive.ts` reads it; a source scan of `src/` finds no other read of `GO_LIVE` and no boolean literal gate (R72), with a planted `const GO_LIVE_ON = false as boolean` sentinel that the scan catches.
  - Engine registry (ARC-6): `src/core/engines.ts` lists every engine of every adapter with its kind (`stand-in` or `live`), its key setting names and its vendor id. A scan of every `*_ENGINE` setting in env.ts (R62) and every engine name each adapter factory accepts finds each one registered; a planted unregistered engine fails the scan by name. Stand-ins: `testusers`, `textlayer`, `tesseract`, `recorded` (OCR and AI), `local` (files and Drive), `samples` and `sandbox` (QBO). Live: `live` for each, and AI's `project`.
  - Go-live off (END-8): every `live` engine refuses with its "off until go-live" reason, even with its keys set; if any registered key setting is set at all, the startup check refuses naming the setting (no key until go-live); stand-ins start as today.
  - Go-live on (SEC-11 made a real switch, A06 finding 6): every stand-in refuses to start naming the engine and "go-live is on", before any read or write; a live engine starts only with every key setting present (refusal names the missing one) and its vendor approved in `data/live/vendors.json` (SEC-9: a vendor whose data stays in Canada, or one Zo approved by decision id; the file ships with no vendor approved, so every live engine refuses until Zo's yes). Both directions tested for every adapter: off to on to off gives the same results as off (ARC-20).
  - NODE_ENV (FX2 security review, A435): with go-live on, the startup check reads the raw settings and refuses unless NODE_ENV is set explicitly to `production`; unset (which env.ts would default to `development`), blank, `development` and `test` are each refused naming NODE_ENV.
  - Messages (SEC-10, R88): no refusal, log line or thrown error from this card contains any setting's value; the key-shaped sentinel set on every key setting never appears in any output (scan of every message the tests produce).
- AI runner term (A04 removed `GO_LIVE_ON`; A04-findings fix 3): the `project` engine (A04) and the launcher (A08) take go-live from `isGoLive`; with go-live off a job for a return with `is_test = false` is refused with A04's reason and no inbox file is written; with go-live on and the vendor approved, the same job runs against the fake project; with go-live on and the vendor not approved, it is refused naming SEC-9. Both directions tested; the `recorded` engine refuses under go-live on.
- Live sign-in (LIVE-5, SEC-1; A06 security review):
  - The live engine is Returns' own per-person login with two-factor (A06's password and code rules, no outside vendor). `addLiveStaffUser(displayName, roles, actor)` inserts with `is_test = false` named explicitly (the column defaults to true); a source scan finds every insert in `src/modules/live/**` and `src/modules/auth/live/**` naming `is_test`, with a planted insert that omits it caught by name. Only the owner (or the go-live tool) adds users; an AI actor is refused (AI-7).
  - With go-live on, the live engine refuses to sign in any user whose row has `is_test = true`; the `testusers` engine still refuses a database holding any `is_test = false` row (R63).
  - Staff users are never deleted, only switched off (A06 finding 5): no delete exists; a switched-off user cannot sign in.
  - Lock-out on Postgres 16 under READ COMMITTED (A06 security review): eight parallel wrong passwords for one user give at most five "wrong password" events and the rest "locked"; the sign-in transaction sets READ COMMITTED itself, so a database whose default is REPEATABLE READ (set in the test) still holds the limit; a planted copy that drops the explicit level fails under that default. Same for eight parallel wrong codes (R65 shape).
- Live database pool (code.md, A441): `src/modules/live/db/` borrows each connection inside a transaction and sets only transaction-local state (`set local`, `set_config(..., true)`); a connection that carries session state at release (role, search path or any custom setting) is destroyed, never returned; a failed reset throws and destroys the connection, never swallowed. Planted faults: a session-level `set role` (caught at release), a reset that throws inside a `catch` that ignores it (the test fails naming it). SC11's R90 runs on this pool.
- Live sides against fakes (ARC-20): Drive (read-only list and download through Drive v3 against a local fake; the module has no write, update or delete call, by source scan); QBO (B04's `live` engine now follows the switch instead of refusing always, against B04's fake API, with B04's rate limits); OCR and file storage (a vendor-neutral port each, against a local fake; LIVE-3: no vendor client is written until a vendor is chosen at go-live).
- `tools/golive-check.mjs`: runs the startup check against the settings it is given and prints each check's name and pass or fail, never a value; it changes nothing. It is the command the go-live run uses (running it on a live host is a go-live step, LIVE-9).

## Build
- `src/core/env.ts`: `GO_LIVE` and each live key setting by name (schema only; values never printed). `src/core/golive.ts`: `isGoLive`, `startupCheck(rawSettings)`, `assertEngineAllowed(engine, settings)`. `src/core/engines.ts`: the registry. `src/instrumentation.ts`: calls `startupCheck` once at server start. `// @mutate` on golive.ts (mutation 100, ARC-15).
- Each adapter factory (auth, ocr, storage files and Drive, AI runner and launcher, QBO) calls `assertEngineAllowed` before it builds an engine; A06's, FX2's and A04's existing refusals stay and their tests stay green.
- `src/modules/live/`: `db/` (the pool), `drive/`, `ocr/` and `files/` (ports and fakes); `src/modules/auth/live/` replaces the refusing slot with the live engine above.
- `data/live/vendors.json` (strict, ships with no approved vendor; each future row names the vendor, the region and the decision id); `tools/golive-check.mjs`.

## Check
By a third worker (Opus read): acceptance tests unchanged since the spec commit, mutation 100 on golive.ts, the db tests on PGlite and Postgres 16 (lock-out and pool), A01, A02, A04, A05, A06, A08 and B04's tests unchanged and green, SC3 and SC5 rules green, `/security-review` clean, scope clean.

## Not in this card
Turning go-live on, adding real staff, connecting any real service or database (LIVE items, each Zo's yes). Choosing vendors and the OCR benchmark (LIVE-3, GL6). The live schema migration (GL2). Two-factor enrolment screens (a V card at go-live).

---

## Choices settled (amber; one AMBER.md row each when the Lead accepts)

1. **D11-1** D11 runs in the design lane (parked, A352), like D02 to D13; it gathers approved pages only and adds no design. Why: RV-53, A352. Reverse: set it to carded.
2. **D11-2** D13 (the shell) added to D11's deps: every screen sits in it (rule 23). Reverse: drop the dep.
3. **V10-1** Deps add T13 and T14 (the notice page and the amended-return link are V10's per those cards), E00 (the CRA PDF goes through intake) and N01 (the dispute form). Why: each card names V10 as its screen.
4. **V10-2** Bulk assign lives on New returns (Z20-1) and is done by ops, the CPA or the owner, written by `src/modules/access/assign.ts` into V00's table (V00 says assigning is V10's). Not a change to who sees what: SEC-2's preparer rule is unchanged; this is the act it already assumes. Reverse: move to V05.
5. **V10-3** Close follow-up and Start amended return sit on the Notice of assessment page, present only for the CPA and the owner (T13 and T14 actor rules; T14 left the CPA's control to "the screen card the Lead names"). Reverse: move them to the CPA's record tab.
6. **V10-4** Client disputes at approval (LL-6) are recorded by staff on the T183CORP page in `client_sign`; nothing comes from the client app. Why: no source exists in the bridge, and a client-app change would be red; the smaller reversible option. Reverse: drop the form and leave LL-6's disputes uncaptured.
7. **V10-5 and V11-1** D09's and D10's briefs gain the controls above (Lead edits the briefs before the designs); if the approved pages lack them the spec job releases.
8. **V11-2** The board is for the owner and the CPA, as the screen map already says (SEC-2: the CPA sees everything). Both may mark a lesson fixed (with a card id). Reverse: owner only.
9. **V11-3** Pipeline due-date bands default to overdue, 14 days, 30 days, later; measures default to 13 weeks with 4 and 52. D10's approved page wins.
10. **N01-1** N01 is L, not M: it carries the cause contract and runner the nine rule cards need, plus LL-6 capture. Reverse: split LL-6 capture into its own card.
11. **N01-2** New file `91_differences.sql` adds columns to `returns.differences` instead of editing F01's landed `90_learning.sql` (X00's pattern); the causes table has no `return_id`, so T10's closed guard does not block it and only `returns.differences` is exempt (T10 fix 33). Reverse: fold into 90.
12. **N01-3** Chain compare (each version with the one before it); raw facts compared with values at approval; caught-at by version pair; stage order draft, preparer, cpa, client, check, cra; earliest stage per cause as data.
13. **N01-4** Two or more rules saying yes store every cause with "needs a person", never a pick (a flag for a person rather than a silent pass). No rule saying yes stores "none yet" for the AI proposal.
14. **N01-5** A dismissed flag means an X00 answer of `explained` or `accepted_risk` on a flag; a `fixed` answer is not a dismissal.
15. **N01-6 / N19** New card N19 for LL-4's AI cause proposal (no card owns it).
16. **N20-1** N20 is L (ranking, list, cards, measures, tool). Deps add I30 (red-team items) and I40 (the score shape).
17. **N20-2** Tax effect: the amount itself on tax lines; otherwise amount times the return's effective rate at CPA-final (federal plus Ontario tax over taxable income, capped at 1), with a sourced fallback rate when taxable income is zero; rounding half away from zero. Ranking only, never a filed number. Reverse: data change in ranking.json.
18. **N20-3** Score window 52 weeks, zero-dollar weight $100, order: recurred after fix, then client or CRA caught, then score. All data except the order (blueprint LL-7, LL-8).
19. **N20-4** The weekly list is an idempotent job keyed by the Monday (Toronto) week, enqueued by the job worker when missing; no timer (decision 0010's spirit; the go-live host's worker start is LIVE-9's question).
20. **N20-5** Lesson cards are files in the file store; `tools/lessons.mjs import` brings them into the queue as `todo` cards, keeps a generated test only if it fails, and otherwise marks the card "spec job writes the case". Generated cards and tests carry structure only (decision 0008's Auto-fill rule applied), proved by a sentinel scan.
21. **N20-6** F01's `returns.lessons` is left unused; new `92_lessons.sql` holds lists and status events.
22. **GL1-1** GL1 stays one card (every item of its note hangs on the one switch) at size L. Deps add A08 (the launcher's go-live term) and B04 (the QBO live engine) so the switch is read in one place. Paths widen to every adapter factory, env.ts (A04-findings RC3: a card that reads settings must hold env.ts) and the tool.
23. **GL1-2** The live sign-in is Returns' own per-person password and two-factor engine (A06's rules), no vendor: free, and the note says GL1 copies A06's lock-out "for real passwords". Reverse: a vendor adapter behind the same interface.
24. **GL1-3** SEC-9 enforced as data: `data/live/vendors.json` ships with no approved vendor, so every live engine, the Claude project included, refuses real returns until Zo approves a vendor row.
25. **GL1-4** With go-live off, any live key setting being set refuses startup (END-8 "no key"). OCR and storage live sides are vendor-neutral ports with fakes only; vendor clients wait for LIVE-3.
26. **GL1-5** The READ COMMITTED proof runs now, on Postgres 16 with made-up users, and the sign-in transaction sets its own isolation level; `tools/golive-check.mjs` is what the go-live run later re-runs.

## RED (not settled; each is a go-live question, so no to-do item now: recommend asking with the LIVE items)

1. **SEC-9 for AI (Claude).** The AI runs through a Claude project on the firm's subscription (decision 0008), but no decision approves client data leaving Canada for it. At go-live, real returns sent to the Claude project need Zo's vendor approval (decision 0002 item 4). Meanwhile: GL1 ships `vendors.json` empty, so the project refuses every real return; nothing is blocked before go-live.
2. **LIVE-3 vendors for OCR and file storage (and hosting).** Choosing them costs money and decides where data is kept. Meanwhile: GL1 builds vendor-neutral ports with fakes; GL6 benchmarks OCR on the test world.
3. **Lesson cards leaving a live host (LL-8).** At go-live the weekly cards are made inside the live system and must reach this repo's queue. Even with the structure-only rule and its sentinel scan, moving anything derived from real returns into the build is red (decision 0003). Meanwhile: N20 writes cards to the file store and `tools/lessons.mjs` imports from a folder; before go-live only made-up returns exist.
