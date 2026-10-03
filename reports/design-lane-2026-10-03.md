# Design lane restart: state and shortest path to one sitting (3 Oct 2026, for Tue 6 Oct)

Read-only survey. Labels: [fact] has a source, [inference] and [guess] are mine. Branch names are `origin/claude/...`; `-2` means the round 2 branch.

## 1. Facts that shape everything

- [fact] Only D00, D00L, D01, D02 and D11 have a card file in `plan/cards/`. D03 to D10, D12, D13 exist only as `slices.json` entries (all `parked`, A352) plus the family card `plan/cards/families/design.md` (its checks 1 to 9). D06 is removed (v1.1, A32/A110, replaced by D12; `slices.json` note; `V07` still depends on it and is parked). D02.md is two Lead lines (A433 CPA queue page; marks come off, Approve only when all marked) with no Goal; D11.md has a full Goal (pack for Zo; cannot start until all its deps are approved, so it is the LAST step, not part of this sitting).
- [fact] Zo already held design sitting 1 (decision 0020, 2 Oct, "accept all recommendations"): A queues and record with bulk assign (Z20-1); B workbench, steps left, source beside the row, no Worklists tab (Z20-2); CPA review V1, second window on demand (Z20-3); CPA queue overdue, tier, due date plus "Back from rework" (Z20-4); brief on one screen (Z20-5); one record shell for every role, preparer lands on Workbench, CPA on Review (Z20-6); source viewer B with A and C folded in (Z20-7, A358); logo from `Assets\Logo.png` (Z20-8). So the next sitting approves the polished pages per D card, not the structure.
- [fact] On main: `design/basis/` (D00, done), `design/map/` (D01, done). NOT on main: `design/briefs/`, `design/prototypes/`, `design/verify/` (rules.mjs V1 to V8, identical file on all five branches, hash 805ef19), `design/parts/cite-or-reason/` (only on `design-workbench-2` and `design-source-viewer-2`, same hash 2a673fd), `design/panel/`, `design/screens/`, `design/review/`. Branches are about 1,300 to 1,500 commits behind main and all dated 1 Oct (last commits 20:51 to 23:36 EDT).
- [fact] The branches' fix round 2 (findings-designs-2.md list) is committed on each `-2` branch. No panel re-walk after round 2 exists: `reports/design-retest-2026-10-01.md` (20 findings Q1 to Q9, W1 to W4, C1 to C3, D1 to D4) is of the pre-round-2 state. [inference] Q1 to Q3, Q5 to Q7, Q9, W1 to W3, C1, C2, D2 to D4 are claimed fixed but unverified; Q4, W4, C3 are prototype limits (stub neighbours); Q8 (no whole row at 1093 x 525) is Zo's call (filter line or view tabs; queues report still shows My work and Next ops step ending below the fold).
- [fact] Blueprint `06-screens.md` is unchanged since the briefs' commit b9c5003; changed since: `04-roundtrip.md` (diagnostics are a pasted list, RT-17, decision 0019), `03-evidence.md`, `01-rules.md`, `10-go-live.md`, README (git diff b9c5003..main). [inference] the workbench brief (D05, D07, D08, D12) and the source-viewer brief (EV clauses) fail design check 6 until re-checked; the queues and CPA briefs are clean on 06 but miss later card items (A421, A433, A444 below).
- [fact] Design pages are NOT in the "straight to main" list (CLAUDE.md hard rules: plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/). A388 says the code guard lists design/ too. [inference] `design/` lands on main only through a green train; for the sitting, Zo should open pages from a branch checkout or the cloud, so the sitting does not wait on a train.
- [fact] D02 and D03 spec jobs were released twice because they are design cards (reports/D02-spec.md, D02-spec-2.md on `claude/D02`; that branch holds nothing else). No design job is claimed now (claims branch has no D claim files).
- [fact] A24 holds helpers to two at a time "until the rehearsal passes" (amber, reversible); NOW.md says turbo, max_workers 12 (`plan/mode.json`). [guess] the Lead may lift A24 for the design lane; the plan below assumes up to 4 designers at once and says where 2 would do.
- [fact] Build behind each design card (transitive dependents in `slices.json`, V cards plus J5/J6/T/GL cards, D11 excluded): D13 52 (V00 is the shell every V card needs); D03 26; D04 26; D02 24; D12 22; D08 21; D07 15; D05 15; D09 2 (V10, J6); D10 2 (V11, J6). V cards by phase: V00, V01, V05, V08, V14 are phase 1 and wait on D13, D03, D04, D07, D02.

## 2. Helper inputs (what each job needs)

| Helper | Reads | Writes | Notes |
|---|---|---|---|
| design-researcher (Sonnet, 60 tool calls) | `reference/research/2026-09-29-staff-ux-patterns.md`, `...-internal-forensics.md`, blueprint clauses, existing brief | `design/briefs/<family>.md` (80 lines max) | Here used only to RE-CHECK a brief against the blueprint now (check 6) and add the new card items; no new web research needed. |
| designer (Sonnet) | `design/briefs/<family>.md`, `.claude/rules/staff-screens.md`, `reference/design-basis.md`, `design/basis/` (D00), `design/map/`, `reference/sample-clients/` | `design/prototypes/<family>/<version>/`, `reports/design-<family>.md`, then approved copy in `design/screens/<screen>/` + `notes.md` (family card) | Orders say "two or three versions"; here the structure is decided (0020), so ask for ONE version per card, polished, one page per state (empty, normal, many, error, flagged), and the verify script run (`design/verify/rules.mjs` V1 to V8, both sizes). Needs the `-2` branch merged first. |
| tester, panel mode (Sonnet, Playwright, cloud) | the brief's task scripts and budgets, prototypes | `design/panel/<family>.md` | Re-walk only changed and new tasks. Cannot run until the designer's pages are on a branch. |
| findings reviewer (Opus) | all panel reports + retest | one consolidated fix list | Loop step 4: required before any fix round. |

## 3. Per D card

Pages counts are html files on the named branch.
### D13 Sign-in and the record shell (phase 1; 52 builds behind it)
| Item | Detail |
|---|---|
| Exists | Record shell with identity bar, record tabs and role service navigation in queues-record A (`design-queues-record-2`, `a-tabs/rec-*.html`, 318 html in all; opens a Return-overview-like page per sample return); header search and `search.html` (Q3, Q4 round 2); `signed-out.html` in workbench B (`design-workbench-2`). Map rows exist for all (D01 on main). Brief: `design/briefs/queues-record.md` (`-2`). Panel: queues walked in the 1 Oct retest (shell tasks passed). Zo chose A (Z20-1, Z20-6). |
| Missing | Sign in and Two-step code pages (no prototype anywhere: grep of the queues and workbench branches finds none); Today page (map row `/today`; none drawn); the Return overview as a standalone approved page (it is the record's Overview tab); one shell shared with CPA V1, workbench B and the viewer (retest D1: three tab sets). No `design/screens/shell/` or notes.md. |
| Next job | Designer: promote A's shell to `design/screens/shell/`; draw Sign in, Two-step code (GOV.UK question page, autofill and paste allowed), Today per role, Search results, Return overview in the states void and approved. Re-check the queues brief against A421/A433/A444 first (small; the designer may do it). |
| Input files | `design/briefs/queues-record.md`, `design/prototypes/queues-record/_shared/*`, `design/prototypes/queues-record/a-tabs/rec-halton-haulage.html`, `search.html`, `design/map/screens.md`, `navigation.md`, `design/basis/`, `decisions/0020`, retest Q3 Q4 Q9 D1. |
| Parallel | Yes with D03, D04, D02. Must precede the sitting; V00 waits on it. D11 and every other family's final shell check depend on it. |
### D03 Source viewer (phase 1; 26)
| Item | Detail |
|---|---|
| Exists | Three versions A, B, C (`design-source-viewer-2`, 51 files, one working window each); shared `design/parts/cite-or-reason/`; brief `design/briefs/source-viewer.md` (research, EV-5 EV-6 EV-14 TB-7 TB-9 RV-4 RV-22 SEC-4). Retest 1: all nine first-round fixes pass; D1 to D4 found; round 2 fixed D2, D3, D4 (commit 04cc215a); D1 waits for D13. 154 http checks passed in round 1 (reports). Zo: B with A and C folded in (Z20-7, A358, "may change it with one word"). |
| Missing | The folded version (B plus A's keys and "Supports, next" slot plus C's Complete and Chase for ops): no such page exists. Re-test of round 2. Brief re-check against 03-evidence changes. Embedding in the one shell (D13). `design/screens/source-viewer/`. |
| Next job | Designer: one version "B+" on top of the `-2` code, pages for empty, normal, error (failed image, masked slip), done row, second window; then panel (changed tasks only: decide and advance, folded keys, Complete and Undo). |
| Input files | `design/briefs/source-viewer.md`, `design/prototypes/source-viewer/{b-tabs-and-decision,a-docked-strip,c-window-first,assets,build}`, `design/parts/cite-or-reason/`, `reports/design-source-viewer.md`, retest section 4, `decisions/0020` Z20-7, `reports/findings-designs-2.md` source viewer list. |
| Parallel | Yes with D13, D04, D02 (own directory). D02, D07, D12 and D08 embed its viewer, so they can show B as it is and refresh later. |
### D04 Preparer queue (phase 1; 26)
| Item | Detail |
|---|---|
| Exists | Queues A pages `queue-preparer.html`, `-empty`, `queue-due`, `-rework`, `-waiting`, `-all`, with search; default order due date (RV-20). Retest 1 passed all queue tasks; round 2b fixed Q1 to Q9 (commit 4acc0919; budgets re-run by the designer at both sizes, ready-to-review wholly inside at 1093, My work and Next ops step still end below). Zo: A (Z20-1). |
| Missing | Panel re-walk after round 2; Q8 decision (Zo); "My rework" and "All rework" words (done in round 2, check). `design/screens/queue/` and notes.md. Any A444/A421 item for this screen: not found. |
| Next job | Designer (small): copy and trim to `design/screens/queue/`, notes.md, verify run. Panel on T6b, T7, T11 and the fold at 1093. Q8 goes to Zo with two options. |
| Input files | `design/briefs/queues-record.md`, `a-tabs/queue-*.html`, `reports/design-queues-record.md` (round 2 numbers), retest section 1. |
| Parallel | Yes; same family files as D13, so give both to ONE designer, or split by page files. |
### D07 Gap review (phase 1; 15)
| Item | Detail |
|---|---|
| Exists | Gaps step in workbench B (`design-workbench-2`, `b-split-pane/record.html`, steps by client-side route; Keep/Edit/Merge/Drop), brief `design/briefs/workbench.md`. Retest: Gaps fold (Keep at y 738 / 763) found, W1 fixed in round 2 (pane pinned, decision at foot). Zo: B (Z20-2). |
| Missing | Brief re-check (written from b9c5003). Only Maple Ridge opens (W4 limit): D07 needs at least two returns with gap lists, an empty, an error ("add from the bank" refusal) and an approved state. Panel re-walk. `design/screens/gaps/`. |
| Next job | Researcher re-check of the workbench brief (first), then designer. |
| Input files | `design/briefs/workbench.md`, `b-split-pane/{record.html,assets}`, `PARTS.md`, `design/parts/cite-or-reason/`, `reports/design-workbench.md`, retest section 2, screens.md "Gap review" row. |
| Parallel | Can run beside D05, D08, D12 only if designers use separate page and asset files (they all share `b.js` and `b.css`). |
### D02 CPA review screen (phase 1; 24)
| Item | Detail |
|---|---|
| Exists | V1 record tabs (`design-cpa-review-2`: `v1-record-tabs/` green, red, approved, source pages, queue, queue-empty, queue-later; 221 files; offline GOV.UK and MOJ copies; 144 verify checks, 0 failing; brief from b9c5003). Retest 1: all 8 tasks pass; C1, C2 fixed in round 2 (fc3515f6); C3 limit. Zo: V1 (Z20-3 to Z20-5). |
| Missing | Pages for later card items: CPA judgment recorded on every accepted risk before Approve (A421, V03), severities must fix, should fix, note and top 10 changes since last year (A421), the comments page (RV-25, designed under D08) and fix drafts (V13). The CPA queue is drawn (A433 satisfied) but the brief text lacks it. Panel re-walk of tasks 2, 3, 6. `design/screens/cpa-review/`, notes.md. D02 card has no Goal text (card needs one before a designer reads it). |
| Next job | Designer: add the A421 items to V1 on the `-2` base, promote to `design/screens/cpa-review/`, run verify; panel on the changed tasks. |
| Input files | `design/briefs/cpa-review.md`, `design/prototypes/cpa-review/v1-record-tabs/`, `assets/`, `reports/design-cpa-review.md`, retest section 3, `plan/cards/V02.md`..`V04.md`, `V13`, `V15` (A421, A433), `decisions/0020`. |
| Parallel | Yes (own directory). Needs D13 only for the final shared-shell check. |
### D05 Round-trip checklist (phase 2; 15)
| Item | Detail |
|---|---|
| Exists | Round trip step in workbench B (six steps of RV-21, one "Upload both files", download of `01_2025-12-31_v1.csv`); retest P5 pass. |
| Missing | Everything added since the brief: .GFI upload with refusals and TB-3 flags (A164), the Ready button on the lock step and the "Taxprep still holds" list (A246, T12), the pasted Diagnostics list instead of the printed return (RT-17, decision 0019, A314), "N of 6 steps" wording (RE). States: blocked, error, flagged. |
| Next job | Researcher brief re-check (same job as D07/D08/D12), then designer. |
| Input files | `design/briefs/workbench.md`, `b-split-pane/record.html`, `blueprint/04-roundtrip.md`, `plan/cards/V06.md`, `T05.md`, `T12.md`, `B01.md`, `D05` note in `slices.json`, retest section 2. |
| Parallel | Shares workbench files with D07, D08, D12. |
### D06 Judgment input sheet
Removed by v1.1 (A32/A110): no sheet in our app; tax choices are made in Taxprep and cited via D12. No job. Cleanup: `V07` still lists D06 as a dep (slices.json); [inference] the Lead should drop that dep.
### D08 Exceptions and orphans, plus the CPA comments page (phase 2; 21)
| Item | Detail |
|---|---|
| Exists | Trace step (orphans, exceptions, diagnostics by category) and Comments step in workbench B; round 2 gave the pinned pane and shared cite-or-reason (W1, W2). |
| Missing | RV-12 and the CPA comments page V04 builds (A421); AI draft fix with citations approved by the preparer; exceptions by class (RV-24); error "refusal" state; search into trace cells (W3, fixed round 2, check). |
| Next job | Designer after the brief re-check; panel P7 and P9 plus comments. |
| Input files | As D07, plus `plan/cards/V04.md`, `V09.md`, `V13.md`, screens.md rows "Exceptions" and "CPA comments", `blueprint/06-screens.md` RV-12 RV-24 RV-25. |
| Parallel | Pair with D12 (same Trace step); not with D07/D05 unless files are separate. |

### D12 Cite button and orphan list (phase 2; 22)
| Item | Detail |
|---|---|
| Exists | Cite button inside Trace of workbench B plus `design/parts/cite-or-reason/` (README, css, js, example.html), reused by viewer B. Retest P6 passes, W1, W2 (round 2 fixed). |
| Missing | Own `design/screens/cite/` pages (Cite source or reason map row: radios Document box, Answer, Written reason, none preselected); tax choices as typed-in-Taxprep orphans (TB-6, RV-22); empty and error states. |
| Next job | Designer, same job as D08 (one person does the Trace step). |
| Input files | `design/parts/cite-or-reason/`, `b-split-pane/record.html`, `design/briefs/workbench.md` sections on cite, `plan/cards/V12.md`, screens.md "Cite source or reason". |
| Parallel | With D08 (one designer). |

### D09 Ops screens (phase 4; 2)
| Item | Detail |
|---|---|
| Exists | Queues A ops pages `queue-ops*.html` (all, waiting, filed), the Ops tab on every record (file upload, check export, confirmation number), bulk assign bar. Retest: ops tasks pass, Q1 and Q2 fixed in round 2b. |
| Missing | Separate screens in screens.md: New returns, CRA data capture, T183CORP, Check export upload, Filing confirmation, Notice of assessment (compare with filed return, Close follow-up, Start amended return, A444); bulk assign on New returns (A444). [inference] only the Ops tab and queue are drawn. |
| Next job | After the sitting (phase 4; only V10 and J6 wait). Researcher brief amendment, then designer. |
| Input files | `design/briefs/queues-record.md`, `a-tabs/queue-ops*.html`, `rec-*` Ops tab, `plan/cards/V10.md`, `reports/cards-D11-GL1-draft.md` (A444). |
| Parallel | Yes, any time. |

### D10 Owner board (phase 4; 2)
| Item | Detail |
|---|---|
| Exists | `a-tabs/board.html` (state strip in lifecycle order, week chips, caption fixed in round 2, Q6). |
| Missing | Mark fixed (owner, CPA, card id) and period filter (A444), Weekly lessons and Measures pages (map rows), panel re-walk of Q6. |
| Next job | After the sitting; same as D09. |
| Input files | `a-tabs/board.html`, `plan/cards/V11.md`, `reports/cards-D11-GL1-draft.md`, screens.md rows Pipeline, Weekly lessons, Measures. |
| Parallel | Yes, any time. |

### D11 Review pack (phase 4)
Not startable: needs every dep approved (card text). Runs after the last family sitting. [inference] For Tue 6 Oct use a thin "sitting index" page instead (one HTML on a branch listing pages per card, the budgets measured, and the two or three questions); D11 later replaces it.

## 4. Shortest order to one sitting by Tue 6 Oct

Scope for the sitting [inference]: the five phase 1 cards (D13, D03, D04, D07, D02) hold the most build and block V00, V01, V05, V08, V14; add D12 and D08 (together they unblock V04, V09, V12, V13) and D05 only if the workbench designers finish by Monday midday. D09, D10, D11 go to a later short sitting (2 builds each).

Sat 3 Oct (today), all parallel:
1. Base: one helper makes branch `claude/design-base` from main with design-verify and the four `-2` branches merged (additive paths; the verify module is identical on all five; the cite-or-reason part is identical on the two branches that have it). Everything below starts from it. (Independent of 2 to 6 only in that designers need it; prepare it first, about one hour [guess].)
2. Researcher (re-check, not research): `design/briefs/workbench.md` against blueprint v1.2 and A164, A246, A314, A421; also add the A421/A433/A444 lines to the queues and CPA briefs. Cheap, one job, ahead of the workbench designers.
3. Designer 1: D13 and D04 together (same family files).
4. Designer 2: D03 folded viewer.
5. Designer 3: D02 CPA additions.
Cap: if A24 (two helpers) stays, run 3 and 4 first, then 5 and the researcher.

Sun 4 Oct:
6. Designers 4 and 5 (after job 2): Designer 4 does D07 then D05 (steps Gaps and Round trip); Designer 5 does D08 and D12 (Trace and Comments). Separate page and asset files; neither edits `b.js` or `b.css`.
7. Panel testers (one per family, parallel, cloud) as soon as designers 1 to 3 push: D13+D04 (queues), D03, D02. Changed and new tasks only.

Mon 5 Oct:
8. Panel for the workbench family (D07, D05, D08, D12) once designers 4 and 5 push.
9. One Opus findings reviewer over all panel reports (loop step 4); one fix round by the same designers (Mon evening); run `design/verify/rules.mjs` and axe again.
10. Sitting index plus the to-do item for Zo (Lead writes; one page, questions: Q8 fold at 1093; D03 B+ folded as chosen; anything the panel marks as a real choice).

Tue 6 Oct: sitting. Lead marks each approved D card done, copies approved pages to `design/screens/<screen>/`, and the pages land by train (design/ is not a straight-to-main path).

Critical path [guess]: base, then researcher, then designers 4 and 5, then panel, then findings review, then fix, about 2.5 days if each step takes a half day; the phase 1 cards (jobs 3 to 5, 7) have slack of about a day.

## 5. Risks and gaps (for the Lead)

- Design check 6 lint is "brief older than the last commit touching its clauses": the workbench and viewer briefs fail it; queues and CPA briefs pass on 06 but are stale against card amendments.
- Shared basis edits: check 9 says a new `app-` part goes into `design/basis/` with its reason; parallel designers will conflict there. Rule suggestion: designers list needed parts in notes.md and one helper folds them in after the wave.
- Q8 and W4/C3/Q4 are limits, not defects; if the panel re-flags them the findings reviewer must not send them back to a designer (stated in the retest).
- The D02 card text (two lines) and D03 to D13 (no card files) mean a designer reads `slices.json`, the family card and the brief; write a one-line goal per card in the dispatch prompt.
- No design job is claimed anywhere (claim.mjs has no design lane, A352); start designers as cloud sessions per `.claude/skills/dispatch/SKILL.md` line 34, not through `claim.mjs`.
