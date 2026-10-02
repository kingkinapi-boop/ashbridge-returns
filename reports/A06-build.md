# A06 build report (cloud-e72c49, 2 Oct 2026)

- Branch claude/A06, code commit 144ec0b (main merged in first). Node 24.21.
- Files: db/schema/15_auth.sql, src/contracts/auth.ts, src/modules/auth/{index,totp,testing}.ts, testusers/{engine,credentials}.ts, live/index.ts; also src/core/env.ts (AUTH_ENGINE) and src/core/env.settings.test.ts.
- Acceptance: 73 of 73 pass (3 A06 files) plus 2 unit tests of mine (env.settings.test.ts). Full suite green on Node 24.21 (unit and db). typecheck, lint, deps:check clean. Mutation on env.ts (@mutate): 22 killed, 0 survived.
- scope.mjs FAILS: src/core/env.ts and src/core/env.settings.test.ts are outside the card's paths. The spec's own tests require AUTH_ENGINE in env.ts (contracts/auth.acceptance.test.ts), so the card's paths need env.ts and its test added (Lead).
- Ambers: (1) ids for events and sessions are crypto UUIDs, not newId hex, so the planted-code scan cannot match a digit run in an id by chance; (2) lock and used one-time code steps are read from sign_in_events (extra columns seq, code_step), no fourth table; (3) challenges are held in memory, single use, 5 minutes; (4) no time window on the five failures (a success resets the count, expiry of a lock resets it); (5) refused events also written for unknown user and bad challenge (reasons "unknown user", "bad challenge"); (6) removed the Stryker disable comment in env.ts (a second setting now exists) and tested the two-name message.
- Worker note: bash calls do not keep `nvm use`; each call must source nvm and use 24 or Node 22 gives a false red on the windows-1252 test.

## Permission gaps
None.

## Model
Sonnet 5.5 (security card, not core).
