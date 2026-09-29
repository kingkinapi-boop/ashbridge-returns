# Family: journey ({kind}, phase {phase})

Cards J2-K01 to J6. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 00 (the kinds), the phase's blueprint file, and `e2e/_harness/` (JH0).

## Goal
Prove that {kind} goes through everything built up to phase {phase}, end to end, with the right results. This is how "every return kind still passes" is enforced (END-9).

## Build
- `e2e/kinds/{kind}/phase{phase}.spec.ts`, using the harness to load the kind and run the pipeline. Runs in the cloud (Postgres 16), never on GitHub.
- Phase 2: every document is read, every fact has its box and dot, the books balance, gaps are right.
- Phase 3: import file, exports 0 to 3 through the simulator (with its planted faults), the trace, both gates.
- Phase 4: every expected flag and exception appears, and no others; tier as expected.
- Phase 5: the staff screens walked by keyboard for this kind: brief, full review with coverage, source in under a second, approval, rework; axe clean; screenshots compared with the approved designs.
- Phase 6: lessons from all thirteen kinds: causes and ranking as expected.

## Acceptance checks
1. The journey passes for {kind} against the kind's expected results.
2. Each planted fault of the kind is caught at its expected stage.
3. Run twice, the result is the same (no flaky steps).

## Not in this card
Fixing product code. A failing journey is reported, and the Lead cards the fix.
