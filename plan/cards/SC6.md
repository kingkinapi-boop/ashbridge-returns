# SC6 Card and verify rules R77 and R78

**Lead directive, 3 Oct 15:04Z (A493): round 2 is a spec patch on claude/SC6, eight fixes from the SC6 findings review (3 Oct, Opus; its report stayed on the laptop, A493, so this directive is the whole brief); the build has nothing (Paths hold only spec files); then an Opus check graded against the reach stated here.** Root causes: guards keyed to card names that move on main without a train (landing traps); detection by spelling with the reach left open; work outside Paths.
1. Merge origin/main; validate on it and on scratch merges of the CQ8 and CQ11 tips.
2. Guards: read every card (family templates with params) for the sentinel and the floors, fail by id a card with no source file, and filter to open cards only after that. Plants: pinned statuses with SC6 done still pass; a pinned open card with no file fails.
3. R78 reach by class: a test that builds its own repository (mkdtemp and git init in the file) is exempt; every other test and every checker over sample data is scanned. SELF is the one named entry; the three tool entries go (they are never scanned). List files with `git ls-files --cached --others --exclude-standard`, never a disk walk (it differs by machine and enters the excluded Assets/ folder). Plants: a temp-repo test reading origin/main passes; the same lines without the repo fail. This replaces A408's named list.
4. R77 closed grammar, stated in the test file's header and kept here: headings count at any level; a bold Lead directive is one unit, and its header's job word (spec patch, round or fixup; build round) owns its sentences; in a "round N" directive, a sentence that names a spec-owned file must name its job, or it fails as ambiguous; sentences split after ".**", "**" and ": "; job words are (re)build(s), builder(s), "the build", a trailing "(build)" and a clause with "by the build". Anything else is out of reach by design: scope.mjs R82 and the protect-spec hook catch it at check time. Plants: the six forms of check item 2, the real directive form ("**Lead directive, 3 Oct 10:10Z (Annn): round 2 ....** The build changes README.md"), check item 3.
5. Standing owners: `*.acceptance.*` and `__golden__/**` files belong to the spec job with no Spec mention; R77 fails a build order naming one and R81 counts them as owned; a folder named in Spec owns the files in it. Plants: check items 9 and 4 (folder).
6. R81 drops negated Spec clauses before counting ownership. Plant: check item 6.
7. R78 reads each call, not each line, and adds refs/, FETCH_HEAD, ORIG_HEAD, @{N}, show-ref, for-each-ref, describe, grep and archive; "same as (on) main" and "versus main"; hex literals of 40 characters or more and sha256- or sha512- base64 literals. A line starting with `*` is a comment only inside /* */. Out of reach by design: refs through variables or wrappers, and split literals (FX8's history-free run covers sample data). Plants: check items 7 and 8.
8. Rerun R77 and R81 on all open cards and R78 on all files, and paste the lists in the report. KNOWN stays empty.
File: the rules move to tools/test/spec-rules.test.mjs and tools/test/__fixtures__/spec-rules/** (git mv): SC10 owns tools/test/card-rules.test.mjs, built and in check (A493). R77 and R81 cite ARC-12 (the builder never edits the spec's files); R78 stays ARC-16. The three verify.mjs items of A408 below go to FX8. When SC6 lands, the Lead adds spec-rules.test.mjs to the main push guard for pushes that touch plan/cards or slices.json.

**Lead directive, 3 Oct (A408): spec fixup for the 6 gaps in reports/SC6-spec-review.md.** R77 reads bold directives and "Fix round" sections too, whole-sentence handling, any case and path spelling; R78 matches behaviour (git diff, git show, merge-base through a variable, pinned hashes) and covers test files; SC6 now depends on W16, so no KNOWN entry is needed for verify.mjs or W14 (R77 runs only on open cards): KNOWN ends empty. Also (reports/W16-spec-review-3.md): R11 treats a missing "N known" as a failure, never 0; `*` and indented bullets are read; folders outside SPEC are checked too. **R81** (A417, reports/FX8-findings.md; uses CQ4's expectation class and Spec-names parser from tools/lib.mjs and reads family templates with their params, A430): each expectation file in a card's Paths (a verify line, a README count, a golden) is owned by exactly one of the Spec and Build sections. Planted: FX8.md as first carded.

Phase 0. Size S. Deps: SC, W16. Where: cloud.
Tags: core (who writes which file decides whether a spec can be graded fairly).
Paths: tools/test/spec-rules.test.mjs, tools/test/__fixtures__/spec-rules/** (A493: renamed from card-rules, which SC10 owns)
Clauses: ARC-12, ARC-16 (A493: R77 and R81 re-cited from ARC-15)
Read: `reports/W16-findings.md` (rule tests), `plan/cards/SC.md` (rule style, KNOWN table), `.claude/rules/testing.md`.
Spec commit: f64dedb0 (round 2, A493; validated on main de30610b; 71 tests in tools/test/spec-rules.test.mjs, KNOWN empty; one repo-scan failure on main, R77 on N01.md (its Build section writes the fixture folder its Spec section names), for the Lead to reword (reports/SC6-spec.md item 8); earlier specs c526b32d on 931d08fa, 839819ff on 7eaf18cf)

## Spec
Each rule first shown failing on its planted example, then passing on main:
- **R77** no card gives the same file both to the spec job (tests, fixtures, verify.mjs, README counts) and to the build: a card whose Build section names a file the Spec section owns fails. Planted: W16.md as on main before A404.
- **R78** verify.mjs (and any checker script over sample data) holds no hard-coded "unchanged since main" or "folders N to M identical" checks: unchanged files are scope.mjs's job. Planted: verify.mjs as on main before W16 round 2.
- Entries that fail on main go in KNOWN with their owning card; never weaken a rule (A329).

## Check
A checker who did neither: both rules fail on the planted examples and pass on main (with KNOWN), `npm test` green.

## KNOWN shape (3 Oct, A407)
Every KNOWN entry names one rule, one file, the exact problem strings (no regex) and an open owner card; any problem not listed fails, and a listed string not produced fails as stale. Every file scan asserts it read at least one file and a named sentinel.
R77 runs only on cards that are not done or parked (a landed card's text is history, not a build order), so no KNOWN entry names W14. R78's entry names the exact verify.mjs line text, not any line number, owner W16 (claude/W16-r2).
