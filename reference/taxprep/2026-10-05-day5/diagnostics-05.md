# Diagnostics, Eglinton Holdings Inc. (Test), 05, end of run 5C (resume): 31 total (15 General, 16 Filing, 0 Custom, 0 Reviewed, 31 Not reviewed, 0 Hidden)
PARTIAL: rows seen on screen; the last 3 or 4 rows of the list were not read (the pane scrolls only by dragging its scrollbar). Format as in 2026-10-03-day3/diagnostics-probe.md: severity icon, type, jurisdiction, form, code, text.

| Type | Jur | Form | Code | Text (start) |
|---|---|---|---|---|
| EFILE | N/A | N/A | N1 | Certain errors detected by the federal bar codes diagnostics have not been corrected. Verify the 'Mandatory modification' federal diagnostics. |
| General (warning, amber triangle) | N/A | N/A | O103 | Overridden data - You can view the list of overridden data by consulting the cells with overridden data under the Review tab. (appeared after typing S23 400 or S3 values; 30 -> 31) |
| EFILE | FED | ID | R2000100, R2000032, N18, R2000017, R2000028, R2000299, R2000002, R2000300 | ID: corporation type (040), certification lines 950 to 957, first year of filing (070), contact name and phone (958, 959), NAICS (284/285), BN (001), province (750) |
| General | FED | ID | M5, M42, M318 | incorporation date; breakdown of principal products; EFILE number on S200 line 920 |
| General | FED | T183 | M417 | T183 signature indication |
| EFILE | FED | S100 | R1000001 | Balance sheet information is missing |
| General | FED | S100 | G107, G109, G110, G111 | Schedule 100 items 2599, 3499, 3620, 3849 required by the CRA |
| General | FED | S3849 | G104 | The amount of dividends paid entered on line 500 of Schedule 3 does not correspond to amount reported in this section of the GIFI. (fires on the 510 = 30,000 capital dividend, which makes line 500 = 30,000) |
| General | FED | S125 | G122, G123 | Items 8299 and 9368 required |
| EFILE | FED | S140 | R1400002 | no entry at GIFI line code 9999 |
| EFILE | FED | S141 | R1410102 | the corporation has not answered YES or NO at line 111 |
| EFILE | FED | S3 | R0030006 (twice) | reporting a non-taxable dividend under section 83 in column 003230 but on the same row no corresponding entry in columns 003200 and/or 003... (rows 1 and 2, connected payer, BN empty) |
| EFILE | FED | S3 | R0030007 (twice) | reporting taxable dividends deductible from taxable income in column 003240 and the answer in column 003205 is Yes (1), but on a same row there is n... (rows 1 and 2) |

Planted faults: NO diagnostic about eligible dividends above GRIP, NO diagnostic about a capital dividend with no election (no election cell on S3), NO diagnostic about the S23 allocation. The only dividend-paid diagnostic is G104 (GIFI cross-check).
