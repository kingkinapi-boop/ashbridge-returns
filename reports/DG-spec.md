# DG spec (cloud-85862e, Sonnet 5.5; non-core card)

Commit 8a722d5 on claude/DG: `tools/test/done-gate.test.mjs` (21 tests: R19 scope 8, R20 mutate-changed 8, R21 --board 3, ARC-9 2) and fixtures in `tools/test/__fixtures__/done-gate/` (slices, two cards, file bodies with a .txt suffix, a Stryker stub). Each case builds a temp git repo, runs the real tool, and the Stryker stub sits at `node_modules/@stryker-mutator/core/bin/stryker.js` (the build keeps that cwd-relative path; the stub records its arguments in `stryker-called.txt`).
Clauses: ARC-12, ARC-15, ARC-19, ARC-9. 17 fail now for the right reason (scope has no spec-by-commit, no edited-spec check, no ledger line, no --board; mutate-changed takes the base as its first argument and has no card id or marker gate); 4 pass (2 ARC-9 checks, 2 regression guards). Typecheck, lint green; full unit project: only the 17 DG tests fail. Validated on main cfc8d79.
Amber: (1) the failure messages are pinned to the card's wording ("spec file edited by the build", "core file without @mutate", "ledger on a card branch", "ledger rows on this branch: revert before boarding"); (2) a spec file edited by the build is reported with the first 7 characters of the commit sha; (3) on a non-core card with an unmarked changed src file the test pins only exit 0, no marker failure and no Stryker call, not the message; (4) mutate-changed's usage line is pinned as "usage: node tools/mutate-changed.mjs <card> [base]".

## Permission gaps
None (node 24 via nvm for npm ci).
## Model
Sonnet 5.5 (card is not core).
