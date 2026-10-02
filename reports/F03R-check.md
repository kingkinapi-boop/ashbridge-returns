# F03R check (cloud-d2cfdd, 2 Oct 2026)

FAIL (one finding). Everything else passes.

Passed: typecheck, lint, deps:check, npm test (29 files, 664 tests), spec files unchanged since 7145c18, scope clean, mutation canary, mutate:changed F03R 100 on taxprep.ts. The Opus adversarial read agrees the apostrophe rule, the day 5 goldens, the writer text check and the parseCellId re-validation are correct.

## Failure
1. `src/contracts/taxprep.ts:535`: a rate of 1e21 or more is written as `1e+21` (`(1e21).toFixed(4)`), and the parser refuses it as `scientific`. The precision check at line 536 compares equal, so it does not catch this. Breaks acceptance check 3 (no file the writer makes fails its own parser). Existing code, but F03R owns the file. Reproduce: `node -e "console.log((1e21).toFixed(4))"`.
   Fix options: an upper bound on the rate, or run the written text back through classifyValue as the text branch does.

Rule candidate: every writer branch (amount, date, rate, yes/no, text) runs its output back through classifyValue, with a property test that writes and then parses each kind.

## Not a fail (note for the findings reviewer)
taxprep.ts:189 refuses `-'12` but accepts `-'1.5`, `-'1,234` and `12'` as plain text. Fits the card's "leading apostrophe" reading, but the apostrophe-after-minus treatment is inconsistent.

## Permission gaps
None.

## Model
Worker on Sonnet 5.5; adversarial read by an Opus subagent.
