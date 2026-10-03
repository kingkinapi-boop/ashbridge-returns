# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 03:22Z by the Lead (Zo's `turbo on` 03:20Z; mode already turbo). Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 2 Oct 15:30Z; again `turbo on` 3 Oct 03:20Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 53% of the week at 03:18Z. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). RemoteTrigger works again (03:20Z). Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 3 local workers, any job (Zo, 3 Oct, decision 0026; heavy_slots 2).
- **Landed (44):** through A07C, A03, G17, then A07D and A06 (train 25bde2a, 04:04Z, A405). No train in flight; the next one runs test:flake.
- **Zo 2 Oct evening:** "Critic ok" (decision 0024, applied: compaction at 200k with reload hook, raised to 300k by 0025, CQ2 item 6, layouts before W21, A387 one record for every role). Auto-fill notes in (0023). To-do part 1 empty.

## In flight

| Card | State | Next action |
|---|---|---|
| W00c | spec round 2 (cloud) per reports/W00c-findings.md (A403) | build round 2, check; unblocks W00b, JH0, B04, SC2 |
| W00b | refit spec reported (278 tests); Opus spec review running, build held | GO: reopen build after W00c lands |
| W16 | round 2 spec on claude/W16-r2 reported; Opus spec review (with SC6) running, build held | GO: reopen build |
| SC6 | spec reported; review running, build held | GO: reopen build |
| SC | check FAIL (KNOWN too broad); Opus findings review running | fix list into card, then spec or build |
| SC4 | spec refit on a cloud box (laptop lacks ExcelJS); KNOWN owners FX4, FX6 (A406) | build, check |
| S00, FX5 | specs reopened for review gaps (A402); FX5 spec by local worker 2 | build after spec |
| FX2 | spec reported (not core); build open | build, check |
| A04 | spec round 2 open | spec, build, check, security review |
| CQ2 | check in the cloud | board |
| JH0 | spec reported | build after W00c lands |
| DB16 | carded (A405) | spec |

Cloud runs fired 03:22Z: 6, plus 1 at 03:43Z for the train (now checking), 3 at 03:50Z for W00c spec, S00 spec, SC check (RemoteTrigger trig_01MWQ7hW5yecn8VaiMTq1xbp). Poll claims at the wake-up.

## Next, in order

1. Poll claims; board every PASS (scope by hand while scope.mjs prints 0 files for some branches: CQ2 rewrites it); request the train hourly or at 6 cards.
2. W00c lands, then W00b (merge W00c in, re-run its 242 tests), S00, JH0, B04, SC2. SK0, W01 to W13, W20, I40 follow.
3. FX2 and A04 round 2 specs, then SC3, SC5 (R71 to R73); DB16.
4. Phase 3 cards reviewed and fixed (A397); FX5 new. Still to write: the 22 `todo` cards `node tools/next.mjs` lists (X00, X01 carded 3 Oct, A395; V02 V03 V04 V09 next).
5. Designs: fix cards Q1 to Q8 from reports/design-retest-2026-10-01.md, then D02 to D13 (design lane, A352).
6. Taxprep: fold O8 (Auto-fill, reference/taxprep/2026-10-04-day4/) into FINDINGS.md, CK-12 and RT-14; day 6 Sun 4 Oct.
7. Critic about every two days (next about 4 Oct); Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Splits (last rounds)

W00a to W00c (A379), A07C to A07D (A384; no more rounds), rule cards SC2 (R57 to R61), SC3 (R62 to R66, security), SC4 (R67 to R70), SC5 (R71 to R73). Each split card has a landing rule: new edge cases go to SC cards as rule tests.

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
- Findings review before every fix round; a third failure parks or splits.
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
