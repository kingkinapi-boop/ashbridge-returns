# SC7 One shared KNOWN helper for every rules file

Phase 0. Size S. Deps: SC, SC2, SC3, SC4, SC5, SC6, SC10. Where: cloud.
Tags: core (the exemptions every rule test trusts).
Paths: tools/test/lib/known.mjs, tools/test/lib/known.test.mjs, tools/test/lib/cards.mjs, tools/test/lib/cards.test.mjs, tools/test/schema-contract-rules.test.mjs, tools/test/reading-rules.test.mjs, tools/test/spec-rules.test.mjs, tools/test/card-rules.test.mjs, tools/mutate-changed.mjs, tools/test/mutate-harness.test.mjs (A493, A502)
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

## Also (A493): one card scan for the card rules
One card scan shared by SC, SC4, SC6 and SC10 (tools/test/lib/cards.mjs): it reads every card and family template with its params, takes sentinels and floors from the unfiltered list, filters to open cards only after that, and drops nothing silently (a card with no file fails by id). The four rule files use it. Planted: SC6's rules as at 7f6d200a with SC6 marked done (the landing trap of 3 Oct). Paths gain tools/test/lib/cards.mjs and tools/test/lib/cards.test.mjs.

## Also (A502, A503): one card reader for the four rule files and the gate
From SC10's findings review 1 and SC6's spec review (3 Oct, Opus; both reports stay on the laptop, so these lines are the brief). Deps gain SC10. Paths gain the four rule files, tools/mutate-changed.mjs and its test: they switch to the helper in this card, since SC6 and SC10 will be done by then.
- The one reader gives each card's core and security (SC10's closed form for the tags line), its Paths (from slices.json) and its Build ownership (SC6's R77 grammar) to the four rule files and the mutation gate. The gate reads family templates: today it stops on all 162 open family cards, which have no card file.
- The shared scan fails a card with no file only when the card is open: 8 closed cards have none (P02, P03, P04, B00, B02, T03, V07, T06). This replaces "a card with no file fails by id" in A493.
- On the one reader, R18 reads GL1 as core (its tags line has security first) with 6 auth files unmarked. The Lead names the card that marks them before this card's spec starts; known.json takes only FX3 to FX9 as owners.
- Rule tests for everywhere: (A) one card reader for the four rule files and the gate, planted with Q10 (the gate stops today) and GL1 (security first); (B) every card's Paths line equals slices.json, planted with A08's line before A502; (C) every exemption list (in-test KNOWN arrays, known.json, R89's guard list) names open owners whose Paths hold it, planted with SC10 at 73fe6af4.
