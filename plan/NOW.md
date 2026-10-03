# NOW

True at every moment. 60 lines max. Last rewritten: 2 Oct 2026 21:58Z by the Lead. Critic proposals of 2 Oct evening approved and applied (0024: compaction at 200k with reload hook, CQ2 item 6, layouts before W21; A387). Auto-fill notes in (0023); next fold O8 into FINDINGS.md, CK-12 and RT-14. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 15:30Z, after the Reviewer SLOW of 14:40Z). Wind-down Fri 9 Oct 18:00 Toronto. Plan use 17:37Z: 5h 3% (new window), week 45%. Blueprint v1.2.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`); runs cannot notify, so poll `node tools/claim.mjs list` (ScheduleWakeup 15 to 20 min). Laptop: up to 2 local workers (0018), non-core jobs only; node_modules is installed in the main checkout. None running now.
- **Landed (42):** F00, F05, F08, DG, DG2, A05, W14, W15, F03, F00T, F05M, F09, TH, F03R, D01, D00, D00L, F09B (with F09A), E03, F04, FX1, G01, CQ1, F01D (with F01 and F01C), G10, G11, queue repairs. E03A, BL0, A01, F02. F06, F07. G12 to G16. A07C (split, A384). A03, G17. Last train 3c3de19 (landed 21:08Z; guard listed design/map/navigation.md, a doc, A388).
- **Zo today:** decisions 0020 (design sitting 1 accepted, viewer B by the Lead A358, his logo, CRA walks off git with data-free copies in reference/cra/) and 0021 (one gitleaks line for fact names in tests; Zo made the edit himself on claude/E03A, 0462739, because the permission system blocks agents from editing .gitleaks.toml).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| W00c spec, A08 spec, CQ2 check, A06 check (then fresh security review) | queue | cloud | 2 Oct 21:05Z to 21:35Z | claude/<card> |
| SC spec round (A03's ocr/recorded R34, R47; build held), A07D build, W16 spec | 3 cloud runs | cloud | 2 Oct 21:43Z | claude/<card> |

## Next, in order

1. Poll claims; board every PASS: scope, GitHub checks green, Opus read for core (when a check's Opus read was refused, run one before boarding). One train at a time (plan/train.json); land by merging main into the train, code guard, push local main first so the ff works.
2. After a spec reports, reopen the held build (`update <card> build reopened --worker lead`); after a released check, re-stamp the build (`update <card> build reported --worker <builder>`) until the CQ1 follow-up lands.
3. W00c (split from W00a, A379, A380): spec, build, check; after it lands merge it into claude/W00b and re-run W00b's 242 tests, then W00b build. S00, B04, JH0, SK0, W01 to W13, W20, I40 now wait on W00c; SC2 (rules R57 to R61) after W00c.
4. A06 round 2: spec reopened, then build, then a fresh security review before boarding. New cards: SC3 (security rules R62 to R66, after A06 and FX2), FX2 (A01 and A05 refuse unset engines in production). After A06 lands: reopen the A04 round 2 spec (reports/A04-findings.md, A391; card directive), then build; SC5 (R71 to R73) after A04.
5. CQ2 carded (the CQ1 follow-up, items 1 to 6). W16, T08, Q00, Q01, I01, I30, I40 carded (A389, A390); phase 3 cards get an independent card review before their first spec.
6. Designs: fix cards from reports/design-retest-2026-10-01.md (Q1 to Q8) into the approved versions, then D02 to D13 copy them into design/screens/ (design lane, A352; claim.mjs now honours `lane: "design"`).
7. Taxprep: day 4 Zo Sat 3 Oct (Auto-fill); day 6 Sun 4 Oct.
8. Critic about every two days from Sat 3 Oct; Reviewer daily.

## Splits today (last rounds)

Evening: W00a to W00c (A379), A07C to A07D (A384; no more rounds, fallbacks are removals); new rule cards SC2 (R57 to R61), SC3 (R62 to R66, security), SC4 (R67 to R70).

F09A to F09B (landed), F01 to F01C to F01D (landed), W00 to W00a and W00b (A364), A07 to A07B to A07C (A366, A368). Each split card has a landing rule: new edge cases outside its named classes go to SC as rule tests (SC now lists rules up to R55).

## Watch out

- The permission system refuses edits to `.gitleaks.toml` for every agent; any change there goes to Zo by hand (0021).
- No real client data: Assets/ (Zo's CRA walks) is excluded from git (.git/info/exclude); never commit it.
- Cloud boxes need Node 24.21 or later (24.11 has a windows-1252 bug); see .claude/cloud-worker-run.md.
- Network to GitHub drops now and then: retry a push up to three times.
- Landing: never `rebase --rebase-merges` a train; merge main in; never force-push; delete a held red train branch before pushing a new one.
- Findings review before every fix round; a single-cause gap may go straight back (A306); a third failure parks or splits.
- Never weaken redaction, permissions or security checks to pass a test (A329); never route a refused edit through another worker.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time, window visible.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`. Critic and Reviewer sessions commit to main too.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/ straight to main.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
