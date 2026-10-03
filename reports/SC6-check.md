# SC6 check, round 3 (cloud-725535)

FAIL. Typecheck, lint, deps:check clean; spec-rules 168/168; tools/test 725/725; scope OK; no @mutate files. Opus adversarial read found 6 fail-open forms inside the stated grammar (below, from reports/SC6-check-opus.md).

Permission gaps: none. Model: Sonnet 5.5 runner, Opus subagent for the read.

# SC6 check (Opus, adversarial), round 3 spec patch on claude/SC6 (d245511c)

Verdict: FAIL. Suite: 168/168 pass. Fixes 1 to 11 each have their tests and plants as the A518 directive says (checked one by one; fix 11's report is reports/SC6-spec.md "Round 3"). The failures are new forms inside the stated grammar that the reader drops (fail-open). Probes: /tmp/claude-0/sc6probe/probe77.mjs and probe78.mjs (they import a copy of lines 129 to 1210 of the test file, reader.mjs).

## Failures

1. tools/test/spec-rules.test.mjs:478-479, 486 (NEG_STATE). "no change(s) to", "stays as it is" and "is out of scope" negate the whole clause wherever they stand, not only before its first verb (fix 2: "the negation must come before the clause's first verb"; RC-A: drop only on an adjacent form). In a Build section these pass R77 with no finding:
   - "Rewrite README.md counts with no changes to verify.mjs."
   - "Rewrite README.md counts so the table stays as it is."
   - "Rewrite README.md counts where the old table is out of scope."
   The first one also passes in a round directive (it should be ambiguous).
2. :501-503, 559, 564 (SPEC_OWNS). A spec hand-over matches anywhere in a clause and takes every VERB_FORMS word after "spec", including the noun forms fix 1 added (changes, fix, edits, run, list, record, set). A build order then reads as "spec-owns": in a Build section it passes, and in a round directive it counts as named. This contradicts the header (:66-67: a job word anywhere else "names nothing"; "counts the spec job left stale" is the given example). Forms:
   - "Rewrite README.md counts the spec job wrote." / "... the spec wrote."
   - "Rewrite README.md counts after the spec changes land."
   - "Fix README.md counts the spec fix broke."
   - "Rewrite README.md counts so the spec job runs green."
   - "Rewrite README.md counts the spec's tests read." (the 's (files|lines|counts|tables|tests) branch)
3. :355-358, 502 (fix 5's spec nouns). The possessive skips the noun list. "The spec's commit rewrites README.md counts." in a round directive reads as named, so it does not fail as ambiguous. That is fix 5's plant "The spec commit rewrites README.md counts." with "'s" added. Cause: NOT_SPEC_NOUN checks only right after "spec", and "commit" is a VERB_STEMS stem.
4. :488 (first verb). A clause whose real verb is outside VERB_STEMS, followed by a negated participle, reads as negated and is dropped. Examples: "Correct README.md counts not updated in round 2." and "Recount README.md rows never refreshed." This is the fix 2 plant "Fix <file> counts the spec did not update" with a verb outside the list. The header's "a negation after the first verb negates nothing" fails as soon as the first word is a verb missing from the list. The literal reading of the header's grammar ("first VERB_FORMS word") allows it, but the rule fails open.
5. :991 (shellSegments) and :964-967 (callWords), R78 fix 8. Words split only at separators that stand alone or end with ";". A shell string with a glued separator stays one segment with subcommand init, so its main ref is let through: execSync('git init -q&&git diff main') and execSync('git init -q;git diff main'). A ref in shell quotes keeps its quotes and does not match MAIN_REF: execSync('git diff --quiet "main" -- x') and execSync("git diff --quiet 'main' -- x"). All four pass r78 on a sample-data checker. The pipe case 'git init|git diff main' is caught only by accident (the subcommand reads as "init|git").
6. :1111 (initCalls, fix 9). `exec(` is matched after a dot, so RegExp.prototype.exec counts as child_process exec. A file with fs.mkdtempSync(...) and /^git (\w+)/.exec('git init -q') is exempt and reads origin/main unscanned. The header says "any other string is no call".

## Word lists (item 3 of the brief)
- Fix 1 (VERB_STEMS and inflect for the negation, own-verb and SPEC_OWNS verbs) and fix 6 (LABEL_WORDS and JOB_WORD from JOB_WORDS) derive as required. NEG_VERBS, OWN_VERB and NOT_NEG are gone.
- Drift left (not in the fix list; RC-B "where else"): NOUN_CONT's determiners (:498: the, a, an, its, their, this, that, any, every) against DETERMINERS (:477, which adds each and one). Job words are still written by hand in START_BUILD, START_SPEC, START_CHECK, BY_JOB, BY_BUILD, BY_CHECK, SPEC_BULLET, BUILD_BULLET and SPEC_OWNS (for example, START_SPEC does not take "specs", and BY_BUILD does not take "builds"). These drifts fail closed, so they are notes for SC7's rule test (A), not failures.

## Notes (fail-closed or outside the stated grammar)
- :482-483 words(): a curly apostrophe ("Don’t regenerate README.md.") is not a negation, so it fails R77. This is a false red, not a fail-open.
- "then" and "or" do not split clauses, so "Never edit verify.mjs then rewrite README.md counts." is dropped whole. This matches the stated split list, but the Lead may want "then" added.
- A string that does not start with "git " ("cd x && git diff main") is no git call to R78, yet initCalls reads "cd x && git init" as an init. The two readers are not symmetric. This is within the stated definition.
