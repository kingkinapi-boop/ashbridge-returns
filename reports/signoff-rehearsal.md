SIGNED OFF, with three conditions the Lead must meet before the first run past 3 (each takes minutes)

Cold sign-off: queue repairs 1 and 2 and the small-width rehearsal (F00 to main). Opus, fresh, 2 Oct 2026. Read: CLAUDE.md, skills dispatch/merge/modes, cloud-worker-run.md, tools/claim.mjs, lib.mjs, tools/test/queue.test.mjs, the queue-repair, F00 and train reports, A245 to A253, metrics, NOW.md, train.json, decisions 0009 and 0010, `claim.mjs list`.

Evidence the loop works
- [verified] F00: spec, build and check by different cloud workers over 3 rounds; a separate Opus security review; findings review 3 grouped root causes and added rule tests through a spec job; cloud train cloud-a33104 green at da59ba0 (unit 89/89 incl. 23 queue tests, db 2/2, e2e 1/1, flake 5/5, canary 100).
- [verified] What landed is what was checked: `git diff da59ba0 5a70f12` touches only plan/ and reports/, with no change under src, tools, package files or .github. claude/train, claude/F00 and the train worktree are gone.
- [verified] Every cloud job report says "Permission gaps: none". The owner check, hold-findings and the dep gate work in live claims (W14 FAIL held; S00/S01 held for deps).

Before widening (Lead)
1. [verified] A core card is offered for build on a void spec right now: F03's spec claim is still `reported` (commit d6807e5), so `next` hands out its build (one worker already released it: "spec still void"). Fix: `node tools/claim.mjs update F03 spec reopened --worker lead`. Then the dispatch skill says every re-card runs `spec reopened`.
2. [verified] The check job is never re-offered after a reopened build if the last check PASSED: claim.mjs line 203 skips when the old check is `reported`, and isActive counts `reported` as active. This hits every red train and every security finding, not only F00. It is only in NOW.md, which gets rewritten. Fix: card "queue repair 3" (Lead writes it; spec, build and check by workers): offer a check when `ck.for !== b.at` unless it is `working`, plus a test (reopen after PASS, new build reported, check offered). Put the A247 RPC fix, the parked-dep check test and the A253 shellProblems regex in the same card.
3. [verified] Landing cannot follow the merge skill: `merge --ff-only origin/claude/train` always fails, because the train checker pushes train.json and its report to main (A249). So every landing needs a hand rebase. Fix: the merge skill (Lead, now) says to rebuild the train merge on current main, then refuse to push unless `git diff --name-only <checked head> <new head>` lists only plan/, reports/ and the other doc paths.

Soon after widening
4. [verified] The mutation score moved between runs on the same code (check 74.43, ids.ts 36; train 75.00, ids.ts 45), and the break is 70. Findings review 3 asked for two runs and nobody did them. [inferred] Expect red trains that are noise as more core files join. Fix: the Lead has the next train checker run mutate:changed twice and report the spread, then sets the margin (amber).
5. [verified] The dispatch skill still says `claude --cloud "work"` and "No routines" (decision 0008), but decision 0010 and NOW use one-off RemoteTrigger runs. A Lead coming back after a clear could follow the wrong one. Lead edits the skill.
6. [verified] The F00 metrics line has tokens 0 and minutes 0, which are not real measurements. Record "unknown" or measure them from the run list.

Nothing else.
