# F09A build (round 3), cloud-e43f36

Branch claude/F09A. Files: src/contracts/amount-grammar.ts, src/contracts/reading.ts.
- Dash look-ahead tests the same candidate group (dash plus next word) via a head-only groupAt; no recursion, so a 20000-word "1" "-" run is linear and never throws.
- Trailing CR and DR are upper case only (A348); WordSchema refuses words of only U+200B to U+200D and U+FEFF.
- Acceptance and unit tests in src/contracts: 581 pass; full npm test 883 unit + 2 db pass; typecheck, lint, deps:check, scope OK.
- mutate:changed F09A: 100 on amount-grammar.ts and reading.ts (one Stryker disable on the head-only return value, which callers read only as non-null).
- Ambers: none. Not done: test:flake 5 of 5 left to the checker.
