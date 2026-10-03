# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 06:40Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 2 Oct 15:30Z; again `turbo on` 3 Oct 03:20Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 53% of the week at 03:18Z. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). RemoteTrigger works again (03:20Z). Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 3 local workers, any job (Zo, 3 Oct, decision 0026; heavy_slots 2).
- **Landed (46):** through A07C, A03, G17, A07D, A06, then CQ2 and SC4 (train 677e92f green with test:flake 5 of 5, landed 05:52Z as edd3af05). No train in flight.
- **Zo 2 Oct evening:** "Critic ok" (decision 0024, applied: compaction at 200k with reload hook, raised to 300k by 0025, CQ2 item 6, layouts before W21, A387 one record for every role). Auto-fill notes in (0023). To-do part 1 empty.

## In flight

| Card | State | Next action |
|---|---|---|
| W00c | spec patch reported (A413); build open (A424) | build round 2, check; unblocks W00b round 4, JH0, B04, SC2 |
| W00b | spec round 4 after W00c lands (A423: 6 tests, merge refit); build after W00c and FX8 | spec, build, check, security review |
| FX8 | findings done (A417): round 2 on claude/FX8-r2 after W16 lands | spec, build, check; before W00b's build |
| W16 | build reported on claude/W16-r2 | check (scope by hand, A427); then SC6, FX8, FX9 |
| SC6 | spec reopened (A408); depends on W16 | spec, build, check |
| SC | build reported (110 of 110) | check on a cloud box (npm test, db, test:flake) with Opus read |
| SC3 | spec reported (security) | build, check, security review |
| S00, FX5 | builds open (A410) | build, check |
| A04 | round 4 spec reported (26 tests, 11 fail); build open (A427) | build runner.ts, check, security review |
| DB16 | check FAIL (two core db files lack @mutate; scope note); Opus findings review running with CQ4 | fix list, round, check, board |
| FX2 | spec refit reported; build open | build (one auth line), check, security review; lands before FX7 |
| JH0 | spec reported | build after W00c lands |
| FX10 | spec reported (cause: timeouts; 6 tests split into 22) | build, check, security review |
| CQ3, CQ4 | CQ3 build reported, check working (local-3); CQ4 check FAIL (R82 flags files named in Spec prose), findings review running | board CQ3; CQ4 fix round |

Cloud runs: 3 at 05:56Z, 2 at 06:16Z, 3 at 06:38Z. Local (Opus): local-1 (FX4 spec), local-3 (CQ3 check), local-2 done. Helper: DB16 and CQ4 findings review. The CQ2 landing set off toolchain refits on every reported spec: for the Critic, refit only when a spec's own commands changed.

## Next, in order

1. Poll claims; board every PASS (scope by hand while scope.mjs prints 0 files for some branches: CQ2 rewrites it); request the train hourly or at 6 cards.
2. W00c lands, then W00b (merge W00c in, re-run its 242 tests), S00, JH0, B04, SC2. SK0, W01 to W13, W20, I40 follow.
3. FX2 and A04 round 2 specs, then SC3, SC5 (R71 to R73); DB16.
4. V02, V03, V04, V09, V13 drafted (A421): independent card review with the other phase 3 cards before their first spec; V15 to write. Phase 3 cards reviewed and fixed (A397); FX5 new. Still to write: the 22 `todo` cards `node tools/next.mjs` lists (X00, X01 carded 3 Oct, A395; V02 V03 V04 V09 next).
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
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
