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
An entry whose fix is a file in its owner's Paths other than the flagged file (R37: FX9's .gitattributes fixes the CSVs) names that fix file, and R80 accepts it.

## Also (A452)
A rule: no KNOWN, allow or PENDING entry in any rules file carries a postponed reason ("waits on", "later") without an open owner card id; reading-rules' regex KNOWN, SC11's R92 allow list and SC9's PENDING list are its first subjects.

## Also (A463)
R31 timed out at 5 s under full laptop load: give it an explicit timeout, as R50 has (60 s).

## Also (A465)
List the modules whose every test is a db test (jobs/queue.ts, jobs/runner.ts first, from FX15) and decide per module: unit twins on PGlite in the unit project, or a reasoned entry. A core card may not list such a module without one.

## Also (A467)
The KNOWN owner rule (an open card in plan/slices.json with a card file) is shared: SC7 makes every rules file use the one helper, so security-rules, fs-rules and db rules read owners the same way.
