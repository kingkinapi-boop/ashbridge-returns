# W00 build round 2 (cloud-40b1f5)

Branch claude/W00, code complete; NOT ready to board: mutation gate and security review open.
- B1: strict `decimalToCents`/`centsToDecimal` now in `src/core/money.ts` (testworld/model/money.ts removed, `dollarsToCents` gone); loader reads money from the JSON source text (reviver with `context.source`, money fields by holder shape, rates untouched); a 3-decimal amount is a `money` issue.
- B2: guard (`testworld/model/guard.ts`) reads every json/csv/md file in the folder: name fields, nine-digit numbers (plain, spaced, hyphened, RT suffix), e-mails, phones in all formats, person names in descriptions need TEST.
- B3: `faults.ts` hand-written (105 flags + C10 roll waivers); roll waiver and flag list read the catalogue both ways; no vacuous passes (no balances, undeclared account, empty entry, null GIFI unless "confirm").
- Results: typecheck, lint, deps:check clean; `npm test` 1244 unit + 2 db pass (all round 2 acceptance tests pass, none edited).
- B4 OPEN: `mutate:changed` marks every changed testworld file (tool requires all, not the four in B4) and scores: money 67, load 70, generate 76, checks 83, faults 84, guard 79, kinds 84, schema 72; all must be 100. Needs a unit-test survivor round (builder tests, plus decide whether load/generate/schema/kinds/index need marking at all: Lead call). Full log 1721 mutants.
- B5 OPEN: /security-review not run.
- scope.mjs FAILs only on `plan/cards/W00.md` (Lead's commit 8d44550), not a builder edit.
Ambers: faults `planted` uses the flag's rule text; month `rolls` in the model is now computed, the answer key's own bit is ignored.
Permission gaps: none. Model: Sonnet 5.5.
