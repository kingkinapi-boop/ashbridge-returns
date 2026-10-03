# FX8 build
Branch claude/FX8 (main merged in). Added "(Test)" at the 3 generator lines (c07_08, c09_10, c13_15); regenerated 07, 09, 14, 15 (text lines only; 15 had no bare name). verify.mjs gains one SEC-11 line per client (bare declared person names), README count 534 to 546 (531 + 15).
tools/test/sample-names.test.mjs: 17 of 17 pass. typecheck, lint clean; tools/test 214 pass. Planted bare name in the generator: verify fails naming 07 answer-key.json:412 and profile.md:33.
verify.mjs still FAILS two ARC-16 "byte-identical to main before W14/W15" lines (07, 09, 14 text moved) and two R11 lines (README 546 vs the count after W16's changes). The first two are retired by the W16 spec; whichever of FX8 and W16 lands second merges main in and re-runs verify (card landing note). The R11 count must be reset to the finished state by the second lander.
Note: verify.mjs leaves import.csv with CRLF on disk (git ignores it); run npm test before verify.
Amber: none.
