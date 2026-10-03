# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 11:55Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 2 Oct 15:30Z; again `turbo on` 3 Oct 03:20Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 53% of the week at 03:18Z. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). RemoteTrigger works again (03:20Z). Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 3 local workers, any job (Zo, 3 Oct, decision 0026; heavy_slots 2).
- **Landed (53):** through FX2, then SC, CQ4, CQ5 and FX10 (train 12af2528 green: unit 2703, db 587, flake 5 of 5, FX10 db x20 20 of 20; landed 10:52Z as 6ca8b48f). Train (DB16) requested 11:25Z.
- **Zo 2 Oct evening:** "Critic ok" (decision 0024, applied: compaction at 200k with reload hook, raised to 300k by 0025, CQ2 item 6, layouts before W21, A387 one record for every role). Auto-fill notes in (0023). To-do part 1 empty.

## In flight

| Card | State | Next action |
|---|---|---|
| W00c | spec patch A459 in; main merge needs SC rule rows (A463: no Zo question) | spec merges main and fixes rows, build round 3, mutation on cloud, check |
| W00b | spec round 4 after W00c lands (A423: 6 tests, merge refit); build after W00c and FX8 | spec, build, check, security review |
| FX8 | round 2 spec reported (a9dd4aa3 on claude/FX8-r2, 19 tests, README 556) | build on a cloud box (LF), check; before W00b's build |
| SC6 | spec reopened (A408); depends on W16 | spec, build, check |
| Train | 26e84345 red on R18 (fixed by A461) and blocked on pg16 and mutation (refused); rebuilt with DB16 alone, requested 11:25Z (A462) | check on pg16; land; SC11 and GL3 follow |
| SC3 | second spec patch reported (68 tests, A458) | Opus re-check, security review, board |
| S00, FX5 | builds open (A410) | build, check |
| A04 | lint fix in; main merged: R41 flags .trim() in engines.ts and runner.ts (A461) | build round 5b (contracts/text.ts), check, security review |
| DB16, SC11, GL3 | DB16 PASS, CLEAN; SC11 spec reported (39 tests, A453 in); GL3 build waits for DB16 on main (pg16) | board DB16 next train; SC11 build; GL3 pg16 re-run, check |
| JH0, S00, B04, SC2 | JH0 and S00 specs refit; B04 and SC2 specs working | builds after W00c lands |
| FX4 | spec patch reported (40 tests, A434); build waits for SC | SC lands, known.json patch, build |
| SC6 | W16 landed: spec open (Where: cloud) | spec, build, check |
| FX12, FX14, FX15, FX17 | FX15 build round 2 (@mutate on jobs/runner.ts, A461); FX12 build open; FX17 spec reported | builds, checks |
| CQ6 to CQ8, SC10, A08 | CQ6 build in, spec patch for the real setup path (A464); CQ7 build reported; CQ8 spec reported; A08 waits for A04 | CQ6 spec, build; CQ7 check; CQ8 build |

Cloud runs: about 6 since 10:58Z (train DB16, A04 and FX15 builds, specs). Local: none; local workers only for a named local job until CQ8 lands (claim.mjs offers Where: cloud jobs to them).

## Next, in order

1. Poll claims; board every PASS (scope by hand while scope.mjs prints 0 files for some branches: CQ2 rewrites it); request the train hourly or at 6 cards.
2. W00c lands, then W00b (merge W00c in, re-run its 242 tests), S00, JH0, B04, SC2. SK0, W01 to W13, W20, I40 follow.
3. FX2 and A04 round 2 specs, then SC3, SC5 (R71 to R73); DB16.
4. Phase 3 and 4 cards reviewed and fixed (A437, A438, A447: 28 fixes, cpa-check items 34 and 35). N19, GL2 to GL6 carded (A448). Go-live reds (SEC-9, LIVE-3, LL-8, amended-return client view) wait for the go-live questions.
5. Designs: fix cards Q1 to Q8 from reports/design-retest-2026-10-01.md, then D02 to D13 (design lane, A352).
6. Taxprep: fold O8 (Auto-fill, reference/taxprep/2026-10-04-day4/) into FINDINGS.md, CK-12 and RT-14; day 6 Sun 4 Oct.
7. Critic about every two days (next about 4 Oct); Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Watch out

- The permission system refuses edits to `.gitleaks.toml` for every agent; changes go to Zo by hand (0021). Cloud boxes lack gitleaks; GitHub checks run it.
- No real client data: Assets/ is excluded from git; never commit it.
- Cloud boxes need Node 24.21 or later; see .claude/cloud-worker-run.md.
- Local workers have no subagent tool: start them with model opus so they can do core specs and checks themselves (Sonnet ones release core jobs). They cannot run `cmd //c rmdir`: the Lead removes each worktree's node_modules junction, then the worktree. The main checkout's node_modules lacks exceljs and pdfjs-dist (SC check released 03:47Z): run `node tools/heavy.mjs -- npm ci` in the main checkout when no local worker is running, before firing more (`npm install` is refused; never route around it).
- claim.mjs drops the Lead's reopen note on specs (CQ2 item 5): put a bold directive at the top of the card.
- Code guard at landing lists design/ docs too (A388): a doc-only path is not a reason to re-check.
- Mutation bar is 100 per `@mutate` file (testing.md, ARC-15; agent orders fixed, A391).
- Network to GitHub drops now and then: retry a push up to three times.
- Landing: never rebase a train; merge main in; never force-push.
- Findings review before every fix round; a third failure parks or splits (split cards carry a landing rule: new edge cases go to SC cards).
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`.
- Commit no new Taxprep CSV to main before FX9 lands (SC's R37, A415).
- A job released twice at one tip is held "needs Lead": re-release a check with a note starting "wait:", reopen a spec or build (07:40Z). Local workers skip Where: cloud cards (FX10, SC6): tell them to leave those untouched.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
