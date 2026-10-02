# TH Test homes: every test runs, every file is typed and linted

Phase 0. Size S. Deps: F00. Where: local or cloud.
Tags: none (test configuration; no money, tax, CSV, citations or permissions).
Paths: vitest.config.ts, vitest.mutate.config.ts, tsconfig.json, tools/test-homes.json, tools/test/toolchain-rules.test.mjs, tools/test/__fixtures__/**, src/core/egress-rules.acceptance.test.ts
Clauses: ARC-17, ARC-9, ARC-4
Read: `reports/findings-W14-D01.md` (RC2, fix 2, rules R1 to R4, risks), blueprint 09 (ARC-4, ARC-9, ARC-17), `.claude/rules/testing.md`, `vitest.config.ts`, `vitest.mutate.config.ts`, `tsconfig.json`, `eslint.config.mjs` (read only), `tools/test/toolchain-rules.test.mjs`, `tools/test/db-rules.test.mjs`.
Spec commit: (spec-writer fills)

## Goal
Tests outside `src/` and `tools/test/` have no home today: D01's 19 tests never run in `npm test`, D00 brought its own Vitest config, and any `.ts` under `testworld/` or `design/` is a hard lint error that `typecheck` skips. TH gives them one home in the shared config, so D00, D01, W00 and every later `testworld/` card are run, typed and linted like `src/`, and a rule test stops the gap from opening again. Spec and build are two different workers; F00 is closed, so this card owns the change.

## Who does what
- The spec job writes R1 to R4 in `tools/test/toolchain-rules.test.mjs` (unit project), each first failing on a planted bad example under `tools/test/__fixtures__/test-homes/`, and validates on main (spec-writer step 6).
- The build job edits the config files and the data file only; it never edits the rule tests.

## Build
- `tools/test-homes.json`: the include globs, one list per Vitest project and one for the tsconfig include, read by both `vitest.config.ts` and the rule tests, so the two can never disagree.
- Vitest `unit` include gains `design/**/*.test.ts` and `testworld/**/*.test.ts`, never `*.db.test.ts`; `db` include gains `testworld/**/*.db.test.ts`. The `unit` project's setup (network guard, `TZ=America/Toronto`, pinned clock reset) applies to them unchanged.
- `tsconfig.json` include gains `design/**/*.ts` and `testworld/**/*.ts`; the `.stryker-tmp` exclude stays.
- `vitest.mutate.config.ts`: keeps the unit project only; if it copies the unit include, it reads the same data file. `npm run mutate:canary` still scores 100.
- The walks in R1 to R3 skip `node_modules`, `.stryker-tmp`, `.next`, `__fixtures__` and `.claude/worktrees`.

## Acceptance checks
1. ARC-17 (R1): every `*.test.{ts,tsx,mjs}` outside `node_modules` and `__fixtures__` is matched by exactly one Vitest project (`unit`, `db` or `evals`), and every `*.db.test.ts` only by `db`. Planted: `design/x/x.acceptance.test.ts` with no home, and `testworld/a.db.test.ts` matched by `unit`.
2. ARC-17 (R2): every `.ts` and `.tsx` file that lint does not ignore is inside the tsconfig include. Planted: `testworld/qbo/x.ts` outside the include.
3. ARC-17 (R3): no `vitest*.config.*` file exists outside the repo root. Planted: `design/basis/vitest.d00.config.ts`.
4. ARC-4 (R4): no test file outside `src/core/db/` names the shared `db/schema` folder (tests that need tables use `createTemplate` on their own temp folder, or the clone the `db` project gives them), so no test asserts an exact table set that the next schema file breaks. Planted: an acceptance test that reads `db/schema` and asserts its table list.
5. ARC-9: `vitest.config.ts` and the rule tests read their globs from `tools/test-homes.json` (a planted config with its own literal include list fails R1).
6. On the merged branch: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:flake` (5 of 5) and `npm run mutate:canary` (100) pass on main as it stands. New errors that the wider net finds in D00, D01 or W00 spec branches are expected and are those cards' spec refits, never fixed here.

## Not in this card
Fixing the tests or files the wider net flags on other branches (their spec refits). Any change to `eslint.config.mjs`, `package.json` or the `db` project's timeouts. Lint or type rules beyond the include lists.

## Also (A05 security review, 2 Oct)

gitleaks: `.github/workflows/checks.yml` scans only the branch's own history (`--log-opts="HEAD"`), and a root `.gitleaks.toml` (`[extend] useDefault = true`) allowlists the fact catalogue's `"key": "<dotted name>"` lines by regex and planted test values starting `PLANTED-` or `k-test-`, never whole folders. Paths gain `.github/workflows/checks.yml` and `.gitleaks.toml`. Check: a branch with a planted secret-shaped string outside the allowlist still fails.

## Lead's choice (2 Oct, amber A287)

R1 covers the product and build tree only: `reference/**` is out of scope (its helper tests, such as `reference/taxprep/tools/strip-values.test.mjs`, are trial tools run with `node --test`, never product). R1's walk skips `reference/`, `node_modules`, `.stryker-tmp`, `__fixtures__`. No spec change is needed if the spec's planted examples sit outside `reference/`; if a spec test asserts on `reference/`, the builder notes it and the check decides.

## Fix for the spec (Reviewer SLOW 2 Oct, finding 6)
Two tests in `src/core/egress-rules.acceptance.test.ts` pass with the feature deleted; the TH spec job rewrites both (Paths gain the file), each first shown failing on a planted bad example under `tools/test/__fixtures__/egress/`:
- line 292, "SEC-5 ESLint refuses console and interpolated logger messages": reads config strings and lints nothing. Rewrite: run ESLint (`lintText` with a `src/` file path) on a planted file holding a `console.log` and an interpolated logger message, and assert both errors by rule id; a clean file gives none.
- line 216, "SEC-10 every checkout sets persist-credentials: false": passes when there is no checkout step. Rewrite: assert at least one `actions/checkout` step is found in `checks.yml`, and a planted workflow whose checkout lacks the setting fails.

## Also (2 Oct): flaky egress test

`src/core/egress-rules.acceptance.test.ts` SEC-5 ESLint case times out under whole-suite load and passes alone (local worker report, S00 spec). A flaky test is a failure (testing.md): TH's egress rewrite gives that case its own timeout budget or runs ESLint once per suite, and the flake run covers it.

## Build round 2 (2 Oct, A306 single cause)

The check passed, but the branch's own GitHub run still fails gitleaks with `--log-opts="HEAD"`: 1 leak in the branch history (402 commits). Run gitleaks with `-v --redact` (the CI step may add `-v`) to name the rule, file and line; never print a value. A planted test value (TH's own "planted secret still fails" case, or A05's `PLANTED-`/`k-test-` values) gets a regex allowlist entry scoped to that pattern; anything that looks like a real secret: stop, release with the rule and file, and the Lead decides. TH boards only with every GitHub step green.
