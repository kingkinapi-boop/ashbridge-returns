# SC6 spec review, 3 Oct

Spec 839819ff on claude/SC6 (tools/test/card-rules.test.mjs and two fixtures). Read: plan/cards/SC6.md, reports/W16-findings.md (rule tests), .claude/rules/testing.md, blueprint 09 (ARC-15, ARC-16). I ran the spec's r77 and r78 by hand on main 4a330123, on W16 round 2's verify.mjs and on the variants below.

## Verdict: GAPS (6)

## What holds
- Both rules fail on their planted copies for the right reason and pass on main with KNOWN. R77 finds only W14.md (README.md, contract-ids.json) across 119 cards. R78 finds only verify.mjs lines 996, 1000, 1003 and 1007 across 19 checker files, and nothing in W16 round 2's verify.mjs.
- A stale KNOWN entry fails, so the list only shrinks. The Paths match the card, and the product-file case (a Spec section that names the file it tests) is covered.

## Gaps (each rule is proven on one planted file, not by class)
1. R77 reads only `## Build`, the "Who does what" bullets and Spec sections. Round-2 build orders live in two places it never reads: the bold Lead directive at the top of a card (NOW.md: "put a bold directive at the top of the card") and `## Fix round N` or `## From findings ...` sections (about 26 cards). Both forms pass (run by hand, result []): "**Build: rewrite README.md counts.**" in the preamble, and "- Build: update verify.mjs KNOWN." under "## Fix round 1".
   Test: treat every sentence or bullet that starts with "Build" or "Builder" as build text, in any section and in the preamble. Plant both forms; each must fail.
2. A sentence is dropped whole when it mentions the spec job or contains any "never/not ... edit/change". So "Bring over the data; never edit verify.mjs, and rewrite README.md counts." passes, and so does "Rewrite README.md counts the spec job left stale." (run by hand, result []).
   Test: drop only the files inside the negated or spec-owned clause (split at commas and "and" as well). Plant both sentences; each must fail.
3. Naming variants slip through. `\bREADME\b` is case-sensitive, so "the readme pass count" passes. Two paths that both have directories match only when they are equal, so "sample-clients/verify.mjs" in Build against "reference/sample-clients/verify.mjs" in Spec passes.
   Test: match README case-insensitively and compare paths by suffix (one ends with the other at a "/"). Plant both forms; each must fail.
4. The KNOWN entries are too broad, and they set a landing trap.
   - **Too broad:** the R78 entry `/^reference\/sample-clients\/verify\.mjs:\d+: /` matches any line in verify.mjs, so it hides any new guard until it goes stale. Pin it: exactly the four problems (line text or kind, and the count).
   - **Landing trap:** whichever of SC6 and W16 lands second goes red. Once W16 lands, the R78 entry is stale and the test fails, and W16 cannot edit card-rules.test.mjs because the file is not in its Paths. The W14 R77 entry has the same problem: the Lead rewords W14.md straight on main, but removing the entry needs a train.
   - **Fix:** add W16 to SC6's Deps. The Lead rewords W14.md now (a plan/ edit). A spec fixup then drops both entries, and the spec is re-validated on main after W16 lands, so KNOWN starts empty.
5. R78 matches labels, not behaviour. These all pass (run by hand):
   - `git diff --quiet origin/main -- ...`
   - `git show origin/main:<file>`
   - `git rev-parse origin/main`
   - merge-base called through a variable
   - "clients 1-10 are unchanged" (no spaces around the dash)
   - a table of pinned sha256 hashes for the folder files

   Test by class: in a checker over sample data, fail any git call that names a ref other than HEAD (origin/, main, merge-base, rev-parse, `show REF:`, HEAD~N, @{u}), and fail any table of 64-hex literals. Plant each of the six variants; each must fail. `git diff HEAD` stays allowed, because W16 gap 1 needs it.
6. R78's reach is too narrow. The findings' rule is "no spec-owned expectation file holds a run-dependent baseline", and tests are spec-owned. Yet CHECKER_FILES excludes every test and walks only reference/sample-clients and testworld/, which does not exist.
   Test: also scan *.test.* and *.spec.* files repo-wide (node_modules skipped), with a named allow list: tools/scope.mjs, tools/claim.mjs, tools/mutate-changed.mjs and their tests (tools/test/claim.test.mjs:99 reads origin/main on purpose). git grep on main finds nothing new. A planted test file containing `git diff origin/main` must fail.

## Re-test after the fixup
Run all seven existing tests unchanged, plus the new plants. Re-run R77 on all cards and R78 on all checkers and tests on current main, and paste the problem lists into the spec report.
