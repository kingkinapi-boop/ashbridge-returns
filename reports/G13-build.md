# G13 build
Branch claude/G13. Files: data/question-bank/shareholders-dividends.json (9 items, Q-SHD-001 to 009), src/modules/gaps/bank/shareholders-dividends.test.ts.
Acceptance: all G13 spec tests pass (bank folder 7 files, 128 tests); typecheck, lint, deps:check clean; scope OK. Not core, no mutation run.
Amber: the bank schema has no text answer shape, so the holder name (Q-SHD-001) uses a required fact_ref slot with a single choice option name_entry. Reverse: add a text shape in a schema card and switch the item. The schema owner (G01) should decide.
