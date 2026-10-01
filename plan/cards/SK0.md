# SK0 Walking skeleton: one kind from document to trace, stubs allowed

Phase 0. Size M. Hard. Deps: F01, F03, F04, F05, F09, W00, S00, A01, JH0. Where: cloud.
Paths: e2e/skeleton/**, src/modules/skeleton/**
Clauses: END-9, END-2, ARC-7
Read: `reference/lessons-deep.md` pattern 1, blueprint 00 (END-2, END-9), 04 (the lock export and the trace).

## Goal
From the first week, one thin path runs end to end for kind K01: a document goes in, a fact comes out with its box, a figure is built, the import file is written, the simulator takes it and exports it, and the trace classes every cell. Every train must keep it green. In the client app build every part passed its own tests while no client could finish; this card exists so that never happens here.

## Build
- `src/modules/skeleton/`: the thinnest wiring between the real contracts (F01, F03, F04, F05, F09) and the real simulator (S00), with stubs where a module is not built yet (reading a single number from a born-digital PDF with A01, one fact, one figure, one mapping row, one tie). Each stub is one small function named `stub...` and is listed in `e2e/skeleton/stubs.md` with the card that replaces it.
- `e2e/skeleton/k01.spec.ts`: the journey through the harness (JH0), on Postgres 16 in the cloud and the production build.
- When a later card replaces a stub, it removes the stub from the list and the skeleton still passes.

## Acceptance checks
1. END-2: the one figure on the skeleton's return traces back to its box on the K01 document.
2. The simulator's lock export holds every imported cell: the trace classes none of them "dropped" (RT-14; the receipt export is gone, amber A30).
3. The trace classes the imported cell as traced and flags a hand-typed cell as an orphan.
4. The skeleton runs in every train run and takes under two minutes.
5. `e2e/skeleton/stubs.md` lists every stub, and no stub is imported by anything outside `src/modules/skeleton/`.

## Not in this card
Real extraction, books or checks. Any screen.
