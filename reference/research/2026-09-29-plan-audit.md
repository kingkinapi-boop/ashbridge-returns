# Plan audit, 29 Sep 2026 (skeptical, read-only)

Labels: [fact] seen in a file (path:line) or measured by me. [inference] my reading. [guess] unverified. "Scratch test" = a tool copied to the scratchpad with a local bare git remote; the repo, ashbridge-app and .env were not touched. Q1 to Q8 = the
eight questions in the brief. Only 11 of 255 cards have card files (the rest are family templates plus slices.json). Held up when checked: 17 waves, widest 36 (NOW.md:10); phase counts (TODO-ZO.md:46-52); no dependency cycles or unknown dependencies;
no path overlap inside any wave, so every wave can run at full width; matrix.mjs --plan is clean; the claim lock never double-claimed in a 16-way race.

## Ranked findings, worst first

**1. The owner's first step was moved to the end: 27 cards encode the Taxprep round trip, 174 of 255 are those or depend on them (Q2, Q7).**
- [fact] The owner's build order starts with "prove the CSV round trip" on real Taxprep, 3 made-up corporations, gate "export matches import cell for cell" (reference/design-2026-09-28.md:349-355). The plan swaps in a simulator, logged as amber A5,
  not asked (plan/AMBER.md:11; decisions/0005 S-6), and puts the real proof at go-live (blueprint/10-go-live.md:3), card GL4 in phase 7. Mapping cards write placeholder ids "replaced at go-live" (plan/cards/families/schedule.md:9,21).
- [fact] Decision 0005 is "reversible until R00 merges"; R00 is now F00 (0007 Z-8), which is the next build. The window closes in days.
- [fact] RT-2 needs a Taxprep cell "never sent to CRA" to hold the import token, "settled in the real Taxprep proof" (blueprint/04-roundtrip.md:17). RT-1, RT-6, RT-19 and the trace lean on it. The panel review listed the questions for CCH (clear a
  cell by CSV, copy numbers after a delete, calculated cells in a filter, a never-sent cell, import encoding: reference/design-review-2026-09-28.html section 7). The owner listed 7 research requests (design:357-367). None is on plan/TODO-ZO.md, which
  never mentions CCH (grep).
- [inference] A wrong assumption is found after the capacity is spent (plan ends 10 Oct). Cheap fix: email CCH this week; ops runs the owner's phase 0 on 3 made-up corporations; GL4's kit becomes a phase 1 card; both go on TODO-ZO as red (they touch
  RT-2, LIVE-1).

**2. The job queue fails at the scale turbo needs; I measured it (Q5, Q6).**
- [fact, scratch test] 16 workers calling `claim.mjs next` at once (16 clones, local remote, best case): 6 got distinct jobs, 10 quit with "RACE: gave up after 6 tries" (exit 5) after about 35 s. Retries have no wait or jitter
  (tools/claim.mjs:97-100). worker.md:16-19 handles only CLAIMED, NOTHING and PAUSED. NOW.md:12 says 4 workers were tested.
- [fact, scratch test] Every call runs one `git show` per claim file (claim.mjs:68-73); files are never deleted (up to 3 x 255 = 765). With 700 files, `list` and an uncontended `next` each took 51 s on this Windows laptop (73 ms per file).
  [inference] The Lead's `list` each wake-up and every worker start pay it, and the collision window grows with it. [guess] Linux cloud spawns are faster, perhaps 4 to 7 s.
- [fact] `update` has no owner check (claim.mjs:196-210). A claim goes stale 90 minutes after it was written (claim.mjs:77); CLAUDE.md:60 says "no commit"; nothing tells workers to refresh it. [inference] A long cloud check (commands cap at 10 min,
  reference/research/2026-09-29-claude-code-facts.md:19) is stolen and done twice; a RACE on `update` loses a finished job the same way.
- [fact] Check FAIL is two pushes (worker.md:24). [inference] A crash or RACE between them leaves check and build both "reported"; "reported" never expires (claim.mjs:77), so the card sticks until the Lead reads notes.
- [fact] `wind_down_at` (plan/mode.json:7) is read by no tool (grep), so wind-down and README.md:39 "pauses by itself" need a live Lead. The queue takes the first eligible card in file order (claim.mjs:150-181): no critical-path priority. heavy.mjs
  frees a lock by age only, not pid (:33,37); [inference] on Windows SIGTERM is not delivered and `child.kill` with shell:true kills only the shell (:55-62), so one crash blocks laptop heavy jobs for 45 min.
- Fix (hours): jitter and backoff, one push for FAIL, owner check, heartbeat, one batched read. F08 (tool tests) is still "todo"; land it first.

**3. The definition of done contradicts the spec step; dependency changes have no owner (Q1, Q5, Q6).**
- [fact, scratch test] scope.mjs allows only card paths, reports/** and the card file (scope.mjs:33). The spec-writer adds `*.acceptance.test.ts` and `__golden__/` on the same branch (spec-writer.md:10-11). Result: "SCOPE FAIL" on both. No card lists
  them (grep 0). 80 cards have explicit file lists (F01, F03, F04, F05, F09, G10-G17, M10-M23, all 53 journeys); [inference] they fail scope at the first check (checker.md:16, merge SKILL.md:11) unless the checker passes the spec commit as base,
  which nothing says. protect-spec covers only `*.acceptance.test.ts` (protect-spec.mjs:25) while cards list plain `*.test.ts` builder files (F01, F03, F04, F05).
- [fact] Only F00 lists package.json and the lockfile. D00.md:13-14 (govuk-frontend, MOJ, sass, nunjucks), U00, A01 (pdf.js), A02 (tesseract), W20, A07, V01 need packages; builder.md:13 bans `npm install` on the laptop; build-practices.md:69 (3.6)
  says "a new dependency is its own small card": none exists. D00 and F00 are both wave 0 with no dependency, yet D00.md:24 needs `npm ci`. [inference] Local workers share one node_modules junction (worker.md:12): a lockfile change forces `npm ci` in
  main and wipes it under every running worktree.
- [fact] Spec jobs ignore dependencies (claim.mjs:174-179) and CLAUDE.md:55 wants 10+ specs ahead. [inference] Specs for E10 are written against an E01 API that does not exist yet; builders may not edit tests (builder.md:20), so mismatches cost
  rounds. [inference] The 53 journey cards deliver a test file (families/journey.md:9), so the spec and build split has little to build.
- [inference] F00 is circular in prep: AC4 needs a cloud e2e run (F00.md:27), merge needs a queue check, but prep allows only spec jobs (claim.mjs:33) and NOW.md:7 says nothing runs in the cloud; modes SKILL.md:18 ends prep when F00 merges. Not
  written down.
- Fix: allow `**/*.acceptance.test.ts` and `**/__golden__/**` in scope.mjs; card the dependencies or preinstall them in F00; D00 depends on F00; gate spec claims on dependencies. Run the rehearsal on a file-list card with a spec (F04).

**4. No real user anywhere; "review fast" has no measure; the plan adds steps the owner did not ask for (Q2, Q3, Q4, Q7).**
- [fact] Human checks: Zo's 15-minute blueprint ok on a 13-point summary (TODO-ZO.md:7-12), one 45-minute look at static designs (design-basis.md:103), an optional look at a progress page (merge SKILL.md:35). The review prompt told reviewers "Do not
  suggest involving the CPA or any named person" (reference/review-prompt-2026-09-28.md:55). The owner's gates "CPA reviews 20 test files end to end in the screen" and "10 test files fully traced" (design:353) appear nowhere else. No usability or
  timed-review wording exists (grep).
- [fact] END-3 and RV-4 time only "source opens in under one second" (00-end-state.md:7, 06-screens.md:8). RULE-15 and RV-51 say "fast" with no minutes or clicks (grep: none).
- [fact] Added, not in the owner's design: fixed section order, Approve hidden until every section is marked, time on each section stored (RV-5, 06-screens.md:9; design:221-230 has none); judgment choices entered in our app first (TB-6, RV-22) where
  the owner has the preparer work in Taxprep then cite (design:151-155); 4 exports + review-lines export + printed return + 2 gates (04-roundtrip.md:5-10,38) against one lock export (design:159-172); a working trial balance with adjusting entries,
  "the largest build item" (blueprint/README.md:21). Review marks per item have precedent (reference/research/2026-09-29-staff-ux-patterns.md:11); the forced order and hidden Approve do not.
- [inference] "Preparer hours are cheap" (review-prompt:24), so extra preparer steps may be fine, but nobody priced them and the CPA's time is the goal. Tax correctness rests on one model family: the 26 checks, 11 AI topics, tiers, due dates and the
  13 answer keys are written, built and checked by it; the AI panel admits a rule "from memory, not re-checked" (review html section 5, T1135). Three workers give three names, not three judgments (reference/research/2026-09-29-agentic-build-practices.md:67,
  F7).

**5. Feasibility and no cut line (Q6, Q7).**
- [fact] 17-level chain (J6 back to F00). A card starts only when its dependencies are `done`, set only when a train lands (claim.mjs:139-140; merge SKILL.md:26); one train branch, every 6 cards or hourly. 67 cards are still "todo" and only the Lead
  writes them (CLAUDE.md:55).
- [fact] Weekly plan usage is 85% today, 2 days before the reset (tools/status.mjs at 16:26Z). budget-guard counts dispatches, not usage (budget-guard.mjs:21,49). metrics.mjs records rounds, fails, jobs, ambers; no tokens, minutes or dollars, and
  `accepted: true` is hard coded (metrics.mjs:39-50). plan/usage-now.json is one gitignored snapshot (.gitignore:8): no cost history, no burn-down to 10 Oct, no descoping trigger. The Reviewer can only slow (REVIEWER.md:59-61).
- [fact] The first CPA review screen (V03) needs 47 of 255 cards but sits at level 10; screens come last by layer order. [inference] An early stop leaves layers with no usable path. Fix: pick a cut line now (kind K01 through V03), order the queue by
  dependents, add tokens and minutes to metrics.

**6. Cloud and cost assumptions nobody has run (Q5, Q6).**
- [fact] From reference/research/2026-09-29-claude-code-facts.md: Playwright and Chromium hosts are not on the default network list (:24); commands cap at 10 min (:19); interactive cloud sessions stall on unanswered prompts (:23); routine credit is
  "UNVERIFIED" and dated 4 Nov, not 5 Nov (:29). settings.json has 31 allow rules but none for `npm ci`, `npm run lint|deps:check|e2e|mutate:changed`, `node -e` (worker.md:12), `git worktree add`, `git -C * merge|push` (merge SKILL.md:13-18) or `gh`.
  Cloud journeys carry 53 cards, the tester and every train.
- [fact] checker.md:13 runs the full unit, db and e2e suite in the cloud for every card, while merge SKILL.md:8 and modes SKILL.md:71 say the full cloud run is once per train. [inference] Check cost per card grows as journeys accumulate; the train
  repeats it.
- [fact] 11 AI checklist cards, I30, I40 and GL5 need `claude -p` inside worker sessions; AMBER.md:12 (A6) says "not yet confirmed".
- [inference] GitHub minutes: about 3 code pushes per card x 253 = 760 runs of 3 to 6 min against 2,000 free (F00.md:19; NOW.md "Watch out"); boarding needs green GitHub checks (merge SKILL.md:11), so a used-up quota stops landing. Same as
  lessons-deep pattern 22.

**7. Hooks fail open and "green train" is a procedure (Q5).**
- [fact] budget-guard exits 0 on a parse error and reads an unreadable ledger as zero (:30,51); its cap reads a per-checkout file; turbo has no cap (:21,54). main-push-guard lets any merge commit through (:91), so CLAUDE.md "only through a green
  train" is not checked; GitHub branch protection on a private repo needs a paid plan (build-practices.md:65). protect-spec covers Edit and Write only (settings.json:97-108): `vitest -u`, `sed -i` or Bash writes pass, though checker.md:8 says a hook makes the checker
  read-only. now-is-current guards only a Windows path and ignores design/ and .github/ (:22,44-45).
- [fact] "Main ends clean" (CLAUDE.md:79) but budget-guard appends to tracked plan/ledger.jsonl on every dispatch (git status shows M today). [inference] A cloud Reviewer sees only pushed files: ledger stale, usage-now.json absent, so its usage check
  is blind. CLAUDE.md:79 lost its backslashes (likely the heredoc damage NOW.md warns about); worker.md:12 hard-codes C:/Users/User.

## Q1 Contradictions and stale numbers
- Cards: 255 in slices.json (253 need a spec), NOW.md:10, TODO-ZO.md:17, AMBER.md:18; 253 in CLAUDE.md:40, README.md:38,46, decisions/0007:10 (never edited).
- Kinds: thirteen (blueprint/00) but "twelve" in AMBER.md:14 (A8; A19 at :25 adds K13), slices.json:264 (J6 title), decisions/0003:7. Old card ids R07, R62, R14, R16 in reference/onboarding-contract.md:3,99,101,105.
- Mutation: ARC-15 (09-architecture.md:30), families/check.md:19 and REVIEWER.md:27 say no surviving mutant; testing.md:36, F00.md:14 and AMBER A21 say break threshold 70. [inference] Zero survivors is not reachable with equivalent mutants, so cards
  hit round 3 on it (reference/research/2026-09-29-testing-strategy.md:12 flags this too).
- Screens: RV-53 and staff-screens.md:35 want a visual test on every screen; testing.md:37 allows pixels for a few dense screens. Models: worker.md:4 opus for all jobs, builder.md:4 sonnet, modes SKILL.md:31 "sonnet builders". Phase order: G02 (phase
  2) needs I00 (phase 4); V11 (phase 5) needs N20 (phase 6).
- ARC-20 (live side of adapters tested from the start) is cited only by GL1, phase 7, not by A02 to A06, yet `matrix.mjs --plan` says PLAN OK: it checks only that some card cites a clause, and matrix.mjs:40 counts a clause as tested if its id appears
  anywhere in a test file.
- Two queues: next.mjs reads statuses nobody sets (lib.mjs:17) and lists F00, D00, D01 as startable. Credit: $240 to 5 Nov (0007 Z-9) vs $250 to 4 Nov (claude-code-facts.md:29).

## Q2 Owner's design vs blueprint
- Dropped and not named in decisions/0006 (13 items, no cut listed) [fact]: story check (design:207); second AI trimming questions (design:44,119; AI-12 uses a fixed bank, 05-checks.md:73); second AI challenging thin answers (design:219; EX-2 is a
  code rule, :78); AI-drafted comment fixes (design:51,252; RV-7); "two AI passes that disagree" (design:213); shareholder-loan continuity and CCA-additions ties (design:192-193; none in 05-checks.md); cite button on every figure (design:260; RV-24
  only for orphans). Most match the panel's "Cut or defer" list, but Zo's ok covers them only through a summary (TODO-ZO.md:7-12).
- Changed: "staff pages inside the existing app on the same sign-in" (design:264) became a separate app, a bridge and a shared table (09-architecture.md:3-4; GL3): a second deployment, first tested against the client app at go-live; F07 reads a
  snapshot of a repo another Lead changes daily (NOW.md "Watch out"; onboarding-contract.md:3).
- Over-built beyond Finding 4: owner board (RV-40, D10, V11); 13 kinds x 4 phases of journeys where the design says 3 corporations at phase 0 (design:353); LL-8 writes weekly build cards with failing tests (07-learning.md:10) where the design asks
  for a list (design:303-305); GOV.UK and MOJ from packages with 17 per-screen rules (staff-screens.md:19-35) though GOV.UK lets dense internal tools deviate (design-basis.md:53) and Zo said "wherever applicable" (0007 Z-7).

## Q3 Cards on unvalidated screen or workflow assumptions
V03 (forced order), V07 and D06 (judgment sheet before Taxprep), V06 and D05 (5 uploads per return), V08 and D07 (bank of 8 topics whose ids must match another repo's deck, LIVE-6), V09, V10, V11, U01, D02 (three panes: no GOV.UK or MOJ pattern,
design-basis.md:65), X01 (green needs a preparer with 50 reviewed files, 05-checks.md:57: nobody has any at start, so early returns are amber). W21 to W38 (renderers "like the real ones", families/render.md:9) and the 16 readers (E10 to E25) are
tested against one model's own renderings; no real sample is planned (0003 F-3; the owner's "about 50 anonymised real documents", design:365). D11 "done" is not Zo's approval: V00 depends on D11's status, RV-53 needs his yes, nothing encodes it
[inference]. V and U cards are still "todo" (no card text).

## Q4 Share of cards (my script; rough classes)
Direct time-savers for preparer, CPA or ops 113 (44%): readers 18, books 4, gaps and bank 11, mapping/import/trace/approval 22, checks 27, AI checks 14, exceptions and tiers 2, screens 15. Proof and gates 61 (24%): 53 journeys, JH0, SK0, F08, I40,
D11, GL4 to GL6. Test world and simulator 37 (15%). Design 11, foundations 13, learning loop 12, plumbing 8 (A cards, ledger). About 39% of cards prove or feed proofs. By size (S=1, M=2, L=4) product is 55% and proof plus test world 33%. Per card, 2
of 3 agent sessions are spec or check.

## Q6 One small card (for example Q30, a flag check)
Sessions: spec, build, check by 3 workers (4 with the screens tester, plus a security review on 11 cards); about 4.5 at 1.5 rounds; plus 1/6 of a train session. Also: about 10 Lead tool calls (2 report reads, board 5 commands, metrics, slices edit,
release, matrix, NOW.md, commit, push); 2 to 3 GitHub runs (npm ci, audit, gitleaks, typecheck, lint, deps, tests); at least 6 claim pushes, each with 2 fetches and N reads; 2 full cloud suites (check, then train); 3 cloud `npm ci`. [inference] Each
job reads 12 to 18 files (CLAUDE.md, NOW.md, agent file, rules, template, slices.json at 75 KB or its entry, 1 to 2 blueprint files, contracts, engine, fixtures): 40 to 55 reads per card. Nothing measures it.

## Q7 No feedback from reality, and where a practicality role plugs in
Blind spots: real Taxprep (1), real documents (Q3), real staff (4), tax rules (one model family), cost and pace (5). REVIEWER.md:16-56 checks drift, tests, independence, usage counts, Zo's time and safety; none asks "does this save time". Another
scout found the same gap: "no timed day-in-the-life by the actual preparer or CPA" (reference/research/2026-09-29-internal-forensics.md:91).
1. Before blueprint ok: 30 minutes each with one preparer, the CPA and ops marking blueprint 00, 02, 04, 06 "would not do / too slow / missing". Each mark is a red item or a cut. No build cost.
2. A "practitioner" step in CLAUDE.md loop 2 (card review) and D11: per workflow card, estimate uploads, clicks and minutes for a green and a red return against a budget Zo sets once; flag clauses over it (RV-5, exports, judgment sheet first). Add
  Reviewer check "H. Practicality".
3. Task budgets as clauses with counters in the J5 journeys (clicks, loads, seconds per role task; forensics note "What they miss" 1).
4. Phase 5 gate: the CPA times a review of 3 made-up returns on the built screens; times go to metrics.jsonl; over budget means a cut list.
5. Red question for Zo: 10 sanitised real documents and 3 real Taxprep exports; CPA-signed hand-computed examples for the 26 checks and 13 answer keys.

## Q8 lessons-deep.md items the cards and rules still do not prevent
1: SK0 stops at the trace; the first journey that walks screens end to end is J5 at level 15 (V03 sits at level 10). 2: designs come before screens, but Zo's approval is not a queue gate. 4: per-card usage still missing (lessons-deep.md:28; metrics.mjs). 8: no card for "new folder not walked"
sweeps; U02 has no card text. 11: ARC-20 sits in phase 7, not in the cards that build adapters (:63). 13: no test regenerates generated files (:73). 14: rehearsal not run; allow-list gaps (Finding 6). 18: main clean vs ledger (Finding 7). 20: "two
documents, two stories" is live in this repo (Q1). 21: no size budget; the blueprint is wider than the design (Q2). 22: CI minutes (Finding 6). 9 and 23: `accepted: true` is hard coded and PASS is a free-text note the checker writes (worker.md:24).

Limits: real GitHub latency, Linux cloud timings, the 244 card bodies that do not exist yet and ashbridge-app were not checked. Scratch results are one run each on this laptop.
