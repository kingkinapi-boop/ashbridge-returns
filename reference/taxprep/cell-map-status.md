# Taxprep cell map status (1 to 2 Oct 2026 trial)

Source of truth: `reference/sample-clients/lib/taxprep-cells.json`. Regenerated imports: `reference/sample-clients/*/taxprep/import.csv`.

## Mapped and confirmed (seen in a real export)
- GIFI amount cells, 300 codes, from `2026-10-02-day2/exports/gifi-dict-structure.csv` (906 cells: Account, Amount, Prior year per code):
  - S8299 revenue: `GFBGII[1].GFGIJ.Ttwgij<N>` (8141 = 104)
  - S8518 cost of sales: `GFBGII[1].GFGIK.Ttwgik<N>`
  - S9367 operating expenses: `GFBGII[1].GFGIL.Ttwgil<N>`
  - S1599 current assets: `GFGBA.Ttwgba<N>` (no [1]; 1002 = 64)
- File format: header `[name|0|0|GUID],"Current Year","Last Year",""`, rows `id,"value","",""`, Windows-1252, CRLF, all quoted, whole dollars only, empty string clears a cell.
- Import behaviour: header not validated (wrong name or GUID applied silently); UTF-8 garbles silently; calculated cells and contact-synchronised IDENT cells are skipped silently.

## Not mapped (confirmed: false, kept out of the imports)
- Balance-sheet forms other than S1599: capital assets S2008/S2009, S2178/S2179, long-term assets, liabilities and equity (S3849 and neighbours). Sample-client codes left out: 1600, 1680, 1681, 1740 to 1743, 1774, 1775, 2242, 2308, 2620 to 2628, 2680, 2707, 2770, 2781, 3140, 3141, 3500, 3600, 3700, and the suspense account (no GIFI yet) in clients 09 and 10. Run `make-csv.mjs --list` for each client.
- Schedule 1 add-backs and deductions, Schedule 8 (CCA by class; copy numbers after a delete untested), Schedule 50 shareholders: no export has listed them.
- S1 net income per books: calculated by Taxprep, never imported (not a gap).
- Prior-year cells are mapped but never written (Last Year column left empty).

## Rounding rule
Each GIFI code is rounded to whole dollars, half away from zero. The Schedule 100 difference (1 dollar for clients 03, 05, 06, 08, 09) goes on GIFI 3600, or the largest liability or equity line if there is no 3600. `make-csv.mjs --check` verifies the whole-dollar Schedule 100 balances and net income stays within 20 dollars of the key. Equity lines are not mapped yet, so the plug does not reach the import file; it will once S3849 and neighbours are exported.

## The walker must still export
1. A filter on S2008, S2009, S2178, S2179 and every liability and equity form (S3849 and the rest of the S100 family), Select all input cells: gives the missing balance-sheet ids.
2. A filter on S1, S8 (add two classes, delete one, export again for copy numbers) and S50: gives their ids.
3. Day 2 steps still open: Q21, Q22, step 26 (format refusals), the Riverdale round trip with the regenerated `import.csv`, the IFirm tag read-back.
Then add the ids to `taxprep-cells.json` with `confirmed: true`, extend the writer for Schedules 1, 8 and 50, and regenerate.
