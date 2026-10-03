# A04 spec review, round 3 (Opus, cold, 3 Oct)

Spec: claude/A04 at fb82b8c (98 unit tests in `runner.acceptance.test.ts`, db file unchanged at 5), report reports/A04-spec.md on the branch. Read against plan/cards/A04.md (A410, A418), reports/A04-spec-review-2.md, `.claude/rules/testing.md`.

## Verdict: GAPS (2 tests, 1 report fix). Gaps 1 and 3 to 7 of round 2 are closed by class; gap 2 is closed except the A418 log, which the spec's own amber R3-3 contradicts.

## The 7 round 2 gaps
1. Report: closed. Rounds 2 and 3 have fails-first per test (20 fail, 78 pass) and a `mutate:changed` run on a stub; the branch card names fb82b8c.
2. Malformed recording: fail closed is closed (`{`, empty, `null`, `[]` beside the good one and alone, the handler, notes.txt never read, plus round 2's stray top-level key). **Not logged: see G1.**
3. Blank folder at the engine: closed for `undefined`, `''`, `'   '` with planted writes, and at `useEngine` (line 416). Loophole: see G2.
4. Stamp check through the project engine and the handler: closed (four parts, each named alone, the other value never echoed).
5. logOnce on changed content: closed (same bytes not again, new bytes again, never content or folder path).
6. Every AI setting through env.ts: closed (loop over `AI_SETTING_NAMES`; the round 2 `process.env` scan stops a bypass).
7. Duplicates: closed and matches A418 (different answers and identical copies refuse, both names alone, neither answer used; another key's duplicate does not block; the shipped folder has none).

## A418 match
- Duplicates refuse even when identical: yes. Any non-result outbox file logged once by name whatever its extension: yes (notes.txt; round 2's folder named x.json). Output-check refusal names AI-1: yes.
- Malformed recording skipped AND logged once by name with the reason: **no.** No test asserts the log, and amber R3-3 ("it is not logged") and "For the build" ("the malformed-recording skip") point the builder at a silent skip. No test asserts it is not logged either, so no assertion has to change.

## Gaps (each a test to add)
- **G1 (A418) A malformed recording is logged once by name with the reason.** Loop over each kind: `{` holding a planted canary, empty, `null`, `[]`, a stray top-level key, a key part of the wrong type, and a folder named `a-dir.json` (the unreadable-entry branch). Each beside the good recording on a runner with a sink: the step resolves ok, and `lines` holds exactly one line naming that file plus `ai step finding: ok`; the line has a reason (unparseable vs not one recording are told apart) and never the canary, the stray value or the recordings folder path. A second `runAiStep` on the same runner adds no line for that file (once); rewriting the file with other bad bytes logs it again (the outbox's name-and-content rule, fix 3; amber, reverse by dropping this assert). Also: the missing-folder test (line 715) and the notes.txt test (line 1129) get a sink and assert `lines` is exactly `['ai step finding: refused']` (a missing folder or a non-JSON file is not a malformed recording). Update the file header "one log line per call" to say flagged files add one line each.
- **G2 The engine's blank-folder refusal resolves, never throws.** The `.catch` at line 879 turns a throw into a result, so a builder who throws `Error('AI_EXCHANGE_DIR is not set')` passes. Assert `await expect(aiEngines.project.run(...)).resolves.toMatchObject({ ok: false })` with the reason naming the setting (keep the planted writes).
- **Report fix:** rewrite amber R3-3 to A418 (skipped and logged once by name with the reason) and add "log each malformed recording" to "For the build".

## The 15 mutation survivors (stub, not the build)
- **11 true equivalents** (rewrite or reasoned disable): `'utf8'` to `''` four times (engines twice, runner, schemas `update`; Node reads `''` as the default utf8 and JSON.parse takes a Buffer); the inbox file's trailing `'\n'` (the golden compares canonical JSON); the `''` text key of an unreadable outbox entry; runner `catch { return 'unreadable' }` emptied, `s === undefined` in `blank`, `dir === undefined ||`, and the two `if (x !== undefined)` before `jobId` and `exchangeDir` (redundant guards; fold into one check).
- **4 are missing tests once A418 is built, not equivalents:** the recordings `existsSync ? readdir : []` fallback to `["Stryker was here"]` and the three `catch { continue }` blocks emptied. Today they are absorbed silently; with G1's exact log lines and the missing-folder sink assert they die. The builder must not disable them.
- The real gate is the build's own `mutate:changed -- A04` at 100 on engines.ts, runner.ts, schemas.ts and env.ts (`--force` before writing up a static-line survivor, A418).

## For the Lead
- Main's card still says `Spec commit: (spec-writer fills)`; the branch says fb82b8c. Set it on main, or the checker diffs against nothing.
- With the outbox `.json` filter dropped, a launcher that writes `<id>.json.tmp` inside `outbox/` gets each temp file logged once. Add to A08: write temp files outside `outbox/`, then rename in.
- After G1 and G2 (a short spec job; no other assertion changes), the build opens. Then the db test on PGlite and a fresh `/security-review`.
