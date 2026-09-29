# Taxprep trial week: the plan

The CCH iFirm Taxprep Pro trial lasts one week (decision 0008, Z8-6). In that week we prove everything the build assumes about Taxprep, on made-up companies, and capture enough that the build never needs the trial again. Zo starts the trial only when the to-do says "ready".

## Ready before day 1 (target: Thu 1 Oct, evening)
- The ten sample clients in `reference/sample-clients/`, each with its import CSV (GIFI plus the schedule inputs it needs) and its answer key.
- A separate Chrome profile holding only the trial and the QBO test companies: no real client account signed in (Z8-9).
- The capture folder `reference/taxprep/` (structure and made-up values only, never real values).
- The walk runs on Zo's laptop, in his hotspot hours, by one Sonnet 5.5 walker with Chrome; an Opus 5.5 helper reads each day's captures and adjusts the next day's script.

## Day by day
1. **The cell map.** Create returns for three sample companies (a simple one, the associated pair, the shareholder-loan one). Set year start and end by hand (the CSV import ignores them). Build the saved filter "all input cells" and export it: the identifier list per form is the backbone of the mapping. Record the Taxprep release, the CSV syntax as the trial shows it, and the export settings.
2. **The round trip (Zo's phase 0 gate).** Import our CSV for company 1 (GIFI and Schedules 1, 8, 50, 100, 125 inputs). Read the import report. Export all input cells and compare cell for cell. Then answer the six open questions: can a CSV import clear a cell; what happens to repeating-form copy numbers after a delete; can a saved filter export calculated cells; which cell is never sent to CRA (to hold our import tag); which text encoding the import expects (accents); which cells Taxprep fills by itself from the GIFI (the orphan risk).
3. **The preparer's work in Taxprep (F3).** Make typical tax choices in Taxprep (CCA classes, a dividend designation, the business limit shared on Schedule 23 for the associated pair). Lock, export, print with diagnostics. Can every typed cell be told apart in the export? Collect the diagnostics list and which ones block e-filing. Try roll-forward to the next year, and conversion from another program's file if the trial allows.
4. **Auto-fill (Zo).** Zo signs in for the business he chose (red: real data, his choice). The walker records which cells Auto-fill fills and their formats, never the values, then deletes that return.
5. **All ten companies.** Import each; lock; export; print. Record every import error and every diagnostic.
6. **Changes after lock and the transmit check (F4).** Unlock, change a cell, relock: what does the export show? Can a change made outside our trace be detected? What differs between the lock export and a check export just before transmit? Never transmit.
7. **Buffer and wrap-up.** Redo whatever failed. Write `reference/taxprep/FINDINGS.md`: the cell map, the answers to the six questions, the diagnostics list, what the simulator must imitate, and what the plan should change.

## The QBO track (in parallel, not time-limited)
- A free Intuit developer account and Canadian sandbox companies for the sample clients (Intuit's site says up to 10, active two years, region chosen at creation; confirm when creating). Never the firm's real QBO client list.
- For each: load the bank and card CSVs, categorise, make the adjusting entries with a memo each, run the trial balance and the other reports, export them. Find out: does a sandbox give GIFI mapping and a GIFI export, or only QuickBooks Online Accountant's Workpapers on real client files? What does each export look like, and what would the API give later?

## Rules
- Made-up companies only, apart from the one Auto-fill test Zo chooses; from it, only structure is saved.
- Never e-file or transmit. Never touch the firm's real Taxprep or QBO account.
- Every capture goes to `reference/taxprep/` or `reference/qbo/` with the date and the product release.
- The walker stops and asks Zo if a screen asks for payment, a licence, CRA credentials or anything real.
