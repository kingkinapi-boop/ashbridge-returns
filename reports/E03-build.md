# E03 build round 3 (cloud-87fd26)

Branch claude/E03. Changed: `data/facts/catalogue.json` only (9 new `qa` keys citing BQ2.earn, FL:96, FL:97, FL:104, YE1.pcost, YE1.puse, YE1.vbkm, YE1.vkm, YE1.vehicle; none sensitive).
Acceptance: `npx vitest run src/contracts tools/test/toolchain-rules.test.mjs` 783 of 783 pass (the 9 failing tests now pass).
typecheck, lint, deps:check clean. Mutation: facts.ts 100 (260 killed, 0 survived).
Scope: `node tools/scope.mjs E03` FAILS on `plan/cards/E03.md` in 97fe66d (the Lead's spec-commit line for the card, not the builder's edit). Lead: accept or exempt.

## Amber
- Key names for FL:96, FL:97, FL:104, YE1.puse are guesses from the sample-client ledgers (qa.cash.deposits_balance_cad, qa.cash.deposits_balance_other, qa.shareholder.loan_balance, qa.home.business_use_share as percent). Reverse: rename the keys; tests only read the cite.

## Permission gaps
None.

## Model
Sonnet 5.5.
