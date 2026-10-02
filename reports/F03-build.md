# F03 build report

Branch claude/F03 (built in a worktree on detached HEAD, pushed to origin claude/F03). Code commit 765ecb9; the report commit sits on top.

Files: src/contracts/taxprep.ts, src/contracts/taxprep.test.ts (scope clean; acceptance test and __golden__ untouched).

Acceptance tests: 98 of 98 pass (taxprep.acceptance.test.ts). Own unit tests: 14. Full `npm test`: 276 unit + 2 db pass; typecheck and `eslint .` clean.

Amounts: no float arithmetic; integer checks (isInteger, isSafeInteger) and String() only. Rates use toFixed(4) with a 4-decimal check.

Ambers:
- A row with two fields (current and last, no description) is read as shape `current-only` with `last` filled. Reverse: add a fourth shape.
- Writer rate rule: finite, 0 or more, at most 4 decimals (the card names no range). Reverse: tighten or loosen in formatValue.
- Apostrophe fault only fires on numeric-looking values (apostrophes removed leave digits); a text value like "'Allo" is read, but the writer refuses any text starting with an apostrophe.
- Header second column is accepted as any quoted name (trial files use "VALUE" as well as "Current Year"); the writer always writes "Current Year".
- Writer problems for a bad header use index -1 and identifier "header".

Could not do: the shell here refuses `source nvm`; I put /opt/nvm/versions/node/v24.21.0/bin on PATH instead (node 24 used). The worktree had no node_modules; I linked the main checkout's.
