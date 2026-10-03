# G18 build report (cloud-84988c)
Branch claude/G18. Files: data/question-coverage.json (105 flags, 15 keys). No bank item added, no product code.
Acceptance: 15 of 15 in coverage.acceptance.test.ts; whole gaps/bank folder 230 of 230. typecheck, lint clean.
Mapping: 40 flags map to existing bank questions (01-F02 and 01-F04 to Q-SHL-001/002, so no new Q-SHL item was needed); the rest are `check` (owner Q00, B03, B07, G00: open cards) or `cpa-judgment` (owner X00).
Ambers: (1) owners picked by subject: Q00 books-derived checks, B03 prior-year/filing, B07 bank-line checks, G00 evidence gaps and year end, X00 judgments. Reverse: edit the owner. (2) 01-F03 (repay then reborrow) is cpa-judgment, not a question; the facts come from Q-SHL-002 via F02. (3) 04-F01 quick method maps to Q-CRA-003 (HST basis), the closest asked fact.
Checker: Opus read of each mapping against the flag's `detail` (tax content), as the card says.
Permission gaps: none. Model: Sonnet 5.5.
