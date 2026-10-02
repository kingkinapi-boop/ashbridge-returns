# Findings A07 round 1

Recorded by the Lead from the Opus findings reviewer's returned text (2 Oct 2026). Inputs: reports/A07-check.md and A07-build.md (claude/A07), plan/cards/A07.md, .claude/rules/testing.md, reports/findings-F01-r2.md; claude/A07 src/modules/sheets/{index,xlsx/index,csv/index}.ts, src/contracts/sheets.ts, the fixture script; claude/A01 textlayer/index.ts and main's contracts for comparison. One probe run: `normaliseAmount` on cell-style text. No code changed.

Headline: the check's 3 findings come from 3 causes, and the same causes produce 3 more faults the check missed: number cells carry float noise the amount grammar refuses; zod `.trim()` rewrites stored sheet names; the cache hands every caller the same object.

## Root causes
**RC1. Cell text is copied from what the library displays, not built from the typed value.** xlsx/index.ts:71 uses `cell.text` for a formula's cached value: 0 and FALSE become "", an error becomes "[object Object]" (check finding 1). Also: xlsx/index.ts:55 uses `cell.text` for number cells, so floats come out as JS `toString`; on main `normaliseAmount("1234.5600000000001")` and `normaliseAmount("0.30000000000000004")` return ok:false, so `cellValueMatches` on a SUM total says "value differs" for a correct citation; very large numbers come out as "1e+21". The schema has no `error` type and no cached type: a non-formula `#N/A` reads as text, and a formula with no stored cached value cannot be told from a cached "". Where else: A01 (uses `item.str`, fine) and A02 Tesseract should state their text rule the same way; B04 should read QBO CSVs through A07's `readCsv`. F09B's grammar must not be loosened (it would turn "1.2E3" into an amount and break A07 check 3).

**RC2. Structure is reported only through the child records that carry it.** Hidden rows and columns are known only from their cells (xlsx/index.ts:100-104), so an empty hidden row or column leaves no trace (check finding 2). Where else: blank pages in A01, A02, A03 reading results; fixtures planted only hidden rows and columns with content (make-fixtures.mjs:216-217).

**RC3. The cache is keyed and shared incompletely.** The key is fingerprint plus a CSV-name flag, but the refusal text names the file (index.ts:46,56; check finding 3). The cache returns the same object to every caller, while A01 returns `structuredClone`. Where else: A02 (fingerprint plus page), A03 recorded results, B04 snapshots (key includes the snapshot date), every later ARC-11 cache.

**RC4 (process; F01's blank-definition cause).** sheets.ts uses `z.string().trim().min(1)` for the sheet name, the pointer's sheet and engine fields; `.trim()` rewrites the value, so "TB " becomes "TB" (breaks EV-14 "exactly as stored"; "TB" and "TB " collapse). Same pattern on main: reading.ts:47-48, ai.ts:9, checks.ts:21.

## Card decisions (amber)
- CellSchema gains type `error` and, on formula cells, `cached: { type: number|text|boolean|date|error|none, text }`; a formula with no stored value has type `none` and never matches.
- SheetSchema gains `hiddenRows: number[]` and `hiddenColumns: number[]` (1-based, sorted, including empty ones).
- Number text rule: shortest round-trip text, except a value within 1e-9 of a whole cent is written as that cent amount. F09B's grammar unchanged.
- File names never appear in reasons; the cache key is fingerprint plus route (zip, compound, csv, unsupported).
- Sheet and pointer names kept exactly as stored; non-blank via F01C's `NonBlankSchema` once it lands, until then a refine without a transform.

## Consolidated fix list
Spec (a new worker who has not touched A07; each test fails on the head for the stated reason):
- S1 Fixtures: formula cells with cached 0, FALSE, TRUE, "" text, #DIV/0! and no `<v>`; number cells 1234.5600000000001, 0.30000000000000004, 1E+21; a non-formula `#N/A`; an empty hidden row `<row r="9" hidden="1"/>`; an empty hidden column past the data; a sheet named "TB " beside "TB".
- S2 EV-6: `cellValueMatches(ptr,"0")` on the zero total is ok; "1" gives "formula cell: cached value differs"; "false" matches FALSE; "1234.56" matches the float-noise cells; the error cell holds "#DIV/0!" with type error; the no-cache formula is refused with its own reason.
- S3 EV-14: `hiddenRows` and `hiddenColumns` list the empty ones; hidden-with-content still marked on cells.
- S4 Cache: same bytes as a.pdf then b.doc give a reason naming neither file; same bytes as .csv then .pdf give different outcomes; changing a returned result leaves the next read intact.
- S5 Names: "TB " and "TB" are two sheets; a pointer to "TB " finds "TB "; a blank or whitespace sheet name is refused.
- S6 Property (fixed seed): any finite double in a number cell reads back to text that `Number()` maps to the same double, or to the nearest cent within 1e-9.

Build: B1 xlsx one `typedText(value)` for number, boolean, date, string, `{error}`, rich text, hyperlink, for plain and cached values; never `cell.text`. B2 per-sheet hidden lists from the row and column models. B3 cache key `fingerprint:route`, no file name in reasons, return `structuredClone`. B4 schemas: drop `.trim()` transforms; add error and cached-type fields and hidden lists. B5 mutation 100 on all four files.

## Rule tests for SC
- No module turns a library value into text through `.text`, `String(x)` or `${x}` without a typed switch; planted `cell.text` fails.
- Every ARC-11 cache key covers every input its result depends on, and the cache returns a copy; run on each reader adapter (A01, A02, A03, A07, B04).
- Every reader with "hidden" or "never dropped" in its contract is tested with an empty instance (empty hidden row or column, blank page).
- No `z.string().trim()` transform in src/contracts; non-blank goes through text.ts (joins R41).

## Risks and re-tests
- Rounding to cents could hide a real sub-cent difference: keep the 1e-9 bound; re-run S6 and acceptance check 5.
- New schema fields break the expected-cells JSON (tb-1900, tb-1904): regenerate with the committed script in the spec job, never by hand.
- Removing `.trim()`: only sheets.ts here; reading.ts stays with F01C and BL0.
- Route-keyed cache: re-run index.test.ts and acceptance check 7.
- E01 and E14 depend on A07's cell text; S6 freezes the number text rule.
- Two rounds at most: if round 2 fails only on S6, land the rest and move the float rule to a follow-up card; any other failure parks A07.
