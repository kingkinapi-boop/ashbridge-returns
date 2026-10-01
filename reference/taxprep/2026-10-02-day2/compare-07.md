# Riverdale round trip compare (steps 16 to 19), 1 Oct 2026, release 2026.20.198267
Import: sample-clients/07-riverdale-rentals/taxprep/import.csv (13 rows: 3 S1599, 1 S8299, 9 S9367), Windows-1252, header GUID zeros. Export: default filter "Entered this year or last year", defaults (CSV, comma, period, -123, no thousand separator).
- Rows imported 13, found in export 13, same value 13, missing 0, different 0, format differences 0 (whole dollars, no decimals).
- Export holds 7 extra cells not in the import: IDENT.Ident120 (2025-01-01), Ident121 (2025-12-31), Ident311 (name), Ident230 ("1", description "Line 990 ... |`English|`Fran" with byte E7 in Francais), Ident451 (client code "1"), Ident492 ("N"), IFirm.ContactPartner (""). All are return-creation or contact cells, not GIFI. Dates export as YYYY-MM-DD, Y/N as N.
- Description (4th column) is filled by Taxprep on export ("GIFI code NNNN - Amount - name"); our import left it empty.
- Header on export carries the real return GUID, not the zeros we sent.
- Step 19: a second export with nothing changed is byte-identical to the first (1622 bytes both, cmp equal, header and order included): no timestamp in the file body. RT-20 may compare files byte for byte for the same filter and settings.
- Net income after import 6,737, taxable income 6,737, Part I tax 1,010 (calculated; not in the export because the filter lists input cells only).
- The report lists only cells that already held a value (S1599 1002, S8299 8141: "replaced by a new imported value"); 11 new cells imported with no report row and no counts. A silent import cannot be told from a dropped row by the report: only an export compare proves it (RT-20).
- Not run: filters "map 1 core" (does not exist yet) and "Imported" (see notes).
