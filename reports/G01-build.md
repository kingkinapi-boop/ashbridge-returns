# G01 build (cloud-47e70d, 2 Oct 2026)
Branch claude/G01. Files: src/modules/gaps/bank/index.ts, bank.test.ts, src/modules/gaps/index.ts, data/question-bank/_schema.json (generated from the zod item schema; a unit test keeps the two equal). Spec untouched.
Numbers: 59 of 59 acceptance pass; 5 unit tests; full suite 42 files, 1401 tests green; typecheck, lint, deps:check, scope clean. Not a core card, so no mutation run.
Amber: the version hashes item content sorted by id (file names and layout do not count); a duplicate id reads "retired" only when the earlier item is retired and the later one live, otherwise "duplicate"; the loader refuses unknown keys in an item; `data/question-bank/` holds only `_schema.json` until G10 to G17.
Could not do: nothing. Permission gaps: none. Model: Sonnet 5.5.
