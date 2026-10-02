# S01 spec (cloud-3d81d3, 2 Oct 2026)

1. Spec commit b6a188e on claude/S01: 62 tests in `src/modules/taxprep-sim/faults/faults.acceptance.test.ts` (harness `faults/__fixtures__/harness.ts`, F03 contract only); checks 1 to 8 all covered, fast-check property on seeds (fixed seed 20261002), Math.random, Date.now and crypto spied to throw.
2. Clauses: RT-23, RT-1, RT-2, RT-7, RT-9 (all ten manglings, one test each), RT-14, RT-20.
3. Validated on main 422e04e: typecheck (16 errors) and lint (426) only in this spec's files, all from the missing `../index` (S00, not on main) and `./index` (S01); `npm test` unit 699 pass, only this file fails (Cannot find module); db 2 of 2.
4. Soundness on a throwaway scratch (main + origin/claude/S00 fe44851 + a reference faults/index.ts, never committed): 62 of 62 pass, tsc and eslint clean; 17 of 18 planted faults caught (the uncaught one, a separator mangling on the header line only, is still a refused separator mangling and allowed). Without faults/index.ts the file fails with "Cannot find module './index'".
5. S01 cannot typecheck on main until S00 lands (src/modules/taxprep-sim/index.ts).

## Amber
- API names and shapes are spec choices, written in the test header: `FAULT_CATALOGUE`, `CatalogueEntry` (non-empty `clauses` tuple of `RT-${number}`), `FaultRecord.changed` as header, cell or format changes, `MANGLINGS` named by F03's fault codes, and seven functions (`partialImport`, `wrongClientExport`, `wrongReturnImport`, `reorderedCopies`, `staleExport`, `mangleExport`, `editOutsideTrace`) under `faults/index.ts`.
- Reordered copies works on export bytes, not on the return: S00 has no delete-copy call, and S03 owns renumbering inside the simulator.
- The partial import's report must equal the report of the whole file on an identical return, including "replaced" and "emptied" lines for dropped rows on a return that already holds values (the fault hides itself, RT-26).
- Each catalogue entry cites the clause that catches it (partial RT-14, wrong client RT-1, reordered RT-7, stale RT-2, mangled RT-9, edit RT-20); more clauses allowed; every cited clause must exist in blueprint 04.
- Edit outside the trace needs a locked return (unlocked throws) and leaves it locked. The wrong-client business-number form plants a number when the export has none and changes it when it has one.
- No golden files: fault outputs depend on seeded choices the card leaves to the builder; the fixed outputs (byte-order mark, LF, UTF-8) are asserted byte for byte instead. "Lost leading zeros" is not in S01's list (the card's ten), so not tested.
