# Family: journey ({kind}, stage {stage})

Cards J2-K01 to J6 (ids keep the old numbers; `params.stage` names the stage). Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 00 (the kinds), the stage's blueprint file, and `e2e/_harness/` (JH0).

## Goal
Prove that {kind} goes through everything built up to stage {stage}, end to end, with the right results. This is how "every return kind still passes" is enforced (END-9).

## Build
- `e2e/kinds/{kind}/{stage}.spec.ts`, using the harness to load the kind and run the pipeline. Runs in the cloud (Postgres 16), never on GitHub.
- evidence (phase 1): the pipeline steps intake, read, facts, books and gaps run on the kind's Drive and QBO stand-ins, and the kind's .GFI stand-in is uploaded through B01's `importGfi` (the preparer's act, no screen yet); every document is read, every fact has its box and dot, the books read from the QBO stand-in balance and keep their snapshot pointers, every GIFI total traces to its accounts, gaps are right. This is the phase 1 gate ("10 test files fully traced to source"): at least ten kinds green.
- return (phase 2): import file, the lock export through the simulator (with its planted faults), the trace with every cell class including dropped and rolled forward.
- checks (phase 3): every expected flag and exception appears, and no others; tier as expected; the approval fingerprint.
- screens (phase 3): the staff screens walked by keyboard for this kind: brief, full review with "Reviewed, next" marks, source in under a second, the cite button, approval, rework; axe clean; screenshots compared with the approved designs.
- learning (phase 4): lessons from all thirteen kinds: causes and ranking as expected; the check export before transmit; the frozen binder.

## Acceptance checks
1. The journey passes for {kind} against the kind's expected results.
2. Each planted fault of the kind is caught at its expected stage.
3. Run twice, the result is the same (no flaky steps).

## Not in this card
Fixing product code. A failing journey is reported, and the Lead cards the fix.
