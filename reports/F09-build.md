# F09 build: reported
Worker cloud-173eff. Branch claude/F09 (merged with main).
Files: src/contracts/reading.ts, src/contracts/reading.test.ts (3 own tests).
Acceptance: 29 of 29 in reading.acceptance.test.ts pass; typecheck, deps:check, scope clean.
SPEC DEFECT (builder may not edit): `npm run lint` reports 8 errors, all inside reading.acceptance.test.ts (non-null assertions at lines 288, 294, 321, 356; a number in a template literal at 288; async read without await at 455; unbound method at 457). Lint on the train will be red until a spec job fixes that file. reading.ts itself is lint clean.
Ambers: (1) wordsInBox centre test is inclusive on all four edges; (2) amounts: more than one sign mark is refused (for example "(-5.00)"), CR with a minus is refused, one decimal digit reads as tenths, three decimals refused, commas must group in threes; (3) valueInBox joins contiguous in-box words with no separator, amount mode when the wanted value parses as an amount (equal cents), otherwise text mode folded for case and spaces; (4) pointsToBox and pixelsToBox clamp to 0..1 to absorb float noise; (5) ReadingDocument is { fingerprint, fileName?, bytes? } until the engine cards fix it. Reverse: edit reading.ts.
Permission gaps: none (Node 24 from /opt/nvm). Model: claude-sonnet-5-5.
