# NOW

True at every moment. 60 lines max. Last rewritten: 3 Oct 2026 13:26Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, "turbo on" 13:26Z, after the Reviewer's SLOW of 13:15Z; findings 1, 2, 5, 8 done 13:25Z, A477; Reviewer's "apply all" fixes in, b783ae76). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 69% of the week (Critic 13:00Z).
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims). Laptop: up to 3 local workers (decision 0026; heavy_slots 2).
- **Landed (54):** through DB16 (train 65f59a22, 12:15Z as dc36b33d). Train df6f1249 (FX15, CQ7, CQ6) checking (cloud-9e54a6). Red reports 1103 and 1221 now on main.
- **Zo 3 Oct, Critic chat:** "critic ok" (decision 0027, applied 13:15Z): design lane restarts; CQ11; no new repair card before W00c lands without a red or a measured waste.

## In flight

| Card | State | Next action |
|---|---|---|
| Train | df6f1249 (FX15, CQ7, CQ6) checking | land if green; FX5 (PASS) boards the next one |
| W00c | spec reported (A467 owner rule); build round 3 open (cloud) | build, mutation on cloud, check |
| A04 | split and frozen at the 5c spec (A477); build round 5c open, its last | build, check, security read, train; A04C after |
| A04C | carded (G1 to G4, draft on claude/A04C-draft) | spec after A04 lands |
| W00b, A08 | wait for W00c and FX8; A08 for A04 | spec, build, check |
| FX8 | round 2 spec in; build reopened (cloud box, LF) | build, check |
| SC3 | build reopened to run the 68 spec-patch tests | build, check, security review, board |
| SC11, SC12 | specs reopened: R107 R108 (A476); R104 to R106 (A466, A469, A472, A474) | specs, builds |
| GL3, GL2 | GL3 findings 1: spec test, then build round 2 (A476); GL2 gains G1 G2 | GL3 spec, build, check |
| FX4 | spec patch in (A470); build reopened | build, check |
| FX12, FX14, FX17 | FX12 check working (cloud); FX14 spec working; FX17 build open | checks, builds |
| CQ8, CQ9, CQ10, CQ11 | CQ8 check local-4; CQ9 build after CQ6; CQ10 spec local-2; CQ11 carded | check, builds, spec |
| SC10 | spec reported; build after CQ6 lands | build, check |
| SC6, FX3, SC8 | waits met: SC6, FX3 specs and SC8 build reopened (A477) | specs, build |
| JH0, S00, B04, SC2 | wait for W00c | builds after W00c lands |
| Design lane | plan reports/design-lane-2026-10-03.md (A475) | base branch claude/design-base and brief re-check now; then designers D13 with D04, D03, D02; sitting Tue 6 Oct |

Local: local-2 CQ10 spec, local-4 CQ8 check; then `npm ci` in the main checkout.

## Next, in order

1. Poll claims; land the train if green; board FX5 and every PASS; request a train hourly or at 6 cards.
2. W00c lands, then W00b, S00, JH0, B04, SC2; SK0, W01 to W13, W20, I40 follow.
3. Design lane jobs; cloud runs for the open builds; Reviewer's open items (claim.mjs check-name rule, metrics fields, next.mjs offers) to CQ11, `expect.hasAssertions()` and a G-family sample sweep carded.
4. Phase 3 and 4 card fixes (A437, A438, A447); go-live reds wait for the go-live questions.
5. Taxprep: fold O8 into FINDINGS.md, CK-12 and RT-14; day 6 Sun 4 Oct.
6. Critic about 5 Oct; Reviewer daily. Read the top of reviews/CRITIC.md each loop (0024).

## Watch out

- The permission system refuses edits to `.gitleaks.toml` for every agent; changes go to Zo by hand (0021). Cloud boxes lack gitleaks; GitHub checks run it.
- No real client data: Assets/ is excluded from git; never commit it.
- Cloud boxes need Node 24.21 or later; see .claude/cloud-worker-run.md.
- Local workers: a fresh name per dispatch (local-6 next; Review 3 Oct finding 4); `update` cannot hand a reopened job to a named worker (CQ11), use `next --roles`. They have no subagent tool: start them with model opus so they can do core specs and checks themselves (Sonnet ones release core jobs). They cannot run `cmd //c rmdir`: the Lead removes each worktree's node_modules junction, then the worktree. The main checkout's node_modules lacks `pg` (since DB16): run `node tools/heavy.mjs -- npm ci` in the main checkout when no local worker is running, before firing more (`npm install` is refused; never route around it).
- claim.mjs drops the Lead's reopen note on specs (CQ2 item 5): put a bold directive at the top of the card.
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
