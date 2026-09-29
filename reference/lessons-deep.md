# Lessons, deep: what the client app build got wrong, and what stops it here

Written 28 Sep 2026 by a read-only scout of ashbridge-app (v1: 3 to 24 Sep; v2: reset 24 Sep, live 27 Sep). For the Lead and the Reviewer. Every claim is labelled [verified] (seen in the file named) or [inferred]. "ALREADY IN PLACE" and "MISSING" were checked against this repo's working copy on the evening of 28 Sep, while the setup session was still rewriting it (decision 0007, the job queue in tools/claim.mjs, trains, 245 cards; much of it uncommitted): re-check a status before relying on it. The short rule list stays in `reference/lessons.md`; this file is the evidence behind it.

Source keys, all in ashbridge-app: LRN `Claude outputs/LEARNINGS-v1.md`; RB `_strategy/REVIEW-BRIEF-2026-09-24.md`; RR `_strategy/REVIEW-RESPONSE-2026-09-24.md`; TDA `plan/TODO-ZO-archive.md`; REV `reviews/REVIEW.md`; MET `plan/metrics.jsonl`; APP-NOW `plan/NOW.md`; T/ `reviews/tester/`; B/ `reviews/builds/`; AD `decisions/`; MEM Zo's memory notes (`C:\Users\User\.claude\projects\C--Users-User-Documents-GitHub-ashbridge-app\memory\`). In this repo: `here:<path>`; "agent X", "skill X", "hook X" mean the files under `here:.claude/`.

## 1. Top failure patterns, most costly first

### 1. Every part passed; the whole journey was tested by nothing
- Happened: every screen passed its own tests for a week while no client could get past Screen 2 (LRN s2); the first independent live walk found 12 launch blockers, four of which had passed 6,360 tests and 46 browser journeys (RB C.4; LRN s4) [verified].
- Cause: about 90 narrow session plans and 435 merges, each told to build only its piece; nobody owned the whole (RR s3 A1) [verified].
- Cost: the v1 client screens (three weeks of work, 42.6k lines of screen tests) were thrown away in the 24 Sep reset (RB 3.3; RR Q8) [verified].
- Prevent: journeys per kind for phases 2 to 6 (here:plan/slices.json J2-K01 to J6), a journey harness card in phase 1 (JH0), and every train runs every journey built so far (skill merge): ALREADY IN PLACE [verified]. MISSING [verified]: a thin walking skeleton through JH0 in phase 1 (one kind: document in, fact, figure, import CSV, simulator export, trace; stubs allowed) that every train keeps green. END-9 says "on every merge", but the first real journey, J2-K01, waits on 27 cards. Where: a card in slices.json that phase 2 cards depend on.
### 2. Zo's taste arrived last
- Happened: "Just build. I will do a QA at the end." (4 Sep, MEM ashbridge-critical-questions-only); his first click-through gave about 137 comments, about 15 high (RB 3.2); GOV.UK patterns he approved on 16 Sep were used only as a post-build check: "This got ignored." (`_strategy/v2-start-kit/01-FOR-REVIEWER.md`) [verified].
- Cause: no approved flow or picture existed to build to; code was checked against documents, not against his eye (RR s3 A2, A3) [verified].
- Cost: the same reset. Once v2 put the flow map and designs first, go-live took 4 days against a plan of about 14, and his high comments fell from 3 (S10) to 0 (S11) (REV) [verified].
- Prevent: ALREADY IN PLACE: blueprint approved before building (here:decisions/0001 R-1); every screen designed with made-up data and approved by Zo in one sitting before any screen is built (here:blueprint/06-screens.md RV-52 to RV-55; here:decisions/0007 Z-7; cards D00 to D11, where D11 is the one-look pack that V00 depends on) [verified]. Keep the look before V00, never after.
### 3. The data model and the hand-over were never checked against everything the other system sends
- Happened: v1's intake contract said "corporations only" while decision S2 had personal returns in scope, so they vanished (RR s3 A2); the day after v2 went live a T1-only quote got HTTP 400 and a company with no service a 500 that rolled back the whole intake (B/intake-rejections-2026-09-28.md); family returns were paid for but never created (AD 0019) [verified].
- Cause: test kinds came from the app's own design, not from the sender's full range; "No test in tests/intake/ or e2e/ sends a creating event without corporations" (B/intake-rejections) [verified].
- Cost: v2's sign-in and entity rebuild (migration 0029); after go-live an intake fix, migration 0034 and a hotfix in one day (APP-NOW) [verified].
- Prevent: ALREADY IN PLACE: P01 read the client app with cited columns and records the commit it read, f87a0043 (here:reference/onboarding-contract.md) [verified]. MISSING [verified]: (a) a table in blueprint 00 showing the twelve kinds span what the client app can hand over; none has two unfiled years for one corporation, though the client app sells prior years (app `plan/BRIEF.md` K5) [inferred]; (b) card template: a card that reads client-app data names the client-app commit it was written against, and F07 and go-live re-check the bridge against the latest migrations (the other Lead added 0033 and 0034 on 28 Sep and plans more for the quote hand-off, APP-NOW) [verified].
### 4. Usage burned on verifying, not building
- Happened: "You have used 50% of it within 24 hours" (12 Sep, MEM zo-cost-and-batching); the weekly limit was hit within about 48 hours, repeatedly (RB 3.3) [verified].
- Cause: every test file booted Postgres and replayed migrations (16 s cold, 197 files) and every builder, gate and loop ran the suite; copy was hand-typed then policed; three resident chats messaged each other; a 109-agent fight; 227 commits a day (LRN s2b) [verified].
- Cost: days locked out of the plan; the one number that explained it took 30 seconds to measure and nobody had (LRN s2b) [verified].
- Prevent: ALREADY IN PLACE: modes, daily dispatch caps, worker caps and a ledger (here:decisions/0004 and 0007; hook budget-guard; skill modes); PGlite tests; one cloud run per train, not per card (skill merge); the Lead reads reports only (here:CLAUDE.md) [verified]. MISSING [verified]: per-card usage and suite seconds in each metrics line. Where: skill merge (metrics line) and a Reviewer check (here:reviews/REVIEWER.md "Usage").
### 5. Shared screen behaviour was found one tester round at a time
- Happened: S08 took 14 build rounds and 8 tester fails (MET); S04's rounds 4 to 6 alone had 14, 5 and 12 findings (B/S04-engine.md); the same kinds recurred: a task Done while answers were missing, Back to the wrong page, a masked value erased on re-save, valid input lost after a refusal, one person's draft shown to another (T/S08-r2.md to S08-r2k.md) [verified].
- Cause: what "done" means and how save, back, reload, refusal and masking behave were never written as tests before the screens [inferred].
- Cost: S08's rounds ran from 25 Sep 15:00 to 26 Sep 21:19 by the report files' times, each with a preview, a walk and a cloud run [inferred]; Netlify credits passed 75% (APP-NOW) [verified].
- Prevent: ALREADY IN PLACE: a card is not handed out again after three failed builds (here:tools/claim.mjs MAX_ROUNDS) [verified]. MISSING [verified]: one shared-behaviour card that V00 to V11 depend on, whose tests run on every staff screen and every return kind: a state shows only when its checks pass; a refusal keeps valid input and names the field; reload and back keep work; two staff on one return (FLOW-10 holds); masked values survive a re-save. Where: a card and its tests in slices.json.
### 6. Fixes were patches, not rules
- Happened: an error-summary component existed but only two screens used it, and Zo had flagged missing field errors "everytime" (RR s3 A4; RB App. D); a banking scrub was fixed four times against the last phrasing (LRN s3); fifteen patches (D53) went onto screens the next wave rebuilt (LRN s2a) [verified].
- Cause: each finding was fixed where it was seen [verified].
- Cost: "while you may fix one thing, you end up messing something else" (Zo, 24 Sep, RB App. D); a batch of work thrown away [verified].
- Prevent: ALREADY IN PLACE: each Zo comment becomes a test that runs on every screen or kind, plus a fix card (here:CLAUDE.md loop 6; skill merge "Phase gate"); it worked in v2 (REV) [verified]. MISSING [verified]: the same for check and train failures (today a failed check sends the card back as "build failed", an instance fix: agent worker), and "never patch what a later card rebuilds; add the defect to that card". Where: agents worker, checker and builder.
### 7. Defects that exist only on the real host or platform
- Happened: every client's link dead-ended on the host because a redirect used request.url; the host's 4 MB body cap silently cut uploads the code allowed at 25 MB; `.env` was copied into the deployed bundle six times; a server-only import broke the build after tsc, 52 checks and 6,109 tests passed (LRN s3, s4; RB C.4); in v2 a 2 MB reply broke the page (T/S13-requests.md 3) [verified].
- Cause: nothing ran the production build on the real host before a client did; platform limits were nobody's clause [inferred].
- Cost: blockers on the first live day; secrets inside a vendor's build artefact (LRN s3) [verified].
- Prevent: ALREADY IN PLACE: no hosting until go-live (here:decisions/0003 F-4), which moves all of this to go-live [verified]. MISSING [verified]: train journeys on the production build (`next build`, `next start`), not the dev server (card F00); a checker rule refusing redirects built from request.url (agent checker); a go-live walk on the real host that asks only "what differs here?", with the host's body, time and memory limits as clauses (a red amendment to blueprint 10).
### 8. Checks that could not see
- Happened: five checks passed for the defect they existed to catch (a `\b` written as a backspace byte, CSS patterns that never matched, a floor lowered from 80 to 50); files in a new `src/components` folder silently left four guards that walked `src/app` (LRN s3); in v2, forms outside the flow renderer refused input with no message (T/S13-requests.md 1, 2; S13-requests-r3.md 2; integration-2809.md 1) [verified].
- Cause: guards listed the folders and phrasings their authors knew; nobody watched them fail first [verified].
- Cost: false greens past thousands of tests; repeat findings after go-live [verified].
- Prevent: ALREADY IN PLACE: a planted fault per rule and tests that fail for the right reason (agent spec-writer 4, 5); a pass with zero tests fails (agent checker 3); mutation tests on changed core modules in every train (skill merge; card F00) [verified]. MISSING [verified]: rule sweeps list routes and modules from the tree, and a test fails when a new folder under `src/app` or `src/modules` is not walked. Where: a test in the shared-behaviour card (pattern 5).
### 9. "Done" was recorded by whoever did the work
- Happened: six times a feature was reported repaired and had not landed; status rows sat wrong for days (LRN s3) [verified].
- Cause: the claimant wrote the record [verified].
- Cost: repeated rounds and lost trust [inferred].
- Prevent: ALREADY IN PLACE: spec, build and check by three different workers, and the queue refuses a worker checking its own card (here:decisions/0001 R-3; here:tools/claim.mjs; agent worker); acceptance tests unchanged since the spec commit before boarding; a card turns done only when its train lands (skill merge); "A claim is not a fact" (here:CLAUDE.md) [verified].
### 10. Security was found late, or by luck
- Happened: v1's live walk found referral emails leaking client details and a self-referral discount bypass (RB C.4); v2's tester found any site could frame sign-in and one person's draft shown to another (T/S08-r2.md 10; S08-r2f.md 4); the Reviewer found no daily cap on emailed codes (REV); the one planned security review, on S03, caught a HIGH sign-in flaw before merge (B/S03-signin.md) [verified].
- Cause: security was checked on purpose only once [inferred].
- Cost: launch blockers and extra rounds; the planned review cost one round [inferred].
- Prevent: ALREADY IN PLACE: SEC clauses, and red for who-sees-what (here:blueprint/08-security.md; here:decisions/0002 red 4) [verified]. MISSING [verified]: a security review (Claude Code's /security-review, or a security pass by the checker) before any card boards the train if it cites SEC or AI-9 or touches sign-in, roles, logs or data leaving the system. Where: skill merge "Board the train" and agent checker.
### 11. Only one side of the test/live switch was ever run
- Happened: five senders, the chase engine and the health route each refused to work outside test mode, and intake left the test marker to a default of true; found only by searching the tree the week of the flip (LRN s4, 18 Sep) [verified].
- Cause: every test ran in test mode [verified].
- Cost: a near miss at launch and days of flip work [inferred].
- Prevent: ALREADY IN PLACE: live backends in code, switched off, and all twelve kinds against live backends at go-live (here:blueprint/09-architecture.md ARC-6; blueprint 10 LIVE-8) [verified]. MISSING [verified]: each adapter's live side is tested from the card that builds it, against an HTTP-level fake (v2's upload card did this for Google Drive, B/S07-uploads.md) [verified], with one switch per adapter that a test flips. Where: here:.claude/rules/code.md and the adapter cards.
### 12. Schema and code shipped on different clocks
- Happened: a "proposed" migration sat in the migrations folder and every test applied it (LRN s3); `npm run migrate` was auto-allowed (RR s4); a migration file move reached main untested and broke it for 75 minutes (REV); migration 0034 went on the live database before its code, so the next quote's insert would have failed; a hotfix went live first (APP-NOW; app `plan/TODO-ZO.md`) [verified].
- Cause: no rule tied a schema change to the code that uses it [inferred].
- Cost: a red main; a live defect window and a hotfix round [verified].
- Prevent: ALREADY IN PLACE: schema as files until go-live, and the push guard (here:decisions/0005 S-4; blueprint ARC-3; hook main-push-guard) [verified]. MISSING [verified] for go-live (LIVE-4): this system shares the client app's database, so before the one live migration, run every live query of both apps that touches shared objects against the new schema (EXPLAIN), or ship code first. Where: the go-live migration card and blueprint 10.
### 13. Parallel builders produced parts that did not fit
- Happened: v1 ran up to about forty builders: 2,114 commits, 435 merges, 367 branches, 97 worktrees (RB 3.3; LRN s3); "pieces that fit badly and cost more to merge than they saved" (RR s3 D2); in v2 generated files conflicted and `src/flow/screens.ts` drifted from its generator after hand edits (APP-NOW) [verified].
- Cause: shared files and generated outputs changed on many branches [verified].
- Cost: a merge agent, days of pruning, about 20 GB of worktrees (RR Q14, itself an estimate) [inferred].
- Prevent: ALREADY IN PLACE: each card owns its paths (here:tools/next.mjs, here:tools/scope.mjs); contracts first (here:decisions/0005 S-5); one job queue (here:tools/claim.mjs); trains that land only when green; workers added only while fewer than 1 in 5 merges conflict and trains stay green (skills merge, modes) [verified]. MISSING [verified]: "only the Lead regenerates generated files, at landing" lives only in here:reference/lessons.md 30; make it a CLAUDE.md rule, plus a test that regenerates each generated file and fails on any diff. Turbo's 36 cards at once makes this bite harder [inferred].
### 14. Unattended runs stalled, or needed Zo's hands
- Happened: a builder sat 9 hours on a permission prompt nobody saw (MEM zo-overnight-runs); Zo pasted cloud-task text three times and the first ran on the laptop, doing nothing (TDA 18, 19, 26); a merge to main waited on his word because the safety filter stopped it (TDA 52); he typed the preview passphrase and brought a Chrome window forward for the tester (TDA 49, 51, 57, 62); a "Pay now" click was refused (T/S11.md) [verified].
- Cause: steps needing a person or a permission surfaced at night [inferred].
- Cost: a lost night [verified]; by my count 13 of his to-do items from 24 to 28 Sep were machine chores (TDA 1, 2, 4, 18, 19, 26, 49, 51, 52, 57, 62, 63, 69) [inferred].
- Prevent: ALREADY IN PLACE: routines started by the Lead (skill dispatch); stale jobs released after 90 minutes (here:tools/claim.mjs; CLAUDE.md loop 7); builders stop after two refusals (agent builder); no hosting and no passphrase (decision 0003 F-4); on the first `turbo on`, one routine is fired and must claim a job "to prove the path" (skill modes) [verified]. MISSING [verified]: in prep, before 1 Oct, one rehearsal of the whole loop with nobody at the keyboard (local and cloud worker, spec, build, check, train run, landing and push to main, worktree removal, the Reviewer routine); every prompt it meets is fixed in here:.claude/settings.json. Proving the path on turbo day spends turbo's window on setup. Where: here:plan/NOW.md next list.
### 15. Tests touched real money and real systems
- Happened: a quote walk on the live site charged Zo CA$1.97 and started a CA$174 monthly subscription: "I thought you would never do that?" (17 Sep, MEM quote-site-live-stripe); test uploads left 30 files in the firm's Shared Drive (TDA 27) [verified].
- Cause: testing ran on live systems [verified].
- Cost: Zo's money, trust and clean-up items [verified].
- Prevent: ALREADY IN PLACE: made-up data only, no live systems, no paid services, each red (here:decisions/0003 F-1 to F-3; here:decisions/0002 red 2, 3, 5; here:.claude/rules/code.md) [verified].
### 16. Small questions stopped the build and wore Zo out
- Happened: the first overnight run asked 23 questions and every answer was "agree" (MEM ashbridge-critical-questions-only); "stop killing me over little things" (11 Sep, MEM zo-small-items-feedback); v2 still sent one-word wording and flow items (TDA 48, 50, 53, 54) [verified].
- Cause: anything not written down was treated as a question [inferred].
- Cost: Zo's attention and serial waiting [inferred].
- Prevent: ALREADY IN PLACE: green, amber, red; ambers tallied, never asked; at most 3 red open; workers never ask Zo anything (here:decisions/0002; here:plan/AMBER.md; agent worker) [verified].
### 17. The tester could not walk as a person
- Happened: early walks on headless Chromium reached 375 px and typed at human pace (T/S04.md, S07.md, S08.md); from S08-r2d the tester used a desktop Chrome window that would not resize, and from 27 Sep its tab ran hidden and it pressed buttons from page script: "this was not human pace and not phone width" (T/S11.md; also S12-int2, S13-requests to r5, family-returns-r2) [verified]. In v1 a restart lost five walks' findings held in memory (LRN s5) [verified].
- Cause: a browser extension on the laptop used as the test harness [inferred].
- Cost: walks that could not prove what they were for, and Zo's chores in pattern 14 [inferred].
- Prevent: ALREADY IN PLACE: Playwright in a cloud session, keyboard first, reload mid-way (agent tester) [verified]. MISSING [verified]: the tester appends each finding to its report as it goes, and types key by key on at least one field per form (filling hid two handler bugs, LRN s5) [verified]. Where: agent tester.
### 18. Status files went stale or sprawled
- Happened: v1 kept append-only logs of 187, 197 and 109 KB and a 25k-token cold start (RB 3.4); in v2 Zo read a stale to-do because the main checkout was left detached: "make sure this mistake is not repeated again" (26 Sep, MEM main-checkout-stays-on-main); CLAUDE.md lagged his words (REV 5) [verified].
- Cause: appending, and working in the checkout Zo reads [verified].
- Cost: tokens at every start; Zo misled [inferred].
- Prevent: ALREADY IN PLACE: rewrite, never append; NOW.md at 60 lines and true at every moment; hook now-is-current; the to-do's full path in every chat ending (here:CLAUDE.md) [verified]. MISSING [verified]: "the main checkout ends every step on main, clean" (the train steps check out other branches in it: skill merge). Where: a CLAUDE.md rule, checked by the Stop hook.
### 19. The laptop and the test harness gave false answers
- Happened: nine builders used 20 GB; uncapped test forks took up to 8 GB; orphaned servers held 12 GB and broke `npm ci`; a shared test-database cache in the OS temp folder was rewritten mid-gate and 178 files went red with no defect; CRLF endings broke a content hash; two tests passed by luck (time of day, a random byte) (LRN s3, s3a, s5) [verified].
- Cause: one machine, shared temp folders, no caps [verified].
- Cost: killed jobs, false reds, lost hours [verified].
- Prevent: ALREADY IN PLACE: here:tools/heavy.mjs and heavy_slots (skill modes); full suite and journeys in the cloud; clocks and seeds pinned, a flaky test is a failure (here:CLAUDE.md hard rules; here:.claude/rules/code.md) [verified]. MISSING [verified], in card F00 (here:plan/cards/F00.md): vitest `maxWorkers` capped for local runs; a private temp folder per test run; `.gitattributes` with `eol=lf` (git already warns LF will become CRLF in this repo).
### 20. Two documents told different stories
- Happened: the copy deck and the spec, drafted in parallel, disagreed on 46 sentences (LRN s2a); the v2 flow map contradicted itself on K4's closing page (T/S08-r2d.md 5) [verified].
- Cause: two sources for one truth [verified].
- Cost: red tests and wrong builds [verified].
- Prevent: ALREADY IN PLACE: the blueprint beats every document except decisions, and a clash is red (here:CLAUDE.md; here:decisions/0002 red 7) [verified].
### 21. Building more than was asked
- Happened: about 115k lines of code and 99k of tests for a ten-screen intake (RB B.1), judged 3 to 5 times a lean build (RB s4, an estimate there); onboarding, Q&A, recurring services, chasing and referrals before the first client (RR s3 D4); in v2 Zo reversed two added requirements: "Don't complicate." (AD 0003) and "don't build that in as a requirement" (AD 0016) [verified].
- Cause: agents add what looks safer or more complete [inferred].
- Cost: code to delete and rework rounds [inferred].
- Prevent: ALREADY IN PLACE: the checker fails anything the card did not ask for (agent checker 4); here:blueprint/11-not-building.md; the Reviewer's drift check (here:reviews/REVIEWER.md 1) [verified].
### 22. CI minutes burned by pushes that changed no code
- Happened: the suite and journeys ran on every push, documentation commits included, and used up GitHub's 2,000 free minutes; Zo paid overage, then CI sat blocked for days (MEM zo-github-actions-conservative; RB 3.1) [verified].
- Cause: workflows triggered by any push [verified].
- Cost: Zo's money and days with no CI [verified].
- Prevent: ALREADY IN PLACE: typecheck and unit tests only, a concurrency group per branch (card F00; decision 0007 Z-2) [verified]. MISSING [verified]: F00's trigger "every push to `claude/**`" also fires on every report push and on every here:tools/claim.mjs push to `claude/claims`, several per job [verified tool; inferred effect]; add `branches-ignore: claude/claims` and paths-ignore for reports/, plan/ and *.md. Also check the account's Actions budget before telling Zo "it stops, it does not charge" (here:plan/TODO-ZO.md item 2): the 24 Sep review asked him to raise it to about US$20 (RR s2) [inferred]. Where: card F00.
### 23. Metrics were written by hand, late or never
- Happened: the metrics lines for S01 to S08 have empty counts ("counts not recorded at the time") and S12 had no line when reviewed (MET; REV 6) [verified].
- Cause: the Lead wrote them from memory at close [inferred].
- Cost: the Reviewer could not judge rework or cost on the heaviest slices [inferred].
- Prevent: ALREADY IN PLACE: the dispatch ledger written by hook budget-guard, the claims history on `claude/claims`, and a metrics line with no empty field (skill merge) [verified]. MISSING [verified]: a tool that writes each card's line from the ledger, claims and reports when its train lands (for example `node tools/metrics.mjs <card>`), called by skill merge.

## 2. Zo's time

What consumed it:
- Walking the product and typing comments: about 137 in one v1 click-through (RB 3.2) and 21 in the v2 walk (MET S10); a walk "took him an hour and left him angry" (LRN s2) [verified].
- Relaying between long-lived chats: "that is where most of your plan went" (RR s3 D3) [verified].
- Questions: 23 in one night, all "agree"; Q156 to Q174 confirmed in one word (MEM); the v2 to-do reached item 80 in four and a half days (app `plan/TODO-ZO.md`; TDA) [verified].
- Machine chores that should never reach him: cloud pastes, a passphrase, a Chrome window, a merge permission, a live checkout click (pattern 14) [verified]; about 13 items in four days [inferred].
- Approvals worth his time: the flow map (45 min, 32 questions), the designs (45 min), six migrations, 0029 to 0034 (TDA; AD) [verified].
- Reading what he could not act on: a technical first review, a stale to-do, chat replies of 7 to 10 lines (MEM zo-plain-reviews; REV) [verified].

What he said [verified; files in sections 1 and 4]: "stop killing me over little things." (11 Sep); "You have used 50% of it within 24 hours ... This is not rocket science." (12 Sep); "Don't tell me that something is done. waste of my time." (17 Sep); "I thought you would never do that?" (17 Sep); "how are you making such silly and dumb mistakes?" and "Come on man. This is so basic and universal." (24 Sep); "'Next' is not clear. I am not technical." (26 Sep); "make sure this mistake is not repeated again." (26 Sep).

Rules that protect it here [verified]: red questions only, at most 3 open, ambers tallied (here:decisions/0002); comments become tests with no follow-up questions (here:decisions/0001 R-4); three-section to-do that explains itself, 3-line chat, full path (here:CLAUDE.md; decision 0007 Z-10); beyond red answers he types only short codes (`turbo on`, `turbo off`, `pause`, `go`, `review`, and `work` in extra cloud sessions if he likes) and may clear chats any time (skill modes; decision 0007 Z-4, Z-5); routines, not pastes (skill dispatch); no hosting or passphrase (decision 0003 F-4); one design look for all screens (card D11); progress page optional (skill merge). Still missing: the prep rehearsal (pattern 14) and main-on-main (pattern 18).

## 3. What worked (keep it)

1. Three independent passes before every merge (checker, tester, full cloud run); the one push that skipped them then got a guard (REV) [verified]. Kept: three workers per card and green trains (decision 0001 R-3; skill merge) [verified].
2. Each Zo comment became a rule test on every screen; his high comments fell from 3 to 0 between S10 and S11 (REV; MET) [verified]. Kept: CLAUDE.md loop 6 [verified].
3. The flow map and designs approved before building; v2 went live in 4 days against about 14 planned (REV) [verified]. Kept: blueprint first, designs in one sitting before screens (decision 0001 R-1; RV-53) [verified].
4. An independent read before building: v1's review of the whole flow confirmed 86 findings in 72 minutes, where nine builders had lost a day on uncorrected briefs; the v2 flow map check found 22 problems (LRN s2a; TDA 15) [verified]. Size it by area, not by finding (LRN s2b) [verified]. Kept: the design review folded into the blueprint (here:decisions/0006) [verified].
5. Delegation with a tally: "make the decisions and close this out, keep a tally" took v2 live the same day (AD 0013) [verified]. Kept: here:plan/AMBER.md [verified].
6. One Lead with short-lived helpers that write a file and return 10 lines; no peer chats, no agent teams (AD 0002 V2-18) [verified]. Kept: CLAUDE.md roles; workers stop after 4 jobs (agent worker) [verified].
7. The three-section to-do and 3-line chat endings with the full path (MEM zo-todo-three-sections, zo-todo-full-path) [verified]. Kept: decision 0001 R-7 [verified].
8. NOW.md rewritten and guarded by a Stop hook; a push guard on main after the 75-minute red (REV; AD 0015) [verified]. Kept: hooks now-is-current and main-push-guard [verified].
9. Decisions as never-edited files quoting Zo's words (AD 0002 to 0020) [verified]. Kept [verified].
10. A fixed set of client kinds walked end to end each slice, with a seeded demo client per kind (app `plan/BRIEF.md`; AD 0005 V2-38) [verified]. Kept as the twelve return kinds (END-9) [verified].
11. The full suite and journeys in the cloud, started by the Lead through a routine, not by Zo (APP-NOW) [verified]. Kept: skill dispatch; no journeys on GitHub (decision 0007 Z-2) [verified].
12. Headless browser walks worked where the desktop browser did not (pattern 17) [verified]. Kept: agent tester on Playwright [verified].
13. Builders who checked the brief's premise found it wrong more than once (LRN s3) [verified]. Kept: agent builder step 4 [verified].

## 4. Zo's explicit preferences (honour these)

- "I only answer red questions. not green or amber." and "I would like for you to make executive decisions where you can." (28 Sep, here:decisions/0002) [verified].
- "I don't want to be actively involved." "It only asks me questions that are blueprint altering." "I like the current setup." (28 Sep, here:decisions/0001) [verified].
- "We keep this build free." (28 Sep, here:decisions/0003) [verified].
- Turbo is his switch: "there needs to be a code or something for me to unleash this otherwise normal usage"; "remember you are just setting up, don't start the turbo plan right now." (28 Sep, here:decisions/0007); parallel work is "my choice, not default" (28 Sep, AD 0015) [verified].
- Cloud, not GitHub, for journeys: "don't run github journeys. the journeys can be run on claude cloud." (28 Sep, decision 0007); "use the cloud sessions as much as possible" (28 Sep, decision 0004) [verified].
- "I also want to be able to clear Lead and reviewer just like this one." (28 Sep, decision 0007): everything must survive a clear [verified].
- "make sure we are following same formatting and Gov.uk rules wherever applicable" (28 Sep, decision 0007); the approved design is the build basis: "I have approved this before. This got ignored." (24 Sep) [verified].
- "I do tell Lead to go all night when I sleep so don't take that away from me." (26 Sep, MEM zo-overnight-runs) [verified].
- Recommendations, not options; act on them and let him reverse in one step; raise a small item once (LRN s1; MEM zo-small-items-feedback, 11 Sep); "I am not having to discuss this again" (LRN s1) [verified].
- One list: "that is the only chat I read" (17 Sep); three sections (25 Sep); "Don't tell me that something is done." (17 Sep) (MEM) [verified].
- Chat: at most 3 short plain lines, one of the four endings, then the to-do's full path (24 and 26 Sep, app CLAUDE.md) [verified].
- Plain words: "what are the problems. what is the solution and who can implement the solutions? explain in simple language." (26 Sep, MEM zo-plain-reviews); short sentences, decisions first, honest pushback, no grade inflation, "I don't know" when unsure, facts apart from inference (24 Sep, RB s1); "Pushback if I am wrong." (24 Sep, RB App. D) [verified].
- No em dashes anywhere (app and here CLAUDE.md) [verified].
- He reviews on a phone and would rather watch than walk; browser video or screenshots, never GIFs: "GIFs did not work for me" (17 Sep) (LRN s1; MEM zo-no-gifs) [verified].
- No requirements he did not ask for: "Don't complicate." (25 Sep, AD 0003); "you can advice, which you already do, but don't build that in as a requirement." (28 Sep, AD 0016) [verified].
- When away: "make the decisions and close this out, keep a tally." (27 Sep, AD 0013) [verified].
- GitHub Actions: "Use it conservatively."; no scheduled or per-branch workflow without his word (17 Sep, MEM zo-github-actions-conservative) [verified].
- Never touch live money: the quote site is live Stripe (17 Sep, MEM quote-site-live-stripe) [verified].
- "Never stack fix branches" (26 Sep); metrics with no empty field (27 Sep) (app CLAUDE.md) [verified].
- Fight the logic before building: "have the agents fight the logic first, so what you build is 90% ready and then the walks can help." (11 Sep, LRN s2a) [verified]. Offer process improvements before he has to find the gap himself (LRN s1) [verified].
