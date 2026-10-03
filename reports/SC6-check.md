# SC6 check (cloud-165f9c) on claude/SC6 77d11040: FAIL

Passed: typecheck, lint, deps:check, scope clean, npm test (unit, then db on PGlite: 662 passed, 1 expected fail, 5 skipped), 111 of 111 spec-rules tests. No `@mutate` files. pg16 and e2e not run (no db or screen code). KNOWN empty. Landing form (live, SC6 done, every card done) gives 0 scan problems in the Opus read's in-memory simulation.

## Failures (Opus adversarial read, each reproduced with in-memory copies of the rule functions)
1. G2, spec-rules.test.mjs:404-405 vs :387-388: the verbs that start a fresh clause lack modify, touch and refresh (modify and touch are in the editing-verb list). In a Build section "Never edit verify.mjs, and modify README.md counts." gives no failure; same for "; touch ..." and "; refresh ...". The same with "rewrite" fails correctly.
2. G2, :395: only the exact "never/not/n't forget|fail to" forms are exempt from negation. "without forgetting to update <file>", "never failing to update <file>" and "do not ever forget to update <file>" are dropped with no failure. The plant "don't forget to rewrite <file>" (:1491) already fails under round 1's rules, so it does not fail first.
3. G6 c, :856-862: "any git call naming main or master fails" misses `git diff main~1`, `main^`, `master~2`, `heads/main`; and `execSync('git init -q && git diff --quiet main ...')` is exempt as a whole because its first subcommand is init.
4. G6 a, :950-955 with :804-814: any string starting "git init" counts as an init call and mkdtemp counts inside a string. A test with mkdtempSync, describe('git init flow (Test)') and git diff origin/main on the real repo is exempt. The check at :2051 uses the same reader, so it proves nothing. No file on main is wrongly exempt today (all 12 have a real init call).

Weak points (not graded): G3 is judged per sentence, so another clause can name the job ("Rewrite README.md counts, then the checker reruns it."); "the spec review" and "spec commit" read as naming the spec job. Grammar coverage checks the reader against itself and cannot fail on live cards except a "Who does what" heading; "Goldens:", "**Build**:", "## Specification" go unnamed (a scan of 262 open cards found no missed label with bullets). Label words (:340) lack specs, spec-writer, goldens, fixture. A blank line or wrapped bullet ends a label's reach. "Rewrite README.md counts that the spec did not update." is dropped.

Fix list for the findings review: add modify, touch, refresh to fresh-clause verbs; extend the forget/fail exemption to forgetting, failing, "not ever"; make the main/master check cover ~N, ^, heads/main and read each git command in a shell chain separately; count init only in a real git call and mkdtemp only in code.

Rule candidate: a plant for a grammar item must fail under the previous rules first, and each list of verbs must be derived from one shared list, not copied.

Model: Sonnet 5.5 checker; adversarial read by an Opus subagent (its own report file was refused by the protect-spec hook; the text is above). Permission gaps: Opus subagent could not Write /tmp/sc6-opus.md (hook), not retried another way.
