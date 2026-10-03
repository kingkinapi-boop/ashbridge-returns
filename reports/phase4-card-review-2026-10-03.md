# Phase 4 card review, 3 Oct 2026 (T09, T10, T11, T13, T14, B06, V10, V11, N01, N10 to N20, J6, D09 to D11, GL1 to GL6)

Independent review before the phase's first spec job (CLAUDE.md loop step 2). The reviewer wrote none of these cards. Read only: the 30 phase 4 entries of `plan/slices.json` (main at 7959729d; rechecked at 73a78186, no phase 4 card changed), the card files T09, T10, T11, T13, T14, B06, V10, V11, N01, N20, GL1, D11 and the families cause, journey and design, `plan/PHASES.md`, the cited blueprint clauses only (by id: END-4, 5, 7, 8, 9; FLOW-1, 2, 5, 7, 8, 9, 12; EV-1, 2, 8; TB-10, 11; RT-11, 19, 20; RV-2, 30, 40; LL-1 to LL-9; SEC-1, 2, 6 to 11; ARC-2, 6, 13, 20; LIVE-1 to LIVE-9; AI-7; OUT-3; the state table of 02), decision titles and 0012, 0020, 0023, AMBER A433 to A445, `reports/cards-D11-GL1-draft.md` (its 26 choices and 3 REDs), `reports/phase3-card-review-2026-10-03b.md` (the model), `reference/onboarding-contract.md` section 4, `reference/cpa-check.md` (CK-45), `design/map/screens.md` and `navigation.md` (ops and board rows), `src/modules/lifecycle/moves.ts`, `src/modules/bridge/run.ts` (return creation), `db/schema/50_returns.sql`, `55_bridge_returns.sql`. Dependency graph and path overlaps computed with a node one-liner over `plan/slices.json`, using the same overlap rule as `tools/lib.mjs`.

Every cited clause ID exists and says what the cards claim. The dependency graph is complete (no unknown id) and acyclic. No card lets AI clear, close or approve; no card holds client wording. With T09, T10, T11 and T13 every guard in `MOVES` has an owner, so SC10's R89 list can be empty at the gate. No card silently settles any of the draft's three REDs (GL1 ships `vendors.json` empty; GL1 builds vendor-neutral ports only; N20 writes lesson files to the store and leaves the move off a live host out). One new RED (amended return's summary in the client app).

## Verdicts

| Card | Verdict | Fixes |
|---|---|---|
| T13 | FIX | C2, 1 |
| T14 | FIX | 2 to 6 |
| B06 | FIX | C1 |
| T09 | OK | none |
| T10 | FIX | C1, 7, 8 |
| T11 | FIX | C1, C2, 9, 10 |
| V10 | FIX | C1, 4, 11, 12 |
| V11 | FIX | C1, 13 |
| N01 | FIX | C1, 14 to 17 |
| N10 to N18 (family cause) | FIX | 17 |
| N19 | FIX | C3 |
| N20 | FIX | 18 to 20 |
| J6 | FIX | 21 |
| GL1 | FIX | 22 |
| GL2 to GL6 | FIX | C1, C3 |
| D09, D10, D11 | OK | none (design lane, A352; briefs carry A444's controls) |

## Fixes

### Cross-cutting

C1. [verified] Tags in `plan/slices.json` and the card headers disagree, so `tools/next.mjs` and the check routing (Opus read, `/security-review` before boarding) will skip work the card text asks for.
- B06: slices has `security: true`, but line 3 and Check (line 38) omit the review. Line 3: "Where: local or cloud (core: spec read and check by Opus; security: `/security-review` before boarding)." Line 38 add "`/security-review` clean,".
- T10 line 3 and T11 line 3: add "core: spec read and check by Opus" (both are `core: true` in slices). T11 line 3 also "Hard." is absent while its rules (summary to the client, two guards) match T09's; leave `hard: false` but run it in the cloud: "Where: cloud".
- V10: slices add `security: true` and `core: true`. The card says security; `src/modules/access/assign.ts` writes V00's assignments, which decide what a preparer sees (permissions are core).
- V11: slices add `security: true` (the card's tags and Check already ask for the review).
- N01: slices add `security: true` (its tag line names the closed-return exemption and the AI-7 refusal on disputes); Check (line 38) add "`/security-review` clean,".
- GL3: `security: true` and `core: true` when carded (views and grants decide what this system reads of the client app's data). GL4: `core: true` (Taxprep CSV compare).

C2. [verified] Decision 0012 Z12-1: a new or changed tax rule goes on `reference/cpa-check.md` for Zo's CPA check. Two phase 4 data files are tax rules and are not on the list:
- T11's `data/clientsign/summary-lines.json` maps `federal_tax` to T07's `part1_tax` (T11 line 34). RV-2's "federal tax" and the six numbers go to the client. CK-45 in `cpa-check.md` already treats Part I and Part IV tax (less the dividend refund) as parts of total tax payable, so Part I alone understates federal tax for any CCPC with Part IV tax. Add a cpa-check item: "federal_tax on the approval summary is the total federal tax payable review line (Part I plus Part IV and other parts, less the dividend refund), not Part I alone"; T11 line 34 then reads "`federal_tax` to the meaning key the CPA check names (until then `part1_tax`, with a `cpa_check: pending` field on the row)". Same item covers V02's six numbers (V02 line 19).
- T13's `data/assessment/notice-lines.json` (T13 line 14: which notice line compares with which filed review line). Add a cpa-check item naming the mapping once W29's notice shape is fixed.
N20's effective rate (N20 line 17) ranks lessons and never reaches a return; it stays amber, no CPA check.

C3. [verified] Seven phase 4 cards have no card file: N19, GL2, GL3, GL4, GL5, GL6 (`todo`), and nothing owns LIVE-8 ("all thirteen kinds pass end to end against the live backends in test mode"; `node tools/matrix.mjs --plan` skips LIVE clauses, so nothing flags it). The Lead writes them before the phase's first spec job, with these lines from this review:
- N19: deps N01, I00, A04, I40; Paths `src/modules/learning/causes/_ai/**` and `data/ai/evals/sets/cause_proposal.json` (AI-11, as V13 fix 19); core true; writes only `confirmed_by = 'ai'` cause rows marked unconfirmed, never over a code cause (LL-4); citations checked by I00's code (AI-7).
- GL2: deps add T14 (83_amended.sql) so the draft sees every schema file; drop LIVE-9 from its clauses (LIVE-9 is the real-host walk; GL1's tool is that walk's command).
- GL3: draft only; never applied to the client repo by this build; the client repo's own Lead takes it at LIVE-6.
- GL4: deps add FX9 (NOW.md: no new Taxprep CSV on main before FX9 lands; GL4's `data/taxprep/proof/**` overlaps FX9's `reference/**/*.csv` rule); the kit uses the three made-up corporations LIVE-1 names, nothing else.
- GL6: deps add FX11 (Paths overlap `src/modules/ocr/**`); free engines only (`textlayer`, `tesseract`) on the test world; any paid vendor run is LIVE-3 (the draft's RED 2), never in this card.
- LIVE-8: one line on GL1's "Not in this card" ("LIVE-8: the go-live run reruns the J journeys with the live engines in test mode; JH0's harness takes the engine settings as input") and a new card GL7 at go-live, or an AMBER row saying the go-live run owns it. Recommended: the line plus an AMBER row.

C4. [verified] Path holds will serialise phase 4. `src/pipeline/handlers.ts` is held by T09, T10, T11, T13, B06, N01, N20 (and phase 3's T08, I01, I30, V13); `src/pipeline/deps.ts` by T09, T10, T11, T13 (and T12, V04, V09). `tools/next.mjs` never starts two overlapping cards, so this is safe, but it makes these the critical path. FX3 (phase 0, carded) holds `db/schema/**`, which overlaps every phase 4 schema file (77, 78, 79, 81, 82, 83, 91, 92, 99). Edits: land FX3 before the first phase 4 build, or narrow FX3's Paths to the schema files its fix list names (A-row). No card change for handlers.ts; the Lead orders builds by the graph (T11 and B06, then T09, then T13, then T10 and T14; N01 in the gaps).

C5. [verified] The draft's three go-live REDs live only in A444 and a draft report. Put each in the note of the card that meets it, so the cold sign-off and the go-live run see them: GL1 note "RED (go-live): SEC-9 for the Claude project; `vendors.json` stays empty until Zo's yes"; GL6 note "RED (go-live): LIVE-3 vendor choice and cost"; N20 note "RED (go-live): lesson cards leaving a live host (LL-8)". RED 1 below goes on T14's and T11's notes the same way.

C6. [inferred] `plan/PHASES.md` row 4 names learning, the approval summary, the check before transmit and the binder, but GL1 to GL6 are phase 4 and the gate's cold sign-off will read them. Row 4 "What gets built" add "; the go-live switch and drafts (GL1 to GL6), all off". Amber.

### T13
1. [verified] Line 25 "the scanned copy reaches the same facts through E18 or names what it could not read, and then no compare runs" has two outcomes, so it cannot fail. Replace with: "the scanned copy gives the same facts as the text copy through E18 with the pinned OCR stand-in; a planted unreadable copy names the fields not read, stores the notice, runs no compare, leaves the return in `filed` and shows 'notice not read' for a person (V10's flagged state)."

### T14
2. [verified] Line 16 asks for "one first state event", and line 28 has the spec job report if a first event with no `from` is refused. It will be: `returns.state_events.from_state` is `not null` with a CHECK list (`50_returns.sql`), and the bridge creates a return with no state event at all (`src/modules/bridge/run.ts` line 159, `intake`). Settle it now: line 16 replace "with one first state event (who, when, why ...)" with "with no state event, as the bridge creates a return (`run.ts` line 159); the link row is its creation record (who, when, why naming the follow-up item or the written reason)"; line 28 drop the "If F02's state events ... refuse" sentence; the new return also gets its `returns.bridge_returns` row (same corporation and tax year) through F07's identity port. Golden file (line 24): the link row only.
3. [verified] Line 19 "the link row names the original only as a column" leaves the column name open, and T10's closed guard (T10 line 32) attaches to every table with a `return_id` column. Line 29: "columns `original_return_id` and `amended_return_id`; no column is named `return_id`". Line 19 add: "T10's sweep reads the link table as a sentinel: no `return_id` column, so no closed guard, and an insert naming a closed original succeeds."
4. [inferred] The new return starts in `prepare` with no preparer: V10's New returns lists only `intake` and `evidence` (V10 line 20), so nobody can assign it and it reaches no preparer queue. V10 line 20: "New returns lists exactly the returns in `intake` and `evidence`, and any return in a state before `review` with no preparer assigned (an amended return, T14)". Property unchanged in form. T14 line 22 add: "the new return has no preparer until assigned on New returns (V10)." Amber (a flag for a person rather than copying the old assignment silently).
5. [verified] T11 writes approval rows to `returns.client_handoff` keyed by engagement, with `unique (engagement_id, list_kind, list_version, position)` (`05_bridge.sql` line 90). An amended return has the same engagement and tax year, so its summary either collides on `list_version` or leaves the original's `sent` rows beside it, and the client app reads every `sent` row of the engagement (contract section 4, line 81). T11 line 19 add: "`list_version` continues the engagement's sequence across returns; writing a summary for an amended return moves the original's `sent` approval rows to `closed` in the same transaction." T14 line 21 add the matching class: "the amended return's T183CORP sent leaves exactly one `sent` approval list for the engagement". See RED 1 for the client side.
6. [inferred] Line 35 says comparing the amended return with the original is N01's, but N01 has no such class and N01's chain is per return. The CRA-caught difference is already captured on the original (N01 line 20, check to assessed is `cra`). Line 35: "Comparing the amended return with the original for learning (not built: CRA's change is captured on the original as `cra`, N01)." Amber.

### T10
7. [inferred] FLOW-9's binder holds "every source ... approvals, signatures". The manifest (line 16) lacks B06's recheck record and the snapshots it read just before transmit (TB-11's proof that the books did not change), the exception and flag answers (X00) and the preparer's sign records (T12 `signOff`, V09). Line 16 add after "voids;": "B06's recheck records with the snapshots they read; every X00 answer and V03 risk judgment; every preparer sign (T12, V04)". B06, X00, V09 are already ancestors of T10.
8. [verified] Line 20 gives `returns.jobs` the reason "the runner updates the freeze job's own row". N01's diff and capture jobs (N01 line 26) are inserted for a closed return after the move into `assessed` saves the `assessed` version. Line 20 reason: "runner bookkeeping: the freeze job's own row, and learning jobs (N01) enqueued for a closed return". Line 32 the same words.

### T11
9. [verified] T07 keeps all review lines but one as "unconfirmed placeholders until the trial names them" (T07 line 14), and V02 shows "not confirmed in Taxprep yet" beside such a value; T11 would send it to the client with no such check. Line 16 add: "`recordT183Sent` is refused while any of the six summary lines is unconfirmed in T07 for the export's release, naming it (a planted unconfirmed line); the test world's simulator release marks its lines confirmed." Core.
10. [verified] Line 20 "accepted with the flag 'certificate not checked' for a person" names no store; T11 owns no flag table and V10 line 24 must show it. Line 35 (Build, schema): "the certificate row stores `checked` (`name_and_year_end`, `not_checked`) with a CHECK list"; line 20: "...accepted with `not_checked`; V10 shows 'certificate not checked' on the T183CORP page and on the Ops queue row until filed". Amber.

### V10
4 above (New returns). 
11. [verified] Line 20: the Ops queue lists `approved`, `client_sign`, `ready_to_file` and `filed` only, but the CPA and the owner close a follow-up item on the Notice page (line 28) while the return is in `assessed`, and the fixture (line 17) has such a return. Nothing lists it. Line 20: "...`filed`, and `assessed` while T13's `openFollowUps` is not empty". Property adds the follow-up case.
12. [verified] Line 22's assign property checks only the new preparer. Reassigning also removes access (SEC-2). Add: "and the previous preparer's `visibleReturns` holds exactly those returns fewer; a planted assign that keeps the old row leaves both able to see the return and fails."

### V11
13. [verified] Line 25 shows "the score as a percentage with one decimal" from I40's basis points (`floor(10000 * hits / cases)`), which have two decimals; the rounding is unstated. Line 25: "as a percentage with two decimals (basis points / 100, exact; no rounding)". Amber; D10's approved page wins if it states another.

### N01
14. [verified] The fixtures (line 14) need T13 (`assessed` from its notice) and T10 (C01 taken to `closed`), and Check (line 38) needs T10's sweep, but neither is a dep; adding both would hold the whole N chain behind T10 (size L, hard). Smaller: line 14 replace "`check` and `assessed` (from T13's one-cent Part I tax notice)" with "`check` and `assessed` saved through N00's `saveVersion` (kinds `check` and `assessed`)", and drop "C01 taken to `closed` (T10)". Line 25: "no table this card adds has a `return_id` column except the new columns on `returns.differences` (catalog scan, with a sentinel)"; the post-close insert stays T10's (T10 line 20 already exempts `returns.differences`). Line 38: replace "T10's closed-guard sweep green with this card's tables" with "the catalog scan green". J6 proves the joined path.
15. [verified] Line 20 maps version pairs to stages but misses pairs that cross a void (FLOW-5): after a check mismatch or a B06 change, the chain runs `cpa-final`, then `preparer`, then `cpa-final`, and `cpa-final` to `preparer` has no row. Line 20 add: "a pair across a void takes the stage of the void's source (T09 or B06: `check`; an evidence change, W12: `preparer`; a client dispute: `client`), read from T08's void record." Spec adds a class rule: "every ordered pair of version kinds that N00 can save, and every void source, maps to exactly one stage (exhaustive table; a pair with no row fails naming it)."
16. [verified] Line 6 Clauses add END-5 (its goal quotes it: "Nobody logs anything").
17. [verified] Line 32: N10 to N18 "add theirs" to the registry in `causes/_core/**`, which is N01's path; nine cards that can run at once would each edit it. And family acceptance 2 (never a wrong yes) needs every other cause's planted difference, which no card provides. N01 line 32: "the registry lists all nine causes and N01 writes a stub rule (`cannot tell` always) in each `causes/<cause>/index.ts`; N10 to N18 replace only their own folder." N01 line 5 Paths add `src/modules/learning/causes/*/index.ts`. N01 Build adds `causes/_core/__fixtures__/`: one planted difference with its evidence per cause, plus one late-information case per owner. Family `cause.md` line 9: "the rule replaces N01's stub in `causes/{cause}/`; never edits `_core`"; acceptance 1 and 2: "on N01's planted set". Acceptance 2 adds "a planted rule that says yes to another cause's case fails naming the case".

### N20
18. [verified] Line 16 groups by cause, but N01 stores `none yet` (no rule said yes), AI causes marked unconfirmed (N19) and `needs a person` with several causes. V11 line 22 shows "cause not confirmed" and "causes conflict" tags that N20 never defines. Line 16 add: "a difference with no confirmed cause groups under its AI-proposed cause with `unconfirmed`, or under `none yet`; one with several causes groups under the sorted list of them with `conflict`; neither is merged with a confirmed group of the same cause." Spec: one class over the three kinds.
19. [verified] Line 23 measures "for a period" but never says which date puts a case in a period, so two correct builds can differ. Add: "each case is dated by: the `cpa-final` save (AI draft match, extraction, preparer match), the difference's capture (escape rate), the fix event (repeat rate), the flag's raise (false alarms), the I30 item (red-team hit rate); a case at Monday 00:00 Toronto falls in the later period (boundary case in the golden file)."
20. [inferred] Line 21: `tools/lessons.mjs import` adds cards to `plan/slices.json`. During the build every lesson comes from made-up returns, so importing them would fill the real queue with fake work. Line 21 add: "the tool takes the slices file and cards folder as arguments; its tests run on a temp copy; during the build it never runs on this repo's `plan/` (running it on real lessons is the go-live question, RED 3 of the draft)." Amber.

### J6
21. [verified] Deps add N19: family `journey.md` line 14 checks "causes ... as expected", and a kind whose difference no rule claims goes to N19's AI proposal.

### GL1
22. [verified] Line 3 deps add SC3, SC5, SC11 (its Check needs R62 to R65, R72, R88 green and R90 runs on its pool) and FX7, FX10, FX11, FX13 (each holds part of GL1's Paths: `src/modules/storage/**`, `src/modules/auth/**`, `src/modules/ocr/**`, `src/modules/ocr/index.ts`). Without them GL1's spec is written against code those cards are about to change.

## Gaps with no owner
- LIVE-8 (C3).
- No screen shows a frozen binder or its verify result (T10 line 24 lets any user who can see the return read and verify it). FLOW-9 does not ask for a screen; recommended amber: V10's Notice page shows "binder frozen on <date>, verify passes" once closed, added to D09's brief.

## RED

1. **The amended return's approval summary in the client app (T11, T14; FLOW-8, LIVE-6).** An amended return needs a new T183CORP, so this system writes a second approval summary for the same engagement and tax year (fix 5). What the client then sees (a new approval for a year already filed, and any words saying it is an amendment) is client-facing and lives in the client app. Recommendation: the client app shows the latest `sent` approval list as today, with wording for an amendment approved in the client repo at LIVE-6. Meanwhile fix 5 keeps one `sent` list per engagement; only made-up returns exist; ask with the LIVE items at go-live, no to-do item now (as A444 did for the draft's three).

The draft's three REDs (SEC-9 for the Claude project, LIVE-3 vendors, lesson cards leaving a live host) stand as written; no card settles any of them (C5 puts each on its card).

Not red, for the Lead's AMBER rows: T09's 24-hour check window (data), T13's follow-up item holding the freeze (A438), N20's order (recurred after fix before client or CRA caught: LL-7 and LL-8 both say "first"; N20 picks recurrence, A444), and GL1's own password and two-factor engine (A444, GL1-2).
