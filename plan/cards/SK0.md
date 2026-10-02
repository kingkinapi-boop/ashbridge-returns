# SK0 Walking skeleton: one sample client from document to trace, stubs allowed

Phase 0. Size M. Hard. Deps: F01, F03, F04, F05, F09, F09A, W00, S00, A01, JH0. Where: cloud.
Paths: e2e/skeleton/**, e2e/steps/skeleton-*.ts
Clauses: END-9, END-2, ARC-7, RT-14
Read: `reference/lessons-deep.md` pattern 1, blueprint 00 (END-2, END-9), 04 (the lock export and the trace), `plan/cards/JH0.md`, `plan/cards/W00.md`, `reference/sample-clients/01-maple-ridge/` (answer key and `taxprep/import.csv`).
Spec commit: (spec-writer fills)

## Which client
Sample client C01 (`reference/sample-clients/01-maple-ridge/`, loaded through W00's `loadClient('C01')`), not kind K01: K01 is a new sample client that W01 builds in phase 1, and SK0 must not wait for it. When W01 lands, a one-line follow-up may add K01 to the skeleton; C01 stays.

## Goal
From the first week, one thin path runs end to end for sample client C01: a document goes in, a fact comes out with its box, a figure is built, the import file is written, the simulator takes it and exports it, and the trace classes every cell. Every train must keep it green. In the client app build every part passed its own tests while no client could finish; this card exists so that never happens here.

## Build
- `e2e/skeleton/`: the thinnest wiring between the real contracts (F01, F03, F04, F05, F09), the real reader (A01) and the real simulator (S00), with stubs where a module is not built yet (one fact, one figure, one mapping row, one tie). The wiring lives under `e2e/`, not `src/modules/`, because F00's boundary rule lets a module import only `src/contracts`, `src/core` and its own folder, and the skeleton must call two modules. Each stub is one small function named `stub...` and is listed in `e2e/skeleton/stubs.md` with the card that replaces it. The steps are added as `e2e/steps/skeleton-*.ts` files (JH0's register), so the harness is not edited.
- `e2e/skeleton/fixtures/`: one made-up one-page born-digital PDF for C01 holding one amount from C01's answer key that is also a value in C01's `taxprep/import.csv` (for example the cash line), so the figure has a known cell, built by a committed script with the same free library A01's fixtures use, and the expected box as JSON. No real data; the name ends "(Test)".
- `e2e/skeleton/c01.spec.ts`: the journey through the harness (JH0), on Postgres 16 in the cloud and the production build.
- When a later card replaces a stub, it removes the stub from the list and the skeleton still passes; that card lists `e2e/skeleton/stubs.md` and the step file in its own paths.

## Acceptance checks
1. END-2: the one figure on the skeleton's return traces back to its box on the C01 document (page and box equal the fixture's expected box, and F09's `valueInBox` holds).
2. RT-14: the simulator's lock export holds every imported cell: the trace classes none of them "dropped" (the receipt export is gone, amber A30).
3. RT-14: the trace classes the imported cell as traced and a cell typed by hand in the simulator (`typeCell`) as an orphan.
4. END-9: the skeleton runs in every train run (it sits under JH0's journeys) and takes under two minutes.
5. ARC-7: `e2e/skeleton/stubs.md` lists every stub function in `e2e/skeleton/`, each with the card that replaces it, and no file under `src/` imports anything from `e2e/` (a dependency-cruiser or grep check).
6. END-2: run on a second fixture with the amount blanked, the pipeline's read step returns "value not found" with the reason and the pipeline result is a failure (the test asserts that failure; it never passes silently).

## Not in this card
Real extraction, books or checks. Any screen.
