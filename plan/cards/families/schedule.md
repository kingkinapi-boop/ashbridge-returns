# Family: mapping and simulator cells ({schedule})

Cards M10 to M23. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 04 (RT-7, RT-21), `src/modules/mapping/core/` (M00) and `src/contracts/taxprep.ts` (F03).

## Goal
For "{schedule}", every input line the system fills has a placeholder Taxprep cell identifier in the simulator and a mapping row from our figure key, so the round trip works end to end now and the real identifiers can be dropped in at go-live.

## Build
- `data/taxprep/placeholder/{schedule}.json`: the input cells of this schedule in the simulator (placeholder identifiers in CCH's `FORM[n].CELL` form), marked input or calculated, with the natural key for repeating rows.
- `data/taxprep/map/{schedule}.json`: figure key (GIFI code, or schedule and line) to cell identifier, for release "placeholder".
- Line numbers and GIFI codes come from CRA's published forms and RC4088 (cite them in the file header); never invented.
- A test in `src/modules/mapping/schedules/{schedule}.test.ts`.

## Acceptance checks
1. Every figure key the test world produces for this schedule has exactly one mapping row.
2. No mapping row points at a calculated cell (RT-4).
3. Repeating rows declare a natural key (RT-7).
4. Every line number or GIFI code is in the cited CRA source.

## Not in this card
The real Taxprep identifiers (go-live, LIVE-2).
