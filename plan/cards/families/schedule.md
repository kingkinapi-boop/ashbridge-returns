# Family: mapping and simulator cells ({schedule})

Cards M10 to M23. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 04 (RT-4, RT-7, RT-13, RT-21, RT-22, RT-24, RT-25), 03 (TB-6), `plan/cards/M00.md` and `data/taxprep/map/_format.md` (M00: the mapping format this card writes), `src/modules/mapping/core/` (M00), `src/contracts/taxprep.ts` (F03: grammar, natural-key registry, ignored-on-import list), `plan/cards/S02.md` (release files), `reference/taxprep/FINDINGS.md` (section 1, the cell map) and the trial's structure exports under `reference/taxprep/*/exports/`.

## Goal
For "{schedule}", every line the system fills, and every tax choice the preparer makes in Taxprep, has a mapping row in M00's format: Taxprep's own internal identifier where a trial export has listed it, so the round trip works end to end now and only unconfirmed rows remain for the trial or go-live to settle.

## Build
- `data/taxprep/map/{schedule}.json`: rows in M00's format (`_format.md`), one per figure key and row key:
  - `figureKey`: a GIFI code (`gifi:<code>`) or a schedule line (`<schedule>:line-<n>`), plus `rowKey` for repeating rows (the natural key, for example the CCA class).
  - `identifier`: Taxprep's internal identifier in F03's grammar, taken from a committed trial export or from FINDINGS.md (for example `GFGBA.Ttwgba64`, `FDONE.Ttwone5`, `CCACat.FD08C[1].FED.Ttw08cA9`); for a repeating group, written with copy `[1]` as the template and the group's natural-key cell in F03's registry (RT-7). Never CCH's help-page `FORM[n].CELL` form, never typed from memory.
  - `source`: `gifi` (from B01's GIFI totals), `fact` (a verified fact, RT-4), `taxChoice` (TB-6: never imported; the preparer types it in Taxprep and cites it; for example CCA claimed `CCACat.FD08C[n].FED.Ttw08cA22`, dividend designations, the business limit share, loss and donation claims) or `never` (a cell on F03's ignored-on-import list, RT-13).
  - For people: the form's jump code, the line or GIFI code, Taxprep's description (copied from the export); `release`; `confirmed` (true only when a committed trial export lists the identifier); `sourceNote` (the export file or FINDINGS section it came from).
- GIFI schedules (M11 Schedule 100, M12 Schedule 125): start from M00's generated `data/taxprep/map/gifi.json`; never retype a GIFI row. The card adds only what the generator does not cover (the balance-sheet families `GFGBB`, `GFGBD`, `GFGBF`, `GFGBG`, `GFGBH`, `GFGBI`, `GFGBJ` from `bs-forms-structure.csv` once the trial release lists them) and checks every GIFI code the test world uses has a row.
- Tax-choice schedules (M14 to M21, wherever the preparer chooses an amount): every choice cell is a `taxChoice` row and is added to `data/taxprep/tax-choices/<release>.json` with its choice kind (M00's `taxChoiceCells`), so the trace (T04) asks for a cite even when Taxprep computed the value.
- `data/taxprep/placeholder/{schedule}.json`: only the cells this schedule needs that no trial export has listed yet (FINDINGS section 1, "Not mapped yet": the T2 jacket, Schedules 3, 4, 23 and 50, Ontario forms). Same row shape as S02's release files (identifier, description, kind, input or calculated, natural-key cell for groups), identifiers in F03's grammar under a `SIM` first part (for example `SIM.S50.L500`) so they can never be mistaken for a real cell, each `confirmed: false`. The simulator release (S02) loads them; mapping rows that point at them name the simulator release, never the trial release. When a trial export lists the real cell, the row moves to the real identifier and the placeholder is deleted.
- Line numbers and GIFI codes come from CRA's published forms and RC4088 (cite them in the file header); never invented.
- A test in `src/modules/mapping/schedules/{schedule}.test.ts`.

## Acceptance checks
1. RT-21: every figure key the test world produces for this schedule has exactly one mapping row per release.
2. RT-4, RT-7, RT-13: M00's `loadMapping` loads the file with no refusal (grammar, input list, ignored-on-import list, duplicate key or identifier, repeating group with no natural key, CRA-calculated GIFI total).
3. RT-21: every row marked `confirmed: true` has its identifier and description in a committed trial export under `reference/taxprep/` (the test reads the exports); every other row is `confirmed: false` and the test output names it "unconfirmed".
4. TB-6: every `taxChoice` row is in `data/taxprep/tax-choices/<release>.json`, and no tax-choice cell is also a `gifi` or `fact` row.
5. RT-21: no identifier has CCH's help-page `FORM[n].CELL` shape, and every `SIM` placeholder is `confirmed: false` and absent from the trial release file.
6. Every line number or GIFI code is in the cited CRA source.

## Not in this card
The mapping format, its loader and the GIFI generator (M00). Confirming identifiers the trial has not listed (the trial, then S03; at go-live LIVE-2). Building figures or writing the import file (T01).
