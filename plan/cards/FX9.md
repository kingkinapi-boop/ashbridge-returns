# FX9 CSV line endings: .gitattributes and the committed CSVs (R37)

Phase 0. Size S. Deps: SC, W16, FX8. Where: cloud.
Tags: core (Taxprep CSV bytes are what the import reads).
Paths: .gitattributes, reference/**/*.csv
Clauses: ARC-10, RT-14
Read: `reports/SC-findings.md` (R37), `reports/SC-spec-review-3.md` (landing traps), `plan/cards/SC.md`.
Spec commit: (spec-writer fills)

## Goal
SC's R37 holds exact KNOWN entries for the committed CSVs whose line endings break the rule; a new Taxprep trial CSV committed before this card fails R37. Split out of FX7 so it can land as soon as SC, W16 and FX8 (which rewrite sample-client CSVs) are on main (A415).

## Spec
SC's R37 is the test: this card's spec job deletes every R37 KNOWN entry owned by FX9 so the rule fails on main for the right reason, and adds one planted CSV with the wrong ending.

## Build
One .gitattributes line for `*.csv` and `git add --renormalize` of the listed CSVs; no byte other than line endings changes (the check diffs with `--ignore-cr-at-eol` and sees nothing).

## Check
A checker who did neither: R37 green with no FX9 entry left; `node reference/sample-clients/verify.mjs` green; the diff ignoring line endings is empty.
