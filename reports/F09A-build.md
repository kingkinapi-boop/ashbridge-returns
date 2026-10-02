# F09A build (cloud-e81ab0, 2 Oct 2026)

Branch claude/F09A. Files: src/contracts/amount-grammar.ts, amount-grammar.test.ts, reading.ts (acceptance tests untouched).
Acceptance: all of amount-grammar.acceptance (spec round 2) and reading-strict.acceptance pass; npm test 843 of 843; test:flake 5 of 5.
Gates: typecheck, lint, deps:check clean; scope OK; mutation 100.00 on amount-grammar.ts and reading.ts (full run, incremental file removed).
Done: strict schemas at every depth (z.strictObject); valueInBox parses through ReadingResultSchema (throws on a refused result); foldText disable comment names toLowerCase and claims nothing tested; lexer rewritten (marks-only vs number words, separators lex to null) to remove equivalent mutants; extra unit tests for edges.
Ambers: (1) three Stryker disables on proven-equivalent mutants (centsOf default, groupsOver loop bound, debitCredit 'DR' fallthrough); reverse: delete the comments. (2) `valueInBox` throws ZodError on an invalid result rather than answering not found; reverse: safeParse and answer ok false.
Note: stale `reports/mutation/stryker-incremental.json` made static mutants look like survivors; delete it before a mutation run.

## Permission gaps
None.

## Model
Sonnet 5.5.
