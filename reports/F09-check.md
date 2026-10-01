# F09 check (cloud-45ec67): FAIL

Step 2 fails: `npm run lint` 8 errors, all in `src/contracts/reading.acceptance.test.ts` (lines 288 x2, 294, 321 x2, 356, 455, 457: non-null assertions, number in template literal, async without await, unbound method). This is the spec defect the build report named; the builder may not edit that file, so it needs a spec job. `reading.ts` is lint clean. Typecheck and deps:check pass; full vitest 123/123; scope OK; acceptance file unchanged since the spec commit.

Mutation (stryker on reading.ts, break 70): 80.37%, 38 survived, 15 no coverage (messages, the reasons "box on another page"/"no words in box" paths at 158-162 and 187, schema message strings, regexes at 132/136/154, `>=`/`<` boundaries at 115). Also `reading.ts` has no `// @mutate` marker, so `mutate:changed` skips it. Rule candidate: every core `src/**` file carries the marker (a test that lists core files without it).

Opus adversarial read against EV-6/EV-5/ARC-10 (real defects, false positives first):
1. reading.ts:184-193 words are joined with no separator: separate words "12" "34" make 1234 match; "234.56" matches from the second word of "1 234.56".
2. reading.ts:184-190 a sign mark in its own word is ignored: "-" "1,234.56", "1,234.56" "DR", "(" "1,234.56" ")" all accept +1234.56.
3. reading.ts:124,182 any amount-like value is compared as cents with leading zeros allowed: an ID "001234" matches "1,234.00" or "12" "34".
4. reading.ts:73-83,96-104 converters clamp each field alone, so a box partly off the page shifts or grows; zero page size gives NaN; BoxSchema allows left+width > 1.
5. reading.ts:46-65 pageCount is not checked against pages (duplicates, gaps).
Minor: "$-1,234.56" and "$(1,234.56)" refused (154); box on an existing other page says "no words in box" not "box on another page" (179, card names that reason); box page below 1 not checked.
Items 1 to 3 break the card's promise that a value is "truly in the box" for citations (AI-4). These need new rule tests via a spec job.

Permission gaps: none. Model: Sonnet 5.5; Opus 5.5 subagent for the adversarial read.
