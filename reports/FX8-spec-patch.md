# FX8 spec patch (A493), cloud-97b8bd, 3 Oct 2026
Branch claude/FX8-r2 (pushed from local claude/FX8), commit a05c1c9c, validated on main bd5ec11.
New: tools/test/sample-verify.test.mjs (9 tests: 3 already pass as controls and plants, 6 red by design) and fixture tools/test/__fixtures__/sample-verify/verify-before-w16-round-2.mjs.txt (verify.mjs at 704a9432^, the merge-base version).
Red, build must turn green: history-free clean export passes verify.mjs (today red only for the SEC-11 x3 and R11 x2 lines); R11 fails with a reason naming "known" when the Status line has no "N known" (also when "0 known" is written elsewhere); a "* " or indented bullet under "Opening UCC moved" with a wrong figure fails the W16 END-2 tie line; an untracked 16-planted-extra folder fails the "ARC-16 the committed sample data" line naming it.
Green controls: the old verify fails both of its merge-base lines in a history-free export; a committed extra folder already fails.
Amber: Paths gap (A414): added the new test file and fixture folder to the card's Paths (reverse: drop them and move the tests into sample-names.test.mjs). The build must add or remove no PASS/FAIL line in verify.mjs (README count 556 is the spec's); fold checks into existing lines or stop and report. make-csv --check alone is not tested (it needs a generate first); verify.mjs's own ARC-8 line covers it.
Step 6b sweep not run (no stub); typecheck and lint clean; unit run shows only FX8's own 9 red-by-design tests.
Model: Sonnet 5.5. Permission gaps: none.
