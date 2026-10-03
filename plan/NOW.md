# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 04:55Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 2 Oct 15:30Z; again `turbo on` 3 Oct 03:20Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 53% of the week at 03:18Z. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). RemoteTrigger works again (03:20Z). Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 3 local workers, any job (Zo, 3 Oct, decision 0026; heavy_slots 2).
- **Landed (44):** through A07C, A03, G17, then A07D and A06 (train 25bde2a, 04:04Z, A405). No train in flight; the next one runs test:flake.
- **Zo 2 Oct evening:** "Critic ok" (decision 0024, applied: compaction at 200k with reload hook, raised to 300k by 0025, CQ2 item 6, layouts before W21, A387 one record for every role). Auto-fill notes in (0023). To-do part 1 empty.

## In flight

| Card | State | Next action |
|---|---|---|
| W00c | round 2 spec patch reopened (A413: 4 gaps); build held | spec, build, check; unblocks W00b, JH0, B04, SC2 |
| W00b | spec round 3 working (cloud, A409); build waits on W00c and FX8 | spec review, then build after both land |
| FX8 | spec reported (non-core); build working (cloud) | check, board |
| W16 | fixup spec reported; Opus re-review (with SC) running, build held | GO: reopen build |
| SC6 | spec reopened (A408); depends on W16 | spec, build, check |
| SC | spec reported (105 rule tests, exact KNOWN); Opus review running, build held; FX7 Paths widened (A412) | GO: reopen build; check with Opus read and test:flake |
| SC3 | spec reported (security) | build, check, security review |
| SC4 | build reported; check working (local-3) | board |
| S00, FX5 | builds open (A410) | build, check |
| A04 | spec round 3 working (local-1, A410) | spec review, build, check, security review |
| DB16 | spec round 2 working (local-2, A411); an early cloud build claim voided | spec review, build, check on Postgres 16 |
| FX2 | check FAIL (scope, mutation dry run); Opus findings review running | fix round from reports/FX2-findings.md |
| CQ2 | on the train (claude/train a5d6dba0), boarding | request the train at 6 cards or 05:30Z, with test:flake |
| JH0 | spec reported | build after W00c lands |

Cloud runs: 4 at 04:28Z, 2 at 04:46Z, 3 at 04:55Z. Local: local-1 (A04 spec), local-2 (DB16 spec), local-3 (SC4 check), Opus. npm ci done 04:45Z.

## Next, in order

1. Poll claims; board every PASS (scope by hand while scope.mjs prints 0 files for some branches: CQ2 rewrites it); request the train hourly or at 6 cards.
2. W00c lands, then W00b (merge W00c in, re-run its 242 tests), S00, JH0, B04, SC2. SK0, W01 to W13, W20, I40 follow.
3. FX2 and A04 round 2 specs, then SC3, SC5 (R71 to R73); DB16.
4. Phase 3 cards reviewed and fixed (A397); FX5 new. Still to write: the 22 `todo` cards `node tools/next.mjs` lists (X00, X01 carded 3 Oct, A395; V02 V03 V04 V09 next).
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
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
