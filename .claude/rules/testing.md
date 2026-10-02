---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "e2e/**"
  - "testworld/**"
  - "vitest.config.ts"
  - "playwright.config.ts"
  - "stryker.config.mjs"
---

# How we test (every rule here is checked by the checker; sources in `reference/build-practices.md`)

## Who writes what
- Acceptance tests are written by the spec-writer before the build, in files named `*.acceptance.test.ts`, with the clause ID first in each test name. They must fail first, for the right reason. Builders cannot edit them (a hook refuses it) and the checker diffs them against the spec commit.
- Golden files live in `__golden__/` folders and belong to the spec-writer too (Vitest `toMatchFileSnapshot`; only the spec-writer runs with `-u`). CI never writes snapshots.
- Builders add their own unit tests freely.

## The mix
- Most tests are pure unit tests (money, CSV, rules). Each module has integration tests on PGlite. Each phase has a few browser journeys, run in the cloud only.
- Two Vitest projects: `unit` (no database) and `db` (PGlite, loaded once per worker from `db/schema/*.sql`, then `clone()` per test). Run `unit` first. A third project, `evals`, is outside the default run (AI-11).
- On the laptop run only affected tests (`vitest related <files>` or `--changed`), through `node tools/heavy.mjs --`. Use the `agent` reporter: failures only.
- The `db` project also runs on Postgres 16 in cloud checks; the schema avoids features newer than the oldest Postgres in use.

## Determinism
- The clock is the injectable one (`src/core/clock.ts`), pinned in every test. `TZ=America/Toronto`, locale `en-CA`, in Vitest and Playwright (`timezoneId`, `locale`).
- Random data uses a fixed seed. Test data comes from `testworld/` or typed fixtures with fixed defaults; made-up names end in "(Test)".
- No network in tests. AI steps use recorded answers keyed by model id, prompt hash and input hash; a changed key fails with "re-record", never passes silently.
- A flaky test is a failure: Playwright `failOnFlakyTests` and `forbidOnly`; cloud runs use one retry only to detect flakiness. A flaky test gets a fix card the same day and is never skipped without one.

## What must be tested, and how
- Money and tax arithmetic: fast-check property tests as well as examples (entries net to zero; allocations and prorations sum exactly; cents stay safe integers; rounded statements still tie or carry a recorded rounding item). A counterexample found once becomes a fixed example.
- Taxprep CSV: golden files for every file written or read, per return kind, plus the fault set of RT-9 as the Taxprep trial set it (a BOM, LF-only line ends, other separators, unquoted values, (123) negatives, thousands separators, a decimal comma, scientific notation, lost leading zeros, reformatted dates, UTF-8 accents), each refused with a reason; an empty value is a clear and "0" is zero (RT-12), and both are tested.
- Every tie, reconciliation and flag: a planted fault that must be caught, and no false alarm on any clean kind.
- Mutation testing (StrykerJS, Vitest runner, `--incremental`) on changed money, tax, CSV and citation-check files; every file marked `// @mutate` must score 100 (ARC-15: one surviving core mutant fails; equivalents removed by rewrite or a reasoned disable comment), checked per file by `mutate-changed.mjs` (card DG); the overall break of 70 stays as a floor for unmarked files. Not on screens.
- Screens: ARIA snapshots for structure (section order, Approve appearing only when every section is reviewed), axe on every journey (WCAG 2.2 AA tags) through one shared fixture, keyboard-only walks, and pixel screenshots only for a few dense screens, with baselines made on the cloud Linux runner, never the laptop.
- RV-4 timing: the app marks click and source paint (`performance.mark`); the journey fails above 1000 ms on the largest test-world return.
- Every journey runs against the production build (`next build`, then `next start`), never the development server.
- Prompt injection: test-world documents carry planted instructions; the expected result is no effect.

## A test is only good if it would fail without the feature
Assert outcomes (a value, a state, a refusal with its reason), never just "does not throw". Do not mock our own modules in acceptance tests. A pass with zero tests is a failure.
