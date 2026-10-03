# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 03:25Z by the Lead at handover (Zo's `handover`). Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 2 Oct 15:30Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use about 52% of the week at 21:10Z. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). At 03:16Z the RemoteTrigger tool dropped out of the Lead session; if it is missing after `go`, workers cannot be fired: say `Blocked` only if it stays missing after a fresh session. Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 2 local workers (0018), non-core only. None running now.
- **Landed (42):** through A07C, plus A03 and G17 (train 3c3de19, 21:08Z; A388). No train in flight (plan/train.json landed).
- **Zo 2 Oct evening:** "Critic ok" (decision 0024, applied: compaction at 200k with reload hook, CQ2 item 6, layouts before W21, A387 one record for every role). Auto-fill notes in (0023). To-do part 1 empty.

## In flight (no cloud run is working; all jobs below are reported or held)

| Card | State | Next action |
|---|---|---|
| A07D | build reported, check PASS (Sonnet); Opus read: 5 findings in reports/A07D-opus-read.md | Lead decides before boarding (A07D has no more rounds: a fallback is a removal, A384) |
| W00c | build reported: 1975 of 1975, mutation 100; Paths fixed (A392) | check job; then merge W00c into claude/W00b, W00b spec, unblock S00, JH0, B04, SC2 |
| A06 round 2 | build reported, check PASS (PG16 parity not run) | fresh `/security-review` on claude/A06, then board; then FX2 spec (held on A06), then A04 round 2 spec |
| SC | spec reported (R34, R47 for A03 recorded); build reopened 03:20Z | build, check, board |
| CQ2 | check FAIL on scope only (2 files outside Paths, reports/CQ2-check.md) | add the files to Paths if they test CQ2's own code (amber), re-stamp build, re-offer check |
| A04 | held: round 2 (reports/A04-findings.md, A391, card directive) | reopen spec after A06 lands; then build, check, security review |
| W16 | spec reported (KNOWN emptied, 5 R8 fail) | build |
| A08 | spec reported (71 tests; A04 must read A08 refusal files) | build after A04 lands |

## Next, in order

1. Poll claims; fire cloud runs for open jobs (W00c check, SC build, W16 build, A06 security review via a local Opus helper). Board every PASS: scope, GitHub checks green, Opus read for core. One train at a time; land by merging main into the train, code guard, ff main.
2. A07D Opus read: decide each finding (fix only by removal, else SC4 rule or FX card), then board.
3. W00c lands, then W00b (merge W00c in, re-run its 242 tests), S00, JH0, B04, SC2. SK0, W01 to W13, W20, I40 follow.
4. A06 lands, then FX2 spec, A04 round 2 spec, SC3, SC5 (R71 to R73).
5. Phase 3 cards T08, Q00, Q01, I01, I30, I40 rewritten (A390): an independent card review before their first spec. Still to write: the 22 `todo` cards `node tools/next.mjs` lists.
6. Designs: fix cards Q1 to Q8 from reports/design-retest-2026-10-01.md, then D02 to D13 (design lane, A352).
7. Taxprep: fold O8 (Auto-fill, reference/taxprep/2026-10-04-day4/) into FINDINGS.md, CK-12 and RT-14; day 6 Sun 4 Oct.
8. Critic about every two days (next about 4 Oct); Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Splits (last rounds)

W00a to W00c (A379), A07C to A07D (A384; no more rounds), rule cards SC2 (R57 to R61), SC3 (R62 to R66, security), SC4 (R67 to R70), SC5 (R71 to R73). Each split card has a landing rule: new edge cases go to SC cards as rule tests.

## Watch out

- The permission system refuses edits to `.gitleaks.toml` for every agent; changes go to Zo by hand (0021). Cloud boxes lack gitleaks; GitHub checks run it.
- No real client data: Assets/ is excluded from git; never commit it.
- Cloud boxes need Node 24.21 or later; see .claude/cloud-worker-run.md.
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
