# A07C check (cloud-a0486a): FAIL

Passed: typecheck, lint, deps:check, npm test (61 files, 1804 pass, 1 skipped), mutation 100 on changed files (sheets.ts, csv, xlsx index/raw/zip), spec files untouched since spec commit 4ce0d83. scope.mjs flags plan/cards/A07B.md (arrived by the merge of main, not a builder edit).
Opus read of the five classes (not re-run by me; probes in the agent's scratchpad):

Failures inside the classes (go to the Lead, per A368):
1. Class 2: hyperlinked cell using a shared formula loses its formula. A1 `<f t="shared" ref="A1:A2" si="0">ROW()*5</f><v>5</v>`, A2 `<f t="shared" si="0"/><v>10</v>` with a hyperlink on A2: expected formula ROW()*5, cached 10; actual number "10", no formula. Cause: the regex in raw.ts matches only `<f ...>...</f>`, not the self-closed `<f .../>`.
2. Class 1: numberText snaps any stored number within 1e-9 of a whole cent, not only float sums: 1e-10 and 5e-10 read "0", 12.3400000001 reads "12.34", 1.0000000005 reads "1". The floor should be tied to ulps / the sum's error bound, not an absolute 1e-9.

Outside the classes (SC rule test candidates, A07C may land on these alone):
3. `<f>A1*2</f><v></v>` (empty cached value) reads cached error "#NUM!"; expected cached type none. The strict literal check treats '' as bad.
4. Under a .csv name, gzip (1f 8b), %PDF, "MZ"+zip and a PK\x07\x08 spanned zip read as CSV text. Judgment call; the card's named cases are refused correctly.

Clean: sums (300 fixed-seed, planted six-term), hyperlinked number/boolean/error/shared string/richText/str/inlineStr, class 4 literals, class 5 pins.

Rule candidate: any regex over raw sheet XML must handle self-closed elements; any snap tolerance must be relative to magnitude (ulps), never absolute.
Permission gaps: none. Model: Sonnet 5.5 (Opus subagent for the read).
