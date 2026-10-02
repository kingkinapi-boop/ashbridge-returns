# Findings review: E03 and F03 (2 Oct, Opus, cold; text returned to the Lead and recorded here)

Inputs: E03-check (claude/E03-check), E03-build, F03 spec/build/check (claude/F03), cards E03, F03, SC, TH, earlier findings reports, builder.md, checker.md, spec-writer.md, tools/scope.mjs, tools/mutate-changed.mjs. Git reads only.

## Root causes (4)
- RC1. The builder's "done" was a subset of the checker's (no lint, deps:check, mutate:changed, @mutate marker). E03: 3 restrict-template-expressions errors (facts.ts:125, :169), built on Node 22. F03: no marker on taxprep.ts, Stryker never run. Every builder.
- RC2. Mutation testing is opt-in by a hand-placed marker and a missing marker passes silently (mutate-changed exits 0, "no mutation targets changed"). Unmarked core files: src/contracts/checks.ts on main (F05, never mutation-tested); F01 records.ts, ids.ts; F09 reading.ts; E03 facts.ts; to build: F04 ai.ts, S00. SC's R18 goes red on main for checks.ts when it lands.
- RC3. scope.mjs does not match how jobs produce files: (a) spec files allowed only by name pattern, so a spec `__fixtures__/` file fails scope (E03 src/contracts/__fixtures__/fact-catalogue.ts, untouched by the builder); (b) cloud workers commit ledger rows on card branches (F03 fbe5e11; also F01, W15, A05-check). Checker step 5 diffed only acceptance tests and goldens: widening scope without widening the diff would let builder fixture edits pass unseen.
- RC4 (F03). One planted fault per check, not every refusal path: mutation 75.25 (167 survived, 32 no coverage). Samples: CP1252 undefined bytes U+0081, 008D, 008F, 0090, 009D not refused on write (RT-9); `A.B[1]x` not refused ($ anchor, RT-21); `i <= out.length` equivalent. Mostly missing tests plus some equivalents.

## Card checks (amber, none red)
- E03: Paths lack the spec fixture. Check 4 accepts any non-empty cite (53 cra_form, 27 onboarding_contract free text; CRA lines "best-effort from memory"); no committed GIFI or T2 line list. E03 cannot pass CI until TH's .gitleaks.toml lands: board after TH.
- F03: card right; Build should name the marker. Reference export CSVs stored LF (`text=auto eol=lf`), so the byte-for-byte golden runs on rebuilt bytes: re-add the originals with `-text` if the inbox still holds them, else keep the CRLF rebuild and log it.

## Fix list
1. Lead (done 2 Oct): builder.md runs typecheck, lint, deps:check, scope and (core) mutate:changed with the marker, Node 24; checker step 5 diffs every spec-commit file incl. `__fixtures__`; cloud runs never commit plan/ledger.jsonl on card branches. Cards: every core card's Build names the marker (F01, F03, F04, E03, S00 and later); E03 Paths gain the fixture.
2. New tool card DG (done gate): scope ignores plan/ledger.jsonl and allows exactly the `spec(<card>)` commits' files; mutate-changed takes the card id and fails when a core card changes a src file without the marker; `.gitattributes` `plan/ledger.jsonl merge=union` if not already set. Rule tests R19 to R21.
3. New fix card for F05: marker on checks.ts, Stryker, survivors as in step 5; lands before SC.
4. F03 helper (cloud): Stryker JSON on taxprep.ts; every survivor and no-coverage mutant as line, mutator, class (clause / internal / equivalent) in reports/F03-mutants.md.
5. F03 spec round 2 (new worker, validated on main): acceptance cases for every clause-class survivor, at least the five undefined bytes refused on write, `A.B[1]x` and `A.B[1]]` refused; property alphabet avoids those bytes.
6. F03 build round 2: marker; unit tests for internal survivors; equivalents removed by rewrite or a reasoned disable comment; no-coverage code deleted or tested; ledger reverted; bar mutate:changed 70 and no clause survivor.
7. E03 spec round 2: onboarding_contract refs name a field in reference/onboarding-contract.md; cra_form refs match "Schedule NNN line NNNN" or "T2 line NNN" (planted bad refs); the line-list check itself recorded as a defect on M00.
8. E03 build round 2: `String(...)` for the 3 template values; marker on facts.ts, mutate:changed 70; Node 24; board after TH.

## Rule tests (card DG)
- R19 scope: ledger rows pass; a spec-commit fixture outside Paths passes; a builder file outside Paths fails; a builder edit to a spec fixture fails the widened diff.
- R20 mutate-changed: a core card with an unmarked changed file fails; an unmarked non-core file passes.
- R21 no card branch's diff against main contains plan/ledger.jsonl.
- SC R18 reads "core" from the card's Tags line plus Paths (slices.json has no tags).

## Risks and re-tests
Markers turn mutation on (E03 may score under 70: the builder runs Stryker before reporting). R18 red on main for checks.ts and unmarked F01, F09, F04 files: order the F05 fix and the F01/F09 markers before SC. Ship steps 1 and 2 together. F03's new write refusals must not break the read side (rt-07 golden and round-trip property). The F03 parser refuses a valid Windows-1252 text that forms UTF-8 (spec amber 6): log it on T02. Re-test: typecheck, lint, deps:check, npm test, mutate:canary 100, mutate:changed, scope, widened spec diff, gitleaks after TH.
