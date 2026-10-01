# 04 Taxprep round trip

## Two exports prove what Taxprep holds (decision 0008, F4)

| Export | When | Proves |
|---|---|---|
| Lock export | after the preparer locks, uploaded with the printed return | the preparer's final values, traced cell by cell |
| Check export | just before transmit | nothing changed since the CPA approved |

More exports are added only if the Taxprep trial shows a need. The token and the gate details are settled on the Taxprep trial.

## Import and export

- **RT-1** An export that does not carry the latest import's token or does not match the return's business number and year end is refused, with the reason (the token is settled on the Taxprep trial).
- **RT-2** The token sits in a cell that is never sent to CRA; which cell is settled on the Taxprep trial, and until then the simulator uses a placeholder cell.
- **RT-3** The import file follows CCH's CSV syntax: a header `[taxpayer name|return id|language]`; rows of cell identifier, this year's value, prior year's value; dates as YYYY-MM-DD; copies of repeating forms as `FORM[n].CELL`. Source: CCH iFirm "CSV syntax".
- **RT-4** The import writes input cells only, never calculated cells, and only facts a preparer has verified. Unverified facts wait.
- **RT-5** The import file's name carries the client number, the year end and the version. Each import file is saved as a version; the first is the AI draft.
- **RT-6** (removed in v1.1 alignment, amber A30)
- **RT-7** Rows of repeating forms are matched by a natural key (CCA class, shareholder, slip issuer and so on), never by copy number. The mapping table names the natural key of each repeating form.
- **RT-8** Re-imports send only changed cells. A value to be removed is cleared by hand in Taxprep, and the next export must show it gone.
- **RT-9** Export settings are fixed (column separator, negative numbers, decimal and thousands separators). The parser refuses any other format, and any file that looks re-saved by a spreadsheet program.
- **RT-10** The lock export and the check export also hold the calculated review lines (taxable income, each tax, balances, and every line the brief and review screens show); whether one saved filter can hold them or a second file is needed is settled on the Taxprep trial.
- **RT-11** The printed return PDF uploaded with the lock export is the record of the full return and goes in the binder.
- **RT-12** Blank cells are not imported (CCH). The system never relies on a blank to clear a value.
- **RT-13** T2 year-start and year-end cells are ignored on import (CCH). They are set in Taxprep by hand and checked by export.

## Trace (after the lock export)

- **RT-14** Each cell in the lock export gets one class: traced (imported, unchanged); overridden (imported, then changed: needs a reason); dropped (imported, but blank or missing: blocks sign-off until re-imported or explained); rolled forward (not imported, and equal to the value last year's return facts give it through the roll-forward map, RT-24: registered as a fact sourced to last year); orphan (filled, not imported, not rolled forward, not calculated: needs a source); calculated (a review line, RT-10).
- **RT-15** Only cells on the allowed-typing list (Taxprep settings and e-file options) may be typed in Taxprep without a source.
- **RT-16** The preparer sources each orphan, including every tax choice typed in Taxprep, with the cite button: a document box, a QBO line, an answer, or a written reason; the system may list sources that hold the exact value but never pre-selects one.
- **RT-17** Diagnostics are read from the printed return, and any not cleared blocks sign-off except those on the allowed list (which ones is settled on the Taxprep trial).
- **RT-18** The preparer cannot sign off while any orphan, unexplained override or dropped cell remains, and the lock export at sign-off is saved as the preparer version.

## The check before transmit, and outside edits

- **RT-19** Just before transmit, ops uploads a check export, which must match the approval fingerprint (FLOW-4) cell for cell; a mismatch blocks transmit and sends the changed cells back to review (the gate details are settled on the Taxprep trial).
- **RT-20** Any change after lock means unlock, fix, re-lock and a new lock export, and an export that differs from the last recorded one with no recorded import in between is flagged "changed outside the trace".

## Mapping

- **RT-21** A mapping table links each figure key to a Taxprep cell identifier, for a named Taxprep release. It is the only Taxprep-specific part.
- **RT-22** For each Taxprep release, the full list of input-cell identifiers is exported from a reference return and compared with the last release. A removed or renamed identifier that the mapping uses blocks imports until it is remapped.
- **RT-23** In the build, a Taxprep simulator stands in for Taxprep. It follows CCH's published rules (RT-3, RT-12, RT-13) and what the Taxprep trial records, and can inject faults: partial import, wrong client, reordered copies, a stale export, spreadsheet-mangled numbers, an edit outside the trace.
- **RT-24** The mapping table also names, for each cell Taxprep rolls forward, the cell of last year's return that feeds it (the roll-forward map, settled on the Taxprep trial); with no prior-year facts, no cell counts as rolled forward.
