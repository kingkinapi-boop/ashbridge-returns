# A07 spec round 2

Worker cloud-0b4981, 2 Oct 2026. Findings S1 to S6 (reports/findings-A07-r1.md; card decisions A360). Validated on main fe5adfe (merged into claude/A07; code unchanged since f10891f).

## Tests written
- `src/modules/sheets/round2.acceptance.test.ts`: 26 tests (EV-14, EV-6, EV-5). S1 and S2 typed cached values (0, TRUE, FALSE, #DIV/0!, none), float noise, 1E+21, error cells, the no-cache reason, the schema's `cached` and `error`; S3 `hiddenRows` and `hiddenColumns` (empty hidden row 9, empty hidden columns 8 and 9, CSV lists empty); S4 no file name in reasons, route-keyed cache, a copy per read (result and refusal); S5 "TB" beside "TB ", pointer to "TB ", names kept by the schemas, blank refused; S6 fixed examples and a fast-check property (seed 20261002, 100 runs) on the number text rule.
- Fixtures by the committed script (`__fixtures__/make-fixtures.mjs`): new `xlsx/cells-r2.xlsx` and `.expected.json`; `tb-1900` and `tb-1904` expected JSON regenerated (formula `cached`, new `hiddenLists` key). The .xlsx bytes of tb-1900 and tb-1904 are unchanged. `harness.ts` gains `numbersXlsx` (one-sheet workbook from stored number texts, for S6).
- On the build head (21e5315 plus main): 23 of 26 new tests fail for the stated reasons, and the round-1 test "tb-1900.xlsx returns every expected cell" fails on the missing `cached`. Three new tests pass already as guards (pdf/csv route order, hidden-with-content marks, 0.125 not rounded).

## 6b sweep (stub passing every acceptance test; full unit and db suites)
Rewritten, each because a round-2 card decision (A360) supersedes it; assertions kept where they still hold:
- `src/modules/sheets/contract.test.ts:18` fixture `result()`: a typed object with `hiddenRows`/`hiddenColumns` and `cached` on the formula cell instead of `SheetResultSchema.parse` (new sheet fields). Affects the three EV-6 tests at lines 69, 75, 81 ("the amount grammar compares cents...", "text is trimmed and case-folded...", "a missing cell, a blank cell and a formula cell give their own reasons"); their assertions are unchanged.
- `src/modules/sheets/index.test.ts:23` "any other name is refused by name": now "any other name is refused" (ok false); A360 "reasons never name the file"; the reason text is pinned by the acceptance tests.
- `src/modules/sheets/index.test.ts:45` "a refusal is remembered too": `toBe(first)` to `toEqual(first)`; A360 "returning a copy".
- `src/modules/sheets/xlsx.test.ts:48` "rich text, a hyperlink and an error value are text...": the `#N/A` cell no longer asserts type `text`; A360 type `error` (pinned by the acceptance tests).
Nothing retired. Stub: suite fully green (1535 unit, 2 db); stub worktree removed.

## Amber (spec choices)
1. A formula's cached empty string reads as `none`: ExcelJS 4.4.0 cannot tell `<v></v>` from no `<v>` (both leave `result` undefined); both never match. Reverse: parse the sheet XML for the `t="str"` case and expect `text`.
2. The no-cache reason is `formula cell: no cached value`.
3. Cent amount text: `String(cent)` (no trailing zeros, "0.3", "10"), every digit at 1e21 and above (BigInt), never exponent form; `-0` reads "0". The property accepts either text in a band from 0.9e-9 to 1.1e-9 so float noise in the bound never decides.
4. The schema refuses a formula cell without `cached` and a `cached.type` outside the list; hidden list entries are integers of at least 1.
5. Hidden lists go in the expected JSON under a new `hiddenLists` key, not on `sheets`, so the round-1 test comparing `{ name, hidden }` stays valid.

## Permission gaps
None. The main checkout had an uncommitted `plan/ledger.jsonl`, so the work ran in the worktree /home/user/wt-A07 (no stash, ledger untouched).

## Model: opus
Opus 5.5.
