# Findings review: W14, D01, F01, F09 (2 Oct, Opus, cold; text returned to the Lead and recorded here)

Inputs: W14-check/build (claude/W14), D01-check/build (claude/D01), F01-spec/build (claude/F01), F09-build (claude/F09), F05-build, F04-spec, cards W14, D01, F00, W15, the configs on origin/main (vitest.config.ts, tsconfig.json, eslint.config.mjs, package.json), and the spec diffs on F03, F04, F05, F08, W00, D00, W15. Every spec branch is behind main. No lint or tests run (main had no node_modules).

## Root causes (4)

**RC1. A spec is "done" without passing the toolchain on current main.** The spec job proves its tests fail for the right reason but never runs typecheck, lint and `npm test` on the spec commit merged with origin/main; F00 then landed rule tests and strict lint under specs already written.
- F01: `records.acceptance.db.test.ts:858` calls `new PGlite()`, tripping F00's ARC-4 rule (`tools/test/db-rules.test.mjs`). Also its test "the F01 schema files alone create exactly the F01 tables", if rewritten to read the shared `db/schema` template, breaks as soon as B04 or T07 add a schema file.
- F09: 8 strict-type-checked lint errors in `reading.acceptance.test.ts` (288, 294, 321, 356, 455, 457).
- Where else: F04 `src/contracts/ai.acceptance.test.ts` (lint not run); W00 4 files under `testworld/` (`regenerate.acceptance.test.ts:28` non-null assertion); F03 and S00 re-specs; F08 low risk, validate; F05 fine.

**RC2. Tests outside `src/` and `tools/test/` have no home, and the only card that could give them one (F00) is closed.** Unit include is `src/**/*.test.ts` and `tools/test/**/*.test.mjs`; tsconfig includes `src/**`, `e2e/**`, root `*.ts`; lint uses `projectService`, so any `.ts` outside tsconfig is a hard lint error and `typecheck` skips it. D01 (Paths `design/map/**`, Deps none) cannot fix it; its 19 tests never run in `npm test`. Where else: D00's own `design/basis/vitest.d00.config.ts`; W00 `testworld/**`; later W20, B01, B04, T07, JH0 `.ts` under `testworld/`; any future `testworld/**/*.db.test.ts`.

**RC3. The W14 card and spec copied the client app's storage shape without reconciling it with RULE-19 and the contract's id list.** `verify.mjs:149-150` (spec 0e448ae) requires `question_asked` to match `"<id>: <label>"` with a non-empty label (client-voice wording in this repo); it checks id shape, not membership in `reference/onboarding-contract.md`, so invented ids pass (`YE2.*`, `YE2.phone`, `BQ7.loan`, `ARB.bal`, `INC3.shares`). The card asks K05 for facts with no screen id (expense groups, year-end bank balance). The contract is split: line 32 (screen answers carry fact-list wording in `what_it_resolves`) vs line 83 (year-end bank answers carry `what_it_resolves = fact_id`, channel `conversation`). Where else: W15 (same `answerId` and `/: \S/` check at verify line 104); W01, W05; W00 reads the sample clients.

**RC4. Sample figures are typed by hand across years; verify only checks two copies of the same typed number agree.** Nothing ties last year's income to the movement in retained earnings, a balance owing to its payment, prior tax over $3,000 to instalments (K01 would raise a judgement flag), opening amortization and UCC to cost, date and method (2,600 vs 2,375; UCC 1,480 vs 1,468.13), or `all_prior_years_filed` "yes" to prior balances being present (client 12). README "23 accounts" (there are 25). Where else: W15 K13 (no 14-to-15 tie), 07-riverdale `prior_year`, 01 to 10 prior balances and UCC never checked, B03 reads `prior_year` through W01.

## Card decisions (Lead, amber; none red)
- W14: (a) ids only from the contract; `question_asked` holds the id only (or id plus a fixed marker), never wording; facts with no screen id arrive as `conversation` answers keyed by fact id (contract line 83); log the line 32 vs 83 split as a contract note. (b) K01 states prior-year tax under $3,000 or pays quarterly instalments. `prior_year` derived by the generator, not typed.
- D01, D00, W00 depend on card TH (test homes), not only F00.
- F01, F09, D01 need no content change; builders' work stands; specs, config and re-checks change.

## Consolidated fix list, in order
1. Lead (main): spec-writer "done" gains: merge origin/main, `npm run typecheck`, `npm run lint`, `npm test` green except the card's own acceptance tests failing by name; report records "validated on main <sha>". Dep gate reopens a spec for a "toolchain refit" when `vitest.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json` or `tools/test/*-rules.test.mjs` changed since that sha. Deps: D01, D00, W00 on TH.
2. New card TH "test homes" (train; spec and build by different workers). Paths: `vitest.config.ts`, `tsconfig.json`, `tools/test/toolchain-rules.test.mjs`, `tools/test/__fixtures__/**`. Unit include gains `design/**/*.test.ts`, `testworld/**/*.test.ts` (not `*.db.test.ts`); db include gains `testworld/**/*.db.test.ts`; tsconfig include gains `design/**/*.ts`, `testworld/**/*.ts`. Prefer the include globs in one data file read by both the config and the rule test.
3. F09 spec refit: fix the 8 lint errors without changing what any test asserts; re-check.
4. F01 spec refit: `createTemplate(tmpDir)` from `src/core/db` in a `beforeAll` on a temp folder of F01's nine files; assert exactly the F01 tables from those files only; re-check.
5. D01: re-check after TH; spec refit if lint flags the 3 suspect template literals.
6. W14: card amended (above); spec job rewrites `verify.mjs` (ids in a contract id data file, no wording in `question_asked`, rule checks R5 to R10 on every folder); build round 2 (derive `prior_year`, K01 instalments or prior tax under $3,000, client 12 consistent, README counts).
7. W15: re-spec on the new W14 spec; remove `/: \S/`; add the 14-to-15 opening tie.
8. Spec refits under the new gate: F04, W00 (after TH), D00 (delete `vitest.d00.config.ts`), F08 (validate only); F03 and S00 re-specs follow the gate from the start.

## Rule tests (each first failing on a planted bad example)
- R1 every `*.test.{ts,tsx,mjs}` outside node_modules and `__fixtures__` matched by exactly one Vitest project; `*.db.test.ts` only by db. Plant: `design/x/x.acceptance.test.ts`, `testworld/a.db.test.ts`.
- R2 every `.ts`/`.tsx` lint does not ignore is inside the tsconfig include. Plant: `testworld/qbo/x.ts`.
- R3 no `vitest*.config.*` outside the repo root. Plant: `design/basis/vitest.d00.config.ts`.
- R4 no acceptance test reads the shared `db/schema` folder to assert an exact table set.
- Sample clients (`verify.mjs`, every folder, planted copies via a `sample-copy` fixture): R5 answer ids in the contract list (plant `YE2.phone`); R6 no wording after the id in `question_asked`; R7 prior year rolls (opening RE = prior closing; movement = after-tax income minus dividends; prior balance owing paid or carried); R8 opening amortization and UCC recompute from cost, date, method, class rate, half-year rule (plant 2,600 and 1,480); R9 prior tax over $3,000 means instalments or a judgement flag; R10 `all_prior_years_filed` yes means prior closing balances present unless incorporated in the year; R11 README counts match generated data.

## Risks and re-tests
- TH widens the unit project and the type and lint net: W00, D00, D01 and later testworld files surface new errors (intended; spec refits, never builder edits). Network guard and TZ now apply to design and testworld tests. `vitest.mutate.config.ts` may pick up more tests: check `mutate:canary` stays 100. `db-rules` and R1 to R3 walks skip `.stryker-tmp`, node_modules, `__fixtures__`. Re-test: `npm test`, `test:flake`, lint, typecheck, `mutate:canary`.
- F01 refit: `createTemplate` in `beforeAll` pays a cold boot: 30 s hookTimeout, not the 6 s testTimeout; re-run `test:flake` 5 of 5 and the db project.
- F09 refit: guards instead of `!` can weaken an assertion; the checker diffs spec intent test by test.
- W14: generator changes must keep 01 to 10 byte-identical; R7 to R10 on 01 to 10 may fail: report as a separate flagged fix card, never exempted silently; W15 re-specced on top. Re-test: `verify.mjs`, `make-csv --check`, a double regenerate, `git diff --exit-code` on 01 to 10.
- The spec gate costs a lint and test run per spec job, minutes only.
