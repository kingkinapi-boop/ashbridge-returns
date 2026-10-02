# Findings review F09, round 2 (2 Oct, Opus, cold; text returned to the Lead and recorded here)

Read: card, findings-F01-F09 RC4/RC5, F09-check/build on claude/F09 ffab27b, reading.ts c19481e, acceptance spec 79893e4.

## Root causes
- RC-A. The amount grammar is never written down once. joinWord (reading.ts 205-221) checks each next word against loose regexes; DECIMALS, COMMA_GROUP, SPACE_GROUP reuse GROUPED's `\d{1,2}` decimals ("1" ".5", "1" "234.5", "1" ",234.5" join: finding 2). TRAILING_SIGN takes a "-" greedily with no look-ahead, then `/\d$/` shuts the group (finding 1). normaliseAmount strips every space (line 152; finding 3; "12 34" reads 1234). Siblings: a stray ")" spoils the amount before it; U+2212 is not a minus; en and em dashes have no rule; joins ignore the gap between words (columns join); two bare integers join as space thousands.
- RC-B. Edge numbers: "(0.00)" and "-0" return -0 (finding 4); NaN or Infinity x or y slips past checkRect and throws ZodError, not RangeError (finding 5).
- Testing gap: one amount per line in every example; properties change one thing at a time.
- Where else: I00 checkCitation, E01 gate and money conversion, A07 cellValueMatches, W20 check 3, E00, SK0, V01; NaN boxes reach A01, A02; -0 reaches F01 sums.

## The grammar (table)
Tokens: NUM `0|[1-9]\d{0,2}(,\d{3})+|[1-9]\d*` with optional `.d` or `.dd` as a whole word; GRP3 `\d{3}(\.\d\d)?`; CGRP `,\d{3}(\.\d\d)?`; DEC2 `\.\d\d`; LEAD `- − $ ( $- -$ $( ($ −$`; TRAIL `- ) CR DR`; SEP anything else (incl. en and em dashes). Group: LEAD* NUM (GRP3|CGRP)* DEC2? TRAIL?. Continuations join only before any decimals and only with exactly two decimal digits; one sign mark; balanced brackets; CR excludes a minus; joins need the same line, consecutive reading order, a gap no wider than the word height. Three decimals, "1.234,56", "1,23,456", leading zeros: not a number. One-digit decimals allowed inside a single word. Value side: normaliseAmount splits on spaces and must give exactly one group, else text comparison; never -0.
Dash rule (Lead, amber A296): leading binds first: a "-" followed within the gap by an amount is a leading sign, otherwise a trailing sign on the amount to its left ("100.00" "-" "50.00" finds 100.00 and -50.00).

## Fix list (round 3, last)
1. Lead: ambers (dash rule; join decimals exactly 2, single-word 1 to 2 kept; U+2212 minus, en and em dashes separators; join gap at most the word height; -0 becomes 0). Split the card (below).
2. Spec (new worker): checks 14 table test (about 40 rows, one per rule, incl. the dash both ways, stray ")", "1" ".5", "1" "234.5", "1" ",234.5", U+2212, en dash, wide gap, "100.00" "CR" "50.00", unbalanced "("); 15 generator property (fixed seed: 1 to 3 amounts per line, random sign and split styles, separators; every intended amount found, decoys never); 16 normaliseAmount equals valueInBox over the same text split into words; 17 no amount returns -0 (Object.is); 18 NaN, Infinity, -Infinity in any converter field throws RangeError.
3. Build: one lexer, table and group function used by normaliseAmount and amountGroups; -0 fix; finite guard. Only reading.ts.
4. Check (third worker): full list plus an Opus adversarial read on the table.

## Split (Lead decision, amber A297)
F09 boards with checks 17 and 18 only (geometry, schema, stamps, adapter, text passed both rounds). New core card F09A "amount grammar" owns normaliseAmount, amountGroups and checks 14 to 16 (deps F09); I00, E01, A07, W20, SK0 depend on F09A. The known false positive stays on main with no consumer until F09A lands, recorded on F09A.

## Rule tests (their own card)
No exported money function returns -0 (property over F01, A07, F09 modules); every contract converter refuses non-finite numbers with RangeError; W20 check 3 and A07 read amount formats from F09A's exported table. Planted bad example for each.

## Risks and re-tests
The gap rule could break real Tesseract splits (A02): tolerance is a parameter; re-run W20 check 1 when A01 lands. The dash rule settles one ambiguity: E01 rejection counts will show it. Exactly-two decimals at joins fails safe as "value not found". Re-test: the 53 acceptance tests, test:flake 5 of 5, Stryker on reading.ts or the grammar file, checks 1 and 3.
