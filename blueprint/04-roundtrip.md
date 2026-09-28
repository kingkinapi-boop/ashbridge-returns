# 04 Taxprep round trip

## Four exports prove what Taxprep holds

| Export | When | Proves |
|---|---|---|
| 0 Baseline | after roll-forward or conversion, before any import | what Taxprep held before us (rolled-forward values) |
| 1 Receipt | right after each import, with Taxprep's import report | every imported cell arrived with its value |
| 2 Lock | after the preparer locks, with the review-lines export and the printed return | the preparer's final values |
| 3 Transmit | before the T183CORP goes out, and again just before transmit | nothing changed since approval |

## Import and export

- **RT-1** Every export must carry the latest import's token and match the return's business number and year end. Otherwise it is refused, with the reason.
- **RT-2** The token sits in a cell that is never sent to CRA. Which cell is settled in the real Taxprep proof (LIVE-1); the simulator uses a placeholder cell.
- **RT-3** The import file follows CCH's CSV syntax: a header `[taxpayer name|return id|language]`; rows of cell identifier, this year's value, prior year's value; dates as YYYY-MM-DD; copies of repeating forms as `FORM[n].CELL`. Source: CCH iFirm "CSV syntax".
- **RT-4** The import writes input cells only, never calculated cells, and only facts a preparer has verified. Unverified facts wait.
- **RT-5** The import file's name carries the client number, the year end and the version. Each import file is saved as a version; the first is the AI draft.
- **RT-6** Receipt check: every cell in the import file appears in export 1 with the same value, and the import report shows no errors. Any failure blocks work on the return.
- **RT-7** Rows of repeating forms are matched by a natural key (CCA class, shareholder, slip issuer and so on), never by copy number. The mapping table names the natural key of each repeating form.
- **RT-8** Re-imports send only changed cells. A value to be removed is cleared by hand in Taxprep, and the next export must show it gone.
- **RT-9** Export settings are fixed (column separator, negative numbers, decimal and thousands separators). The parser refuses any other format, and any file that looks re-saved by a spreadsheet program.
- **RT-10** A second saved filter exports the calculated review lines (taxable income, each tax, balances, and every line the brief and review screens show). It is uploaded with every export 2 and export 3.
- **RT-11** The printed return PDF uploaded with export 2 is the record of the full return and goes in the binder.
- **RT-12** Blank cells are not imported (CCH). The system never relies on a blank to clear a value.
- **RT-13** T2 year-start and year-end cells are ignored on import (CCH). They are set in Taxprep by hand and checked by export.

## Trace (after export 2)

- **RT-14** Each filled cell gets one class: traced (imported, unchanged); overridden (imported, then changed: needs a reason); rolled forward (in export 0: registered as a fact sourced to last year); orphan (never imported and not in export 0: needs a source); calculated (from the review-lines export).
- **RT-15** Only cells on the allowed-typing list (Taxprep settings and e-file options) may be typed in Taxprep without a source.
- **RT-16** The preparer sources each orphan: a document box, an answer, or a written reason. The system may list documents that contain the exact value, but never pre-selects one.
- **RT-17** Diagnostics are read from the printed return. Any not cleared blocks sign-off, except those on the allowed list (which ones: a research item).
- **RT-18** Zero orphans and zero unexplained overrides, or no sign-off. Export 2 is saved as the preparer version.

## Gates and outside edits

- **RT-19** Gate 1: before the T183CORP goes out, a fresh export must match the approval fingerprint cell for cell. Gate 2: the same just before transmit. A mismatch blocks the step and sends the changed cells back to review.
- **RT-20** Any change after lock means unlock, fix, re-lock and a new export 2. An export that differs from the last recorded one with no recorded import in between is flagged "changed outside the trace".

## Mapping

- **RT-21** A mapping table links each figure key to a Taxprep cell identifier, for a named Taxprep release. It is the only Taxprep-specific part.
- **RT-22** For each Taxprep release, the full list of input-cell identifiers is exported from a reference return and compared with the last release. A removed or renamed identifier that the mapping uses blocks imports until it is remapped.
- **RT-23** In the build, a Taxprep simulator stands in for Taxprep. It follows CCH's published rules (RT-3, RT-12, RT-13) and can inject faults: partial import, wrong client, reordered copies, a stale export, spreadsheet-mangled numbers, an edit outside the trace.
