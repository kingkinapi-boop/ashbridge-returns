# G18 spec: released (Paths gap, A414)

Worker: cloud-899fef. Role: spec. Model: Sonnet 5.5. Permission gaps: none.

**Why released.** The card puts `coverage.json` at `data/question-bank/coverage.json`. `loadBank` (src/modules/gaps/bank/index.ts, line ~107) reads every `*.json` in that folder except `_schema.json` and refuses any file that is not `{ "items": [BankItem] }`. So the card's own file would make the whole bank, and every G01 to G17 bank test, fail. Any shape that passes the loader would have to be a bank item, which a flag-to-question map is not. Fixing it needs an edit to `src/modules/gaps/bank/index.ts`, which is outside the card's Paths, so no spec was written.

**Lead options (pick one, then reopen the spec):**
1. Move the map out of the loader's folder: `data/question-coverage.json` (or `data/question-bank-coverage/coverage.json`) and change the card's Paths and Spec lines. Smaller, reversible, no product code. Recommended.
2. Add `coverage.json` to the loader's skip list beside `_schema.json` and add `src/modules/gaps/bank/index.ts` to the card's Paths, with a G01 rule test that the skip is exactly those two names.

**Facts for the rewrite.** 15 sample answer keys hold 105 flags (`reference/sample-clients/*/answer-key.json`, `flags[].id`, `severity` is `must fire` or `info`). 9 bank files exist, ids `Q-<TOPIC>-<nnn>`. Nothing else in the card blocks the spec.

Amber: none made. Validated on main: not reached.
