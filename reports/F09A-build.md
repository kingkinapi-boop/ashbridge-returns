# F09A build (cloud-12a4d8)

Branch claude/F09A, build commit 276b27a (plus this report). Files: src/contracts/amount-grammar.ts (new, // @mutate), amount-grammar.test.ts (new, 13 tests), reading.ts (re-exports normaliseAmount, valueInBox uses amountGroups, blank value/word, page RangeError, comment fixes). Scope clean.
- Acceptance: amount-grammar.acceptance 90 of 90 pass; src/contracts 524 of 525 pass.
- Failing: reading.acceptance.test.ts line 1063 "EV-6 r4 a trailing sign closes the group" ("1,234.56" "-" "7" = -1234.56 then 7). It contradicts the A296 dash rule and F09A row "1,234.56 - 7 is 1234.56 and -7"; the card says F09A replaces it. I may not edit it: the Lead must remove or rewrite it (spec job). It also makes Stryker's dry run fail; I measured with it skipped locally (not committed).
- typecheck, lint, deps:check clean; scope OK; mutate (test skipped): total 92.40 (amount-grammar 89.36, reading 98.11), break 70 met.
- Defects 1 to 4 from F09's read: done (blank value refused, WordSchema non-blank, RangeError on bad page, comment reworded, consumer note).
Ambers: (1) attached unbalanced "(5.00" makes no group (reverse: group without the bracket). (2) AMOUNT_FORMATS has 8 named formats; positives print plain, debitCredit prints CR. (3) normaliseAmount keeps F09's refusal texts ("more than one sign mark", "amount is too large").
Permission gaps: none. Model: Sonnet 5.5.
