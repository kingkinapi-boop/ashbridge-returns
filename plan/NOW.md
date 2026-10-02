# NOW

True at every moment. 60 lines max. Last rewritten: 2 Oct 2026 07:16Z by the Lead at handover (Zo's `handover`). Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, decision 0018). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 07:15Z: 5h 1% (new window), week 31%.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`), up to 6 runs. Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup ~30 min). Laptop: up to 2 local workers (0018); they have no subagent tool, so core specs and checks go to the cloud (A331). None running now.
- **Zo:** to-do #1 design sitting at http://localhost:8765/ (python http.server from the session scratchpad `sitting` folder; if it is down after a reboot, the bundle must be rebuilt: designer helper from the four `claude/design-*-2` branches, see reports/findings-designs-2.md "For Zo"). Day 4 (Auto-fill, Zo) Sat 3 Oct. Decisions 0016 to 0019 today; blueprint v1.2 (0019: preparer pastes the diagnostics list).
- **Landed (12 done):** F00, F05, F08, DG rounds 1 and 2, A05, W14, W15, F03, F00T, F05M, F09, queue repairs 1 to 3. Reviewer HOLD lifted.

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| F09A check (build round 2: mutation 100 both files) | cloud run | cloud | 2 Oct 07:12Z | claude/F09A |
| F04 spec round 2 (page citation, strict schemas) | cloud run | cloud | 2 Oct 07:12Z | claude/F04 |
| Queue: TH check (round 2 build, gitleaks clean), F03R spec round 3 (last), DG build round 3, D01 build, W00 and D00 builds, A01 build round 2, S00 build round 3 (waits F03R and DG), F01 build | cloud queue | cloud | 2 Oct | claude/<card> |

No local helpers running. Stale worktrees under .claude/worktrees (agent-*): check `git worktree list`; remove clean ones (junction first with node fs.rmdirSync).

## Next, in order

1. Poll claims; board every PASS (scope, GitHub checks, Opus read for core): TH first (it fixes the gitleaks red step, A312 ends), then F09A, DG round 3. One train at a time via plan/train.json; land by MERGING main into the train, code-diff guard, ff main; record only after the push.
2. F03R round 3 is its last (card "Round 3"): fail only on B3 lands B1+B2; fail on B1 parks F03R and S00.
3. After F09A lands: F04 build, A01 build round 2, F01 build; then I00, E01, A07, W20, SK0.
4. W00 spec says check 8 needs a CRLF gitattributes fix: read reports/W00-spec.md on claude/W00 and decide (amber).
5. Taxprep: day 6 Sun 4 Oct (changes after lock, check export, roll forward, copy one full diagnostics panel); day 4 Zo Sat 3 Oct.
6. Designs: Zo's sitting answers (Q1 to Q7) into decisions and fix cards; then D00, D01, D05.
7. B01 spec (reference/qbo/gfi-file.md, A305). W16 card to write (W14 KNOWN R8 fails on 03, 04, 07, 08, 10). SC grows: R23 to R31 (reports/findings-wave2.md, findings-F03R-r2.md).

## Watch out

- Landing: never `rebase --rebase-merges` a train; merge main in. Pushing a train straight to main is refused.
- Findings reports: subagents cannot write report files; record their text under reports/ yourself. Findings review before every fix round; a single-cause gap may go straight back (A306); a third failure parks or splits.
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time, window visible. QBO and iFirm sign out: a walker stops at a sign-in page; ask Zo.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`. Critic and Reviewer sessions commit to main too.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/ straight to main.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
