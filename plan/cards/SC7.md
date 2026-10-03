# SC7 One shared KNOWN helper for every rules file

Phase 0. Size S. Deps: SC, SC2, SC3, SC4, SC5, SC6. Where: cloud.
Tags: core (the exemptions every rule test trusts).
Paths: tools/test/lib/known.mjs, tools/test/lib/known.test.mjs
Clauses: ARC-15, ARC-16
Read: `reports/SC-findings.md` (KNOWN shape), `plan/cards/SC.md`, `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Goal
Each rules file carries its own KNOWN check; SC defines the shape (A407). This card moves it into one helper so a new rules file cannot ship a looser check. The rules files switch to it in their own owners' next rounds; this card only builds and tests the helper.

## Spec
The KNOWN shape as a tested helper: planted bad entries (a regex match, two files, a done owner, an unlisted problem, a stale string) each fail; a good list passes; an empty scan fails.

## Check
A checker who did neither: the helper's tests, `npm test`.

## R80 (A414, reports/FX2-findings.md)
The helper also refuses a KNOWN entry whose file is outside its owner card's Paths, or whose owner is not open in plan/slices.json. Planted: SC5's R73 entry owned by FX2 as first carded; A06 (done) owning auth/index.ts.
