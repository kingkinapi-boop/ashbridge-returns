# SC10 spec report: round 2 spec patch (A502, P1 to P8)

Worker cloud-3a2ec0, 3 Oct 2026. Spec commit befeffc on claude/SC10. Validated on main 03e933e (merged twice: b99a711, then 03e933e, which changes only plan/ and .claude/rules/testing.md; the tools tests and the landing form were rerun on it, green) and on a scratch merge with CQ11's tip dc401bd (never pushed; the worktree is removed).

## What changed
- tools/test/card-rules.test.mjs: 78 tests (was 27), all pass. SC10 has no build: the rules live in the test file, so "fails first" was measured by running each new plant through the rules as at 73fe6af4 (scratch script, not committed; results below).
- Fixtures added (real forms copied from git): FX7-before-A502.md (73fe6af4), FX7-after-A502.md (main b99a711), SK0-before-A502.md and kind-before-A502.md (73fe6af4). Removed: moves-extra-move.ts.txt (R89 no longer reads moves.ts text; the plant appends a move to the imported MOVES).
- data/lifecycle/unbuilt-guards.json: unchanged (17 rows, 13 owners; it equals the guards no deps.ts registers).
- The closed forms are written in words in the test file header (reading cards, R85, R86, R87, R89, KNOWN).

## Items
- P1: origin/main b99a711 merged, then 03e933e. typecheck, lint, npm test green (unit 136 files 3253 tests; db 14 files 662 pass, 1 expected fail, 5 skipped). Landing form (SC10 set done in plan/slices.json, not committed): tools/test 26 files 539 tests green. Scratch merge with CQ11: tools/test 28 files 632 green; full unit 138 files 3346 green.
- P2: KNOWN = []. knownShape also fails an owner that is done or parked, or whose Paths do not cover tools/test/card-rules.test.mjs. Plants: FX7 pinned done (and parked) owning an entry; the six entries as at 73fe6af4 (each owner lacks this file). At 73fe6af4 both plants gave no problem.
- P3: floors(world) over every card whatever its status: at least 300 cards read, a family card read with one of its own params put in, SC10 read with the Tags word core. R85, R86 and R87 judge open cards only (not done, not parked); an open card with no text fails by id under each rule (the line 146 silent skip is gone). Plants: the live world with SC10 set done passes every rule and the floor; every card set done passes the floor and R85 to R87; a pinned open card with no file (and a family card with no template) fails by id. At 73fe6af4: R86 and R87 skipped the no-text card; with SC10 done, R89 failed on its stale KNOWN rows.
- P4: R85's closed Tags form, as the directive words it; the flags compared are core, security and screens (all 262 open cards agree on all three). The line 88 comment is replaced (core read one way: the flag or the closed Tags word, which R85 holds equal; core inside a non-core reason is refused because CQ6's gate reads any core token). Plants that fail: F03R's one-line form, SK0 and kind.md before A502, A04C's and SC3's lines before A502, core in a non-core reason, plus 13 malformed forms (test.each). B04's line passes; A04C's and SC3's lines after A502 pass. At 73fe6af4 every one of the named plants passed (no problem).
- P5: R86 reads only the Harness line (at most one; "Harness: " then full repo paths joined by a comma and a space). Listed files must be on the harness list and in Paths (any open card); a core card's harness files in Paths must be listed. Plants: FX7 before A502 fails, and with a prose line naming the file as harness still fails (73fe6af4 passed it); a card quoting R86's failure message fails (73fe6af4 passed it); DB16 line 33's base names fail; a file off the list or out of Paths fails (73fe6af4 passed both); 7 malformed lines; two Harness lines. FX7 after A502 passes. Note: FX7 before A502 alone and DB16's base names were already caught at 73fe6af4; their new tests fail there only on the new message text.
- P6: R89 takes guards from the imported MOVES. deps.ts reach: a direct createLifecycle call with an object literal; guards as an object literal (as or satisfies allowed), a same-file const object, or the shorthand; inside, literal or quoted keys, shorthand, same-file const spreads. Anything else fails as "src/pipeline/deps.ts passes guards R89 cannot read: <part>" (10 plants: a spread from another file, a helper call, a spread of a call, an imported object, a computed key, a method, a spread in the options, non-literal options, an import alias, a non-call use). Every list owner must cover the list file and deps.ts; every open card covering moves.ts must cover the list file. Plants: G00 without the list file; FX5 without it (passes with it, and when done). T12 registering its two guards by literal keys, rows deleted, set done: passes. Live: each owner set done in turn fails only its own rows. At 73fe6af4 every new plant passed or gave only a stale-row message.
- P7: R87 keeps tools/lib.mjs's specOwnedFiles; runs after the floor on open cards only (plant: CQ4 set done is not judged).
- P8: lists below. KNOWN stays empty.

## P8 lists (main b99a711; 357 cards, 262 open)
- Open cards (what the tests judge): floors 0, R85 0, R86 0, R87 0, R89 0. No open card goes to the Lead.
- Every card judged as if open (information only; done and parked cards are never judged):
  - No card text: P02, P03, P04, B00, B02, T03, V07, T06 (all parked or done; each counted by R85, R86 and R87).
  - R85 no Tags line: P01, F03R, D00, D01, D02, D03, D04, D05, D06, D07, D08, D09, D10, D12, D13, G10 to G17. Two labels: DG, SC. D11 (parked): screens false in slices.json but its Tags line says screens. FX15 (done): two parts outside the form ("reviewed as core by directive ..." and "which Stryker cannot run ...").
  - R86, R87: nothing beyond the no-text cards.
- R89: list equals the 17 unregistered guards (no deps.ts on main); all 13 owners open with deps.ts and the list file in Paths; FX5 (the one open card covering moves.ts) lists the file.

## Tests retired or rewritten (step 6b)
The stub sweep has nothing to stub (no build); the whole suite was run as above. Only tests in this file changed, each superseded by A502:
- "ARC-16 KNOWN on main has the right shape and the exact entries the card expects on landing" (old line 729): now asserts KNOWN is empty (P2).
- "ARC-15 R85 words inside parentheses or after "reviewed as" never count; a flag the Tags line lacks fails" (old line 471): retired; its forms now fail the closed form (P4), covered by the A04C/SC3 and core-in-reason plants.
- "FLOW-2 R89 the scan of moves.ts gives exactly the guards of the imported MOVES, in order" (old line 623) and the fixture moves-extra-move.ts.txt: retired (P6: never read moves.ts text).
- The R86 tests at old lines 516 to 534 now expect "the card's Harness line does not list it" and pass only through a Harness line (P5).
- R85, R86, R87 and R89 live tests: "only the KNOWN entries" became "no problem" (KNOWN empty).

## Amber
- Flags compared by R85: core, security and screens ("the slices.json flags equal the words"); all open cards agree.
- Family card text: own card file first, else the template with params (as tools/mutate-changed.mjs reads it; only D02, parked, has both).
- An open card with no text is reported under each of R85, R86 and R87 (each rule fails by id on its own).
- The R89 reach also refuses a spread or computed key in the createLifecycle options, an import alias and a non-call use of createLifecycle (a flag for a person rather than a silent pass).
- The floor's family check asserts a param is put in (a "no placeholder left" check cannot fail with the reader used).
- Spec commit line on plan/cards/SC10.md filled on this branch (the card is not in Paths; the earlier spec did the same).

## For the Lead
- No Paths gap; no rule needed loosening.
- Closed cards outside the form (F03R, DG, SC, FX15, D11 and the D and G cards above) are never judged; a reopen of any of them needs its Tags line fixed first.

## Permission gaps
None.

## Model
Opus 5.5 (spec-writer, core).
