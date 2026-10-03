# GL5 AI evaluation report for go-live

Phase 4. Size S. Deps: I40, J4-K01 to J4-K13. Where: local or cloud.
Tags: none (no money arithmetic, no AI call of its own, no permission; it reads I40's results and never approves anything).
Paths: src/modules/ai/evals/report/**
Clauses: LIVE-7, AI-11, AI-10
Read: blueprint 10 (LIVE-7), 05 (AI-4, AI-10, AI-11), 09 (ARC-16, ARC-22), 08 (SEC-11); `plan/cards/I40.md` (`evaluate`, the result file, `measures.json` directions, the gate, baselines, `approved.json`), `plan/cards/A04.md` (the `recorded` and `project` engines), `plan/cards/A08.md` (the run-once launcher), `src/contracts/ai.ts` (step types), decision 0008 (Z8-11: AI through the subscription), `reports/phase4-card-review-2026-10-03.md` (C3).
Spec commit: (spec-writer fills)

## Goal
At go-live the AI is measured on the fixed test set with the live model and the numbers are shown to Zo (LIVE-7). This card runs every step's set through I40's harness with the engine and model it is given, and writes one plain report: for each AI step, each measure against its approved baseline, and one verdict, "ready" or "not ready" with the reasons. It decides nothing: approving a triple stays I40's gate, run by the Lead.

## Spec
- Fixtures (recorded engine, pinned clock, fixed seed): I40's fixture sets and baselines for at least three step types; one step whose result is one basis point worse than its baseline on a higher-better measure; one with "no cases" now where its baseline had cases; one set file with no result; one result on an older set version; sentinel values planted in case inputs (a unique name and amount).
- Classes:
  - Run: `goLiveRun(engine, modelId, deps)` takes each set in `data/ai/evals/sets/`, the step's prompt version from its latest approved triple, and the model id given, and calls I40's `evaluate`; it writes a manifest (engine, model id, run time from the injected clock, each step with its result file and set version) to the folder the call names. In tests the engine is `recorded`; the real run uses `project` through A08 on made-up returns only (SEC-11).
  - Report: `buildReport(manifest, deps)` gives, per step: the triple, the set version, the case count, and each measure with its declared direction (I40's `measures.json`), the baseline, the new value and the change. Basis points print as a percent with two decimals by integer arithmetic (9725 prints "97.25%"); "no cases" prints as "no cases". Property (fast-check, fixed seed): for any basis points from 0 to 10,000 the printed percent parses back to the same integer.
  - Decision per step uses I40's own gate against a temp copy of `data/ai/approved.json` (the report keeps no comparison of its own); the real `approved.json` is byte-unchanged after any run (test).
  - LIVE-7 verdict: "ready" only when every set has a result on its current set version, every result ran on the engine the run names as live (`project`), and no step is blocked by the gate. Otherwise "not ready", listing each reason: a set with no result, an old set version, a result from `recorded`, each worse measure by name, a measure with cases in the baseline and "no cases" now. Planted: each fixture above gives exactly its reason.
  - AI-10: each step's row shows the model id and prompt version from the result's stamp; a result whose stamp names a model other than the run's model id is "not ready" naming both.
  - No inputs or values: the report and the manifest hold ids, measure names and numbers only; no planted sentinel appears in any output (scan of every file written and everything printed).
  - ARC-16: two runs on the same recorded sets give byte-identical reports.
- Output: `report.md` (for Zo, plain words, one table per step and the verdict on top) and `report.json`, in the folder the call names; the Lead links `report.md` from Zo's to-do at go-live.

## Build
- `src/modules/ai/evals/report/`: `goLiveRun`, `buildReport`, `cli.ts` (prints the verdict and the report's path only). `// @mutate` on the verdict and the percent printing (mutation 100, ARC-15).

## Check
A checker who did neither: acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, I40's tests unchanged and green, the sentinel scan green, scope clean.

## Not in this card
Running the live model (the go-live run, LIVE-7: the Lead through A08 on the subscription, made-up returns only). Approving any triple (I40's gate). Measures that need real returns (N20).
