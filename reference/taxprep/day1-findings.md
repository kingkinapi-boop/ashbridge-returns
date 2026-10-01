# Taxprep trial day 1: findings and proposed changes

Written 1 Oct 2026 by the Opus trial helper from `2026-10-01-day1/notes.md`, `FEATURES.md` and `2026-10-01-day1/exports/all-input-cells-return1-structure.csv`. Release: CCH iFirm 2026.20.198267, product "T2 Corporate 2024 and later" (one product covers 2025 and 2026 year ends). Trial ends about 16 Oct 2026; 100 PDFs left. Every change below is a proposal for the Lead (amber unless marked), to be confirmed by day 2's import probe before any card is spec'd against it.

## What day 1 proved
1. **Export format** (return 1, all defaults): Windows-1252 single byte (é is byte E9), no BOM, CRLF on every line including the last, comma separator, every value double-quoted including empty ones.
2. **Header**: `[<return name>|0|0|<return GUID>],"Current Year","Last Year",""`. Four fields, not the help's three `[name|return|language]`; the export header carries no language code and adds the document GUID.
3. **Rows**: four columns, identifier unquoted, then `"current"`, `"last"`, `"description"`. Dates YYYY-MM-DD; yes or no cells hold `Y` or `N`.
4. **Empty cells are listed**, so an export of a filter is the complete cell list for it (225 rows for ID plus S125). Cells added twice to a filter come out once.
5. **Cell identifiers are not box numbers**: `<FORM>.<field>` or `<FORM>[<copy>].<SUBFORM>.<field>`, for example `IDENT.Ident120` (line 060), `GFBGII[1].GFGII.Ttwgii4`. Forms in the identifier (IDENT, GFBGII, ABATA, LETC, FDFTC, IFirm) differ from the jump codes users see (ID, S125). A filter on one form also exports cells of other forms it feeds.
6. **GIFI line amounts are missing** from "Select all input cells" on S125 (only 23 header and total cells). How they are identified is the open question for day 1b.
7. Export options: column break {Tab, Comma, Semi-colon, Space}; negatives {-123, (123)}; decimal {Period, Comma}; thousands {none, comma, space}. Defaults: comma, -123, period, none. Export is asynchronous (notification, then Download); file name `<client code>-T2-<year>-<client name>-<yyyymmdd>-<hh>-<mm>-<ss>-<ms>.csv`.
8. Diagnostics carry stable ids (R2000100, R1400002, E909, G123, N1), 24 on an empty return.
9. Add return takes client name, year start and end (YYYY-MM-DD), optional BN; it also creates an iFirm contact; client codes autogenerate 1, 2, 3. Year dates typed there stick (ID 060, 061).
10. Built-in filters "Imported", "Overridden", "Edited after CRA/RQ import" and "Rolled forward" exist: Taxprep's own provenance, useful for RT-14.

## What it changes in the build (proposals)
- **RT-3, header and syntax (amber, clause edit).** Replace "a header `[taxpayer name|return id|language]`" with "the header the export writes, `[name|0|0|GUID]` plus the three column titles; rows of identifier and quoted values, as the trial's export shows". Day 2 step 27 settles whether the import accepts the help's 3-field header and checks the name and GUID. Card F03: its golden file built on CCH's example `T4SLIP[1].TOATSC4` with `57,565.00` must move to the export format; a thousands comma inside a comma-separated row is now a refusal case, not a valid row. Card S00 (simulator): emit the 4-field header and the description column.
- **RT-9, export settings (amber, clause edit).** Name the fixed settings: comma, -123, period, no thousands separator (the defaults), Windows-1252, CRLF, all values quoted, no BOM. The parser refuses a BOM, LF-only lines, a different separator, unquoted values or `(123)`. Day 2 step 26 supplies one real file per refused option for F03's fault set.
- **Encoding (amber, new line under RT-9 or ARC-14).** The writer and parser use Windows-1252, not UTF-8; a character outside Windows-1252 in a value is refused with the row, never silently replaced. Day 2 step 24 confirms what the import expects.
- **RT-21, cell id shape (amber, clause edit).** The mapping table keys are Taxprep internal identifiers (`IDENT.Ident120`), stored with the jump code, line or GIFI box and description for people. The copy index belongs to the identifier (`FORM[n].SUB.field`), and RT-7 natural keys map to it at write time. Card M00 and the schedule family: the identifier grammar must allow nested parts and a copy index on the first part. `taxprep-cells.json` guesses (`S100.{code}`, `S8[{n}].CLASS`) are all wrong in shape and stay unconfirmed until day 1b.
- **RT-22 (green, no change).** The release list is cheap: an export of the map filters lists every cell, empty or not, so the release-to-release comparison is a file diff.
- **RT-2, RT-1 (open).** The `IFirm.*` cells (for example `IFirm.AutoSync`) are iFirm-side and are good candidates for the import tag; day 2 step 23 tests them. The export header's GUID gives RT-1 a second identity check besides BN and year end (proposal: refuse an export whose GUID differs from the one recorded at first import).
- **RT-14 (amber, card note).** Use Taxprep's "Imported" and "Overridden" filter exports as a cross-check of our own classes, never as the only source.
- **RT-17 (card note).** Diagnostic ids are stable codes; the diagnostics list and the build's checks can key on them.
- **Return creation (card note for ops screens).** Creating a return also creates an iFirm contact with "Automatically synchronize contact information" on by default; the import has an "Exclude the values associated with the synchronized contact information" box. Record its default on day 1b and keep it fixed.
- **Sample clients (worker job after day 1b).** Regenerate every `import.csv` in the export format with confirmed identifiers; drop `S1.NETINCOME` if day 2 step 25 shows Taxprep fills it from the GIFI.

## Still open after day 1
GIFI line identifiers (day 1b part B); the full form list and cell map (part A); the import syntax the trial accepts; the six day 2 questions; whether filters are shared across returns (help says yes, not yet checked).
