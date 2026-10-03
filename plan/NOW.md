# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 03:22Z by the Lead (Zo's `turbo on` 03:20Z; mode already turbo). Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 2 Oct 15:30Z; again `turbo on` 3 Oct 03:20Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 53% of the week at 03:18Z. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). RemoteTrigger works again (03:20Z). Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 3 local workers, any job (Zo, 3 Oct, decision 0026; heavy_slots 2).
- **Landed (42):** through A07C, plus A03 and G17 (train 3c3de19, 21:08Z; A388). Train claude/train 25bde2a requested: A07D, A06.
- **Zo 2 Oct evening:** "Critic ok" (decision 0024, applied: compaction at 200k with reload hook, raised to 300k by 0025, CQ2 item 6, layouts before W21, A387 one record for every role). Auto-fill notes in (0023). To-do part 1 empty.

## In flight

| Card | State | Next action |
|---|---|---|
| A07D, A06 | on train claude/train 25bde2a (A393, A396: A06 security review CLEAN) | train requested 03:42Z (plan/train.json; A06 db tests on PG16 too); cloud run fired to take it | land when green (skill merge) |
| W00c | findings review done (reports/W00c-findings.md); spec reopened for round 2 (A403) | spec, build round 2, check; it unblocks W00b, JH0, B04, SC2 |
| S00, FX5 | spec review GAPS (11, 7); specs reopened (A402) | spec, then build (the wait: build releases clear when the spec reports) |
| JH0 | spec reported (Paths + testworld/harness, A401) | build |
| SC | build reopened | cloud run |
| W16 | check FAIL (spec contradicts card on ARC-16, R11); Opus findings review running | card or spec fix, then build round 2 |
| CQ2 | rule 6 spec and build round 2 reported (no code change needed) | check (cloud), then board |
| SC4 | startable (A07D built) | spec, then FX4 |
| A04, A08 | held on A06, then A04 | as before |
| Local workers 1 to 3 | started 03:38Z; worker 1 restarted on Opus 03:42Z (Sonnet released core specs) | re-fire on Opus while the queue has jobs; Lead removes junctions |

Cloud runs fired 03:22Z: 6, plus 1 at 03:43Z for the train (now checking), 3 at 03:50Z for W00c spec, S00 spec, SC check (RemoteTrigger trig_01MWQ7hW5yecn8VaiMTq1xbp). Poll claims at the wake-up.

## Next, in order

1. Poll claims; board every PASS (scope by hand while scope.mjs prints 0 files for some branches: CQ2 rewrites it); request the train hourly or at 6 cards.
2. W00c lands, then W00b (merge W00c in, re-run its 242 tests), S00, JH0, B04, SC2. SK0, W01 to W13, W20, I40 follow.
3. A06 lands, then FX2 spec (unhold it), A04 round 2 spec, SC3, SC5 (R71 to R73).
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
