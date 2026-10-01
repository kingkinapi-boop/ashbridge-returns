# Phase 0 card review

1 Oct 2026. Independent reviewer (did not write the cards). Read: CLAUDE.md, `.claude/rules/testing.md`, `blueprint/README.md`, blueprint 00, 03, 04, 09 and the cited clauses in 02, 05, 08, `plan/slices.json`, every phase 0 card, `plan/cards/families/kind.md`. Branch `claude/review-phase0`.

All fifteen cards serve the plain end state v1.1 (items 3, 4, 5, 11 and 13). Every cited clause exists. No card is above L. Nothing costs money, touches live data or the client app, or carries client wording.

## Per card

| Card | Verdict | Fixes made |
|---|---|---|
| F00 | Fixed | Added ARC-21 to the card (slices had it) and a `security` tag line. Vitest `unit` includes `tools/test/**/*.test.mjs` (F08 needs it). Playwright `testDir: 'e2e'` (JH0 and SK0 live outside `e2e/smoke/`). `.gitattributes` gains `*.pdf binary` and `-text` for `__golden__` and `__fixtures__`, with the reason: the laptop has `core.autocrlf=true`, so every sample `import.csv` is checked out with CRLF today although committed as LF; F03, S00 and W00 compare bytes and refuse CRLF. New check 7: a fresh checkout has LF. |
| F01 | Fixed | Removed `80_jobs.sql` from the file list (F06 owns it; it was listed twice and is not in Paths). Tags: core (money, permissions) and security. New checks: SEC-6 with a no-grants role reading zero rows; ARC-2 every table in `returns`; ARC-10 version stamps required; FLOW-1 one current state and no state change without an event. FLOW-1, ARC-2 and ARC-10 had no check before. |
| F03 | Fixed | Tagged core (CSV) in card and slices. ARC-14 added to the card. The prior-year field is optional: every sample `import.csv` has two fields per row, so without this S00's goldens could not parse. Check 1 now also round-trips sample client 01's file. New checks: identifier grammar refusals (RT-3) and the six RT-14 classes. Clause IDs on every check. |
| F04 | Fixed | AI-6 was tested but not cited: added. AI-4 was cited but untested: new check that a box citation needs quote, page and box. Its box is F09's schema (dep F09 added, so there is one box shape). Check for `additionalProperties: false` on every step schema. Tagged core (citations). |
| F05 | Fixed | ARC-13 added to the card (slices had it). Tagged core (money). "Agrees to the dollar" defined as a difference under 100 cents (amber below). New checks: reconciliation arithmetic property (CK-4, ARC-13), CK-6 exception fields required, reconciling item type and source required. |
| F08 | OK | None. |
| F09 | OK | None. ARC-6 has no check of its own here; A01 covers it. |
| W00 | Fixed | Kind ids made two-digit (`K01` to `K13`) to match the W cards and `testworld/kinds/<kind>/`; clause IDs on checks 4 and 7. Verified: all 39 BNs and SINs in the sample clients fail the check digit, no e-mail or phone numbers, C10's missing May is a listed fault. |
| S00 | Fixed | RT-2 says the simulator uses a placeholder token cell until the trial; no card built one, and T01 and T02 need it. Added it to S00 (one constant, marked placeholder) with check 10, and RT-2 to its clauses. |
| S01 | OK | None. |
| S02 | Fixed | It has to replace S00's default identifier list, but `index.ts` was not in its Paths: added. |
| S03 | Fixed | Same for `index.ts`, plus `faults/**` (the card says it changes S01 faults the trial contradicts). Still waits on P02 (parked) as intended. |
| A01 | OK | None. Shares `package.json` with JH0, so `next.mjs` runs them one after the other. That is fine. |
| JH0 | Fixed | Contradiction fixed: check 3 said a journey with no steps fails and check 8 said zero built kinds fails, but the card also wants the train green while kinds are written, and at JH0 time nothing is built. Now: without `--require-all` a journey passes on the load check plus built steps and lists the not-built ones; with the flag, they fail. "Zero journeys" fails, not "zero kinds". Steps are one file each in `e2e/steps/<step>.ts`, found by glob, so step cards never edit the harness and never overlap. Paths add `e2e/steps/README.md` and `package-lock.json` (axe and a Postgres client are new dev dependencies). |
| SK0 | Fixed | Runnable now. It ran K01, which has no sample client (it is "new" and W01 builds it in phase 1), and SK0 did not depend on W01. It now runs sample client C01 through `loadClient('C01')`. The wiring moved from `src/modules/skeleton/` to `e2e/skeleton/`, because F00's boundary rule forbids one module importing two others. A committed script builds one made-up PDF fixture holding a C01 value that is also in its `import.csv`. Steps are `e2e/steps/skeleton-*.ts`. Clause IDs on every check (RT-14 added). New negative check: a blanked amount fails at the read step. Spec commit line added. |

Tools after the fixes: `node tools/status.mjs` shows 0 in flight and 2 done of 279. `node tools/next.mjs 12` would start F00 and D01. `node tools/matrix.mjs --plan` gives PLAN OK.

## Bigger issues for the Lead

1. **A composition root for the real pipeline.** F00's rule lets a module import only `src/contracts`, `src/core` and its own folder. Something must still wire intake, reading, books, figures, the import writer and the trace together in the product (server actions in `src/app`, or a named `src/modules/pipeline` exception). Decide before the phase 1 and 2 cards that need it. SK0 avoids the question by living in `e2e/`.
2. **Postgres 16 in cloud sessions** (JH0 check 7, SK0, ARC-4): nothing says how it is provisioned (an apt package in the session, or an embedded-postgres npm package). It must be free and have no account. Confirm it in the small-width rehearsal.
3. **Cards that replace SK0 stubs** must list `e2e/skeleton/stubs.md` and the skeleton step file in their own Paths. Put this in the cards that own the fact, figure, mapping and tie (E01, the figure builder, M00, Q00) when they are written. Those edits make those cards share paths, so they run one after another.
4. **T01 and T02** should cite S00's placeholder token constant when they are written (RT-1, RT-2).
5. **Laptop CRLF:** until F00 lands, any local run that reads the sample CSVs sees CRLF. After F00's `.gitattributes` lands, give each existing clean checkout and worktree a fresh copy of its text files (a fresh worktree is simplest). Otherwise check 7 fails locally.
6. **F03's export settings** are still to be chosen (the card leaves this open). The Lead logs the choice when the card lands, and S03 checks it against the trial.

## Red

None.

## Ambers to log (one line each)

- F05: CK-3 "to the dollar" means an absolute difference under 100 cents, not "both round to the same dollar". Why: 100.49 against 100.51 must tie. Reverse: compare rounded dollars.
- SK0 runs sample client C01 instead of kind K01, and its wiring lives in `e2e/skeleton/`. Why: K01 does not exist until W01 in phase 1, and the module boundary rule forbids cross-module imports. Reverse: depend on W01 and add a boundary exception.
- JH0: one file per step in `e2e/steps/`, found by glob. Without `--require-all` a journey passes on the load check plus its built steps. Why: no path overlap between step cards, and the train stays green while steps are written. Reverse: one central register, with every step required.
- S00 carries a placeholder token cell (RT-2). Why: RT-2 calls for one until the trial, and T01 and T02 need it. Reverse: drop it and wait for S03.
- F00 `.gitattributes`: `*.pdf binary`, plus `-text` on `__golden__` and `__fixtures__`. Why: byte tests and planted CRLF or BOM faults on a laptop with autocrlf. Reverse: remove the lines.
- F03 accepts rows with no prior-year field. Why: every sample `import.csv` is written that way. Reverse: require three fields and regenerate the samples.
- Core tags on F01, F03, F04 and F05, and F04 depends on F09. Why: money, CSV, citations and permissions are core (CLAUDE.md), and one box shape. Reverse: remove the tags and the dependency.
