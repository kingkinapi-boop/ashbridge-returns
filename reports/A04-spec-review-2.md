# A04 spec review, round 2 (Opus, cold, 3 Oct)

Spec: claude/A04 at 439aa70 (29 tests added to `runner.acceptance.test.ts`, one reason added to the no-job-id test). Read against plan/cards/A04.md, reports/A04-findings.md (fix list, tests to add), reports/A04-check.md, engines.ts and runner.ts, `.claude/rules/testing.md`.

## Verdict: GAPS (7). Every "Tests to add" item is present and honest, but the round has no report, the card is stale, and four classes are left open.

The 10 failing first match fixes 2, 4 and 5 (three unreadable lists, env.ts, the process.env scan, cleared and changed after the switch, the outbox folder, the default sink, the strict recording). The 19 passing are real regression guards: each kills a named round 1 survivor (runner 81, 105-106; engines 38, 83, 93-94, the waiting set, the finally delete, the pollMs default, the log line, versions, the thrown message, inputHashOf on null and arrays). None passes by construction, except the harmless `expect(LISTED_NOT_APPROVED).not.toBe(LIST_UNREADABLE)` (two constants; drop it). Fake timers are pinned; the real-timer waits are bounded and end in an outcome assertion, so they can weaken but not flake.

## Gaps (each with what to add)
1. **No round 2 spec report, and the card points at the old spec.** reports/A04-spec.md stops at round 1; the card still says `Spec commit: 9d97dd0`, so the checker would read the 397 new lines as builder edits. Add a round 2 section: each of the 10 with its first failing assertion, each of the 19 with the survivor line it kills, and `npm run mutate:changed -- A04` on the round 1 build plus the new tests with every remaining survivor listed (the findings asked for this). Update the card line to 439aa70.
2. **A malformed recording crashes the runner (fail closed by class).** engines.ts:40 calls `JSON.parse` outside the `safeParse`, so one `{` file rejects the whole step. Add: a folder holding `a-bad.json` (`{`) and the good recording runs on the good one; `a-bad.json` alone gives "re-record" with the three key parts; a `notes.txt` in the folder is never read; `runAiStep` resolves in every case.
3. **Blank exchange folder at the engine.** The no-folder test covers `undefined` only; `exchangeDir: ''` writes to `./inbox` today (the RC3 hazard). Loop the test over `undefined`, `''`, `'   '`: refused naming AI_EXCHANGE_DIR, no `writeFileSync` or `mkdirSync`, no `./inbox`.
4. **The stamp check by engine.** The four stamp-part tests run on the recorded engine only. Add the same four through the project engine (the fake writes an outbox result F04-valid but stamped with another model id, prompt version, prompt hash or input hash): refused naming that part only, and through the handler the job throws with it.
5. **logOnce keys on name and content (fix 3), but no test changes the content.** Add: a stranger file logged once over many polls, then rewritten under the same name with new content, is logged a second time, by name only, no content.
6. **Every AI setting through env.ts.** Add: for each name in `AI_SETTING_NAMES`, `readSettings({ [name]: 'x (Test)' })[name]` is `'x (Test)'` (a later setting cannot skip env.ts; R71 is the everywhere rule).
7. **Duplicate recordings.** engines.ts:38 sorts and takes the first match, so the `.sort()` is an untested branch. Pin it: two recordings with the same key and different answers refuse with "two recordings for one key" naming both files (a flag for a person), or the Lead orders the sort dropped as in fix 3.

## For the Lead (before the build opens)
- Fix 1 was not applied: card Paths still omit `src/core/env.ts`, yet the env.ts test needs AI_EXCHANGE_DIR in env.ts. Add it to Paths (A06 has landed; FX2 order per the findings), or the build fails scope.
- Gap 7 is amber: choose refuse or drop; I recommend refuse.
- After the build: mutation 100 on engines.ts, runner.ts, schemas.ts and env.ts (two settings now make env.ts's disable killable), the db test rerun on PGlite, then the fresh `/security-review`.
