# NOW

True at every moment. 60 lines max. Last rewritten: 2 Oct 2026 14:10Z by the Lead (loop). Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, decision 0018). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 07:15Z: 5h 1% (new window), week 31%.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`), up to 6 runs. Runs cannot notify: poll `node tools/claim.mjs list` (ScheduleWakeup ~30 min). Laptop: up to 2 local workers (0018); they have no subagent tool, so core specs and checks go to the cloud (A331). None running now.
- **Zo:** to-do #1 design sitting at http://localhost:8765/ (python http.server from the session scratchpad `sitting` folder; if it is down after a reboot, the bundle must be rebuilt: designer helper from the four `claude/design-*-2` branches, see reports/findings-designs-2.md "For Zo"). Day 4 (Auto-fill, Zo) Sat 3 Oct. Decisions 0016 to 0019 today; blueprint v1.2 (0019: preparer pastes the diagnostics list).
- **Landed (21 done):** F04, E03, F09B (with F09A's work), DG2, D00, DG, F03R, D01, TH, F00, F05, F08, DG rounds 1 and 2, A05, W14, W15, F03, F00T, F05M, F09, queue repairs 1 to 3. Reviewer HOLD lifted.

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Train: G01 | train check | cloud | 2 Oct 14:10Z | claude/train |
| W00 build round 2; D00L build; SC spec; A01 spec round 3 | cloud runs | cloud | 2 Oct | claude/<card> |
| 2 local workers (Zo asked; non-core jobs, 0018) | worker | laptop worktrees | 2 Oct 14:25Z | claude/<card> |
| W00 check, F01C build; A07 spec round 2 (A360); W01 to W04 specs | cloud runs | cloud | 2 Oct 14:25Z | claude/<card> |
| Queue: F01C spec then build (F01 split, A359; 13 cards wait on it), BL0 build (waits F01C), G10, G11 builds (wait G01), A03 build | cloud runs | cloud | 2 Oct 14:10Z | claude/<card> |

S00 build waits on W00 (A354); U00 and D02 to D13 in the design lane (A352). CRA walk copies on main in reference/cra/ (originals off git).

## Next, in order

1. Poll claims; board every PASS (scope, GitHub checks, Opus read for core): F09B, DG2, D00, E03, F01; then W00 round 2, A01, S00. After a spec fix reports, reopen the held build (`update <card> build reopened --worker lead`) or the queue stays empty. One train at a time via plan/train.json; land by MERGING main into the train, code-diff guard, ff main; record only after the push.
2. W00 round 2 (A353): spec reopened; reopen the build after its spec reports AND DG2 lands (DG2 is new, after DG). Zo has an open question in chat on the logo copied to reference/brand (A350); keep it unless he says remove.
3. F09B landed: F04, A01 round 2, A07 builds now; then I00, E01, A07, W20, SK0.
4. W00 check 8 CRLF: decided A347 (W00 build owns .gitattributes line and the taxprep CSVs).
5. Taxprep: day 6 Sun 4 Oct (changes after lock, check export, roll forward, copy one full diagnostics panel); day 4 Zo Sat 3 Oct.
6. Designs: sitting 1 answered (decision 0020, A358 viewer B). Next: fix cards from the retest findings (reports/design-retest-2026-10-01.md Q1 to Q8) into the approved versions, then the D cards copy the approved versions into design/screens/ (design lane, A352). D00L puts Zo's logo on the basis.
7. B01 spec (reference/qbo/gfi-file.md, A305). W16 card to write (W14 KNOWN R8 fails on 03, 04, 07, 08, 10). SC grows: R23 to R31 (reports/findings-wave2.md, findings-F03R-r2.md).

## Watch out

- Landing: never `rebase --rebase-merges` a train; merge main in. Pushing a train straight to main is refused.
- Findings reports: subagents cannot write report files; record their text under reports/ yourself. Findings review before every fix round; a single-cause gap may go straight back (A306); a third failure parks or splits.
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time, window visible. QBO and iFirm sign out: a walker stops at a sign-in page; ask Zo.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`. Critic and Reviewer sessions commit to main too.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/ straight to main.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
