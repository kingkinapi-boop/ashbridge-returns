# Phase 2 fixes (the "For the Lead" items 1 to 5 of reports/cards-phase2.md)

1 Oct 2026. Helper for the Lead. Branch `claude/phase2-fixes` from origin/main. `node tools/matrix.mjs --plan`: PLAN OK (`plan/MATRIX.md` generated, not committed).

## What changed

| File | Change |
|---|---|
| `plan/cards/F03.md` | Build: the parser reads a negative exported with one leading apostrophe (`"'-1356"`, day 3, `FDONE.Ttwone66` with the default "-123" setting) as that negative and marks the row; the writer never writes an apostrophe; an apostrophe anywhere else is refused. New acceptance check 12 (golden write-back as `"-1356"`, three refused shapes, a property that the writer never emits an apostrophe). |
| `plan/cards/F07.md` | Build: F07 mints `client_ref` (onboarding contract U6) once per corporation, `ASH-0001` upward, never reused or changed, never built from client data, kept in a table in `05_bridge.sql`; T01 uses it in file names (RT-5). Clause RT-5 added; Read list adds blueprint 04 and T01. New acceptance check 9 (stable across runs, shared by a corporation's returns, none for skipped corporations, uniqueness both ways, property test). |
| `plan/slices.json` | F07: clause RT-5 added (matches the card). J3-K01 to J3-K13: T12 added to deps. T01 already had F07 (no change). No other entry touched. |
| `plan/cards/families/schedule.md` | Rewritten to M00's format: Taxprep's internal identifiers from the trial exports, the four sources (`gifi`, `fact`, `taxChoice`, `never`), `confirmed` flags and `sourceNote`; M11 and M12 start from M00's generated `gifi.json`; tax-choice cells go to `data/taxprep/tax-choices/<release>.json`; the placeholder file holds only cells no trial export has listed, under a `SIM` first part. Checks now use M00's `loadMapping` and the committed exports. |
| `reference/taxprep/FINDINGS.md` | Day 3 folded in, still "interim": status line and sources; the S8 cell map (A1 to A23, QUE and ALB, totals); the `'-1356` apostrophe in section 2; Q22 extended to S8 and "no flag column"; the full built-in filter list and the "Overridden" result; new section 3b (CCA tax choice as override, editing S8, stale review grid, diagnostics severities and `<code>_<cell id>` keys, audit trail with imports as a file name only, roll-forward dialog, print formats, return menu); section 5 notes for T02, T05 and F03 revised; section 6 splits day 3 into answered and still open. |

## Ambers proposed (what; why; reverse)

1. F03 reads one leading apostrophe only before a negative amount and refuses it elsewhere; the writer never writes one. Why: day 3 export shape; the import side with an apostrophe is untried, so writing it would be a guess. Reverse: change the export setting instead and refuse the apostrophe.
2. `client_ref` is `ASH-` and four digits in order of minting, one per corporation, kept by F07 in `05_bridge.sql`; F07 now cites RT-5. Why: U6 says this system mints it; a sequence carries no client data into Taxprep file names; T01's example already used `ASH-0001`. Reverse: another pattern, or a small bridge card owning it.
3. Schedule family placeholders use a `SIM` first part (for example `SIM.S50.L500`), `confirmed: false`, live only in the simulator release, and are deleted when a trial export lists the real cell. Why: they must pass F03's grammar yet never be mistaken for a real Taxprep cell. Reverse: placeholder rows marked only by `confirmed: false`.
4. Schedule cards write tax-choice cells both as `taxChoice` rows in their own map file and into `data/taxprep/tax-choices/<release>.json`. Why: M00 reads choices from that file (`taxChoiceCells`) and its `loadMapping` checks the rows. Reverse: M00 derives the list from `taxChoice` rows and the separate file goes.
5. FINDINGS section 5's T02 note drops "use the Imported and Overridden filters as a cross-check" and points at the red item instead. Why: that cross-check needs a second export, which is red 1 in `reports/cards-phase2.md`. Reverse: restore it if Zo says yes to red 1.

## For the Lead (not done: outside the entries I may edit)

- M10 to M23 in `plan/slices.json`: the family now writes `data/taxprep/tax-choices/<release>.json` (M14 to M21) and its checks cite RT-4, RT-13 and TB-6. Add that path (shared with M00, so those cards run one after another) and those clauses to the entries, or drop check 4 of the family.
- Blueprint-level: none made. Red 1 of `reports/cards-phase2.md` (a second export at lock using the "Overridden" filter) still stands as listed there.
