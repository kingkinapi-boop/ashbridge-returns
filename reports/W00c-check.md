# W00c check (round 3 build 75556283, branch claude/W00c) - FAIL

Checker: cloud-4863d0. Date: 3 Oct 2026.

Steps 1 to 3 (partial): typecheck, lint, deps:check clean. `npm test` was still running when this report was written (not read: not counted). Mutation (canary and mutate:changed) and test:flake were NOT run: the Opus read already fails the card. scope.mjs: SCOPE OK (85 files, all inside Paths); it flags one note on faults-catalogue.json (12c42b0 superseded by 1b555ab), read by hand: fine.
Opus adversarial read (A496, not on the landing form; findings below do not depend on it). Held: guard.ts, guard.test.ts, kinds.ts no diff from 3fe3b47; build commit touched only load.ts, json-keys.ts, checks.ts, money.ts; no spec file edited or test weakened; testworld unit project 4777 pass; reserved and repeated keys at any depth, bad dates, one-unit twin moves, dotted paths and foreign ids refused; RC1 to RC5 hold.

## Confirmed failures
1. RC-C: the loader never checks transaction ids or references against the idRule (folder number, account tag, month). load.ts:391 tests shape only; the walk at load.ts:589-597 tests only that the id exists. C01's 01-CHQ-2025-01-0027 (with its references) renamed to 05-CHQ-..., 01-ZZZ-... and 01-CHQ-2031-07-0099 all load. The spec only asserts today's data agrees (id-walk.acceptance.test.ts:90).
2. RC-A / A426: accounts[].tag (load.ts:43) is typed, outside any carried block, used nowhere; "ZZ" loads with the same model. The spec's READ list (w00c-r3-walk.ts:151-159) omits it, so the property test never changes it.
3. RC-A / A426: cra_program_accounts[].account_number, t2Inputs.schedule50[].businessNumber and parties[].kind (company to person) can change and load with the same model.
4. RC-A: prior_year is declared carried (load.ts:167) but the model holds it raw (load.ts:648). Renaming a key or adding fiscalYer under C11's prior_year loads and the model changes.
5. Fix 2: about 15 objects at load.ts:96-253 declare carried keys with no comment naming the owning card (trialBalance, schedule50, addBacks, owners, shares, spouse).

## Suspicions (unproven)
Date walk skips object keys (fx.monthly "2025-13", "2025-02-30" load); "2025-2-30T00:00Z" and "2025-02-30 10:00" load; "2025.13" let through as a decimal on purpose.

## Landing rule
Failures 1 to 4 fall inside RC-A and RC-C: those classes split to W00d (card A450); the Lead decides. Items 2, 3 need spec READ list additions (spec job), 1 needs an idRule test over the walk.

Rule candidate: a hand-written READ/carried list is compared with the schema's field list in a test (A426), for every typed field.

## Permission gaps
None. (The Opus reader's write to /tmp was refused by the protect-spec hook; it reported inline.)
## Model
Checker Sonnet 5.5; adversarial read Opus 5.5.
