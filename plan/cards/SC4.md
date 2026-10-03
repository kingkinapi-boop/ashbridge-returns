# SC4 Reading rules R67 to R70, R74, and the R56 exemption

Phase 1. Size S. Deps: A07D. Where: cloud.
Tags: core (citations and amounts).
Paths: tools/test/reading-rules.test.mjs, tools/test/__fixtures__/reading-rules/**
Clauses: EV-14, EV-5, ARC-10
Read: `reports/A07C-findings.md` ("Rule tests for SC"), `reports/A07D-opus-read.md` (on claude/A07D until it lands; amber A393), `plan/cards/SC.md` (rule style, R56), `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Spec
Each rule first shown failing on its planted example, then passing on main:
- **R67** any rewrite or parse of a formula or identifier in file content goes through one tokenizer, tested on quoted names containing its own syntax, whole rows and columns, strings and brackets. Planted: a regex slider that changes `'Q4 FY2026'`.
- **R68** any derived value computed from other cells or figures is independent of visit order: a property permutes the layout and gets the same result. Runs on A07, E01, B01, T01, L01 as they land. Planted: a row-major snap with the outer total above the inner one. Also: every member of a reference cycle is found whatever the visit order, including a cycle joined through an already finished node and one through a non-SUM formula (A07D Opus read item 2).
- **R69** every number-to-text function is total over the doubles (fc.double) with no digits invented. Runs on sheets numberText, money.ts, the T01 and F03 writers and taxprep rate text. Planted: `BigInt(1e23).toString()`. Also: any cents-to-text maps back to the exact cents or refuses (A07D Opus read item 1, totals of 1e13 and up).
- **R70** every raw-XML reader accepts the well-formed variants: single-quoted attributes, namespace prefixes, attributes on value elements. Planted: `<x:c r='A1'>`.
- **R74** every reader that walks a range or a file region is bounded by what exists (cells present, sheet extent), never by the area the text names, and runs a 20k-row running balance and a whole-sheet range inside its budget. Planted: a nested loop over `A1:XFD1048576` (A07D Opus read item 3).
- R67's tokenizer cases also take the A07D Opus read items 4 and 5: `'` escapes inside structured references, names past XFD or row 1048576, non-ASCII name letters, unquoted 3D ranges.
- Rules that fail on landed A07D code for these findings go in KNOWN with owner FX4, which fixes them; never weaken a rule (A329).
- **R56 exemption:** absolute epsilons on page coordinates scaled 0 to 1 are allowed when the scale is named in a comment (reading.ts EPS, amount-grammar.ts GEOMETRY_EPSILON).

## Check
A checker who did neither: the four rules fail on the planted examples and pass on main; R56 passes on main with the exemption.
