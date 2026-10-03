# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 12:45Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 2 Oct 15:30Z; again `turbo on` 3 Oct 03:20Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 53% of the week at 03:18Z. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). RemoteTrigger works again (03:20Z). Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 3 local workers, any job (Zo, 3 Oct, decision 0026; heavy_slots 2).
- **Landed (54):** through FX10 (train 12af2528), then DB16 (train 65f59a22 green on pg16 16.14, landed 12:15Z as dc36b33d). Train df6f1249 (FX15, CQ7, CQ6) requested 12:35Z.
- **Zo 2 Oct evening:** "Critic ok" (decision 0024, applied: compaction at 200k with reload hook, raised to 300k by 0025, CQ2 item 6, layouts before W21, A387 one record for every role). Auto-fill notes in (0023). To-do part 1 empty.

## In flight

| Card | State | Next action |
|---|---|---|
| W00c | spec rows 1 to 9 in (5c8d8469); owner-rule ruling (A467) for rows 2 and 11 | spec finishes, build round 3, mutation on cloud, check |
| W00b | spec round 4 after W00c lands (A423: 6 tests, merge refit); build after W00c and FX8 | spec, build, check, security review |
| FX8 | round 2 spec reported (a9dd4aa3 on claude/FX8-r2, 19 tests, README 556) | build on a cloud box (LF), check; before W00b's build |
| SC6 | spec reopened (A408); depends on W16 | spec, build, check |
| Train | 25ea2736 red on A04 (clock mix, A468); FX15, CQ7, CQ6 on df6f1249, requested 12:35Z | check; land |
| SC3 | second spec patch reported (68 tests, A458) | Opus re-check, security review, board |
| S00, FX5 | builds open (A410) | build, check |
| A04 | findings 6: one clock (A469), round 5c in-round; CQ10 carded, R105 R106 to SC12 | spec (Opus), build, check, security read, train |
| SC11, GL3 | DB16 landed: SC11 spec refit open (cloud); GL3 build reopened (pg16 run, R41 fix) | SC11 build; GL3 check |
| JH0, S00, B04, SC2 | JH0 and S00 specs refit; B04 and SC2 specs working | builds after W00c lands |
| FX4 | spec patch reported (40 tests, A434); build waits for SC | SC lands, known.json patch, build |
| SC6 | W16 landed: spec open (Where: cloud) | spec, build, check |
| FX12, FX14, FX15, FX17 | FX15 off core, round 1 PASS stands, boards (A465); FX12, FX17 specs refit | FX12 build; FX17 build |
| CQ6, CQ8, CQ9, SC10, A08 | CQ6 spec patch in, build round 2 open; CQ9 spec reported; CQ8 build; SC10 spec working; A08 after A04 lands | builds, checks |

Cloud runs: 4 fired 12:47Z (train df6f1249 first, then W00c build, SC11, FX17, FX12 builds). Local: local-1 CQ8 build, local-2 FX8 build, local-3 CQ10 spec (each claims its named job with `update`, never `next`).

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
