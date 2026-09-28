# 01 Rules

## Fixed decisions (settled; never reopen)

- **RULE-1** No Taxprep API. CSV import and CSV export only.
- **RULE-2** CCH has confirmed: CSV import can fill T2 cells, text included; every cell, including repeating schedules, has an identifier; one saved filter can hold every input cell; the CSV export lists each cell's identifier and value, one export per file; diagnostics print with the return; locking stops edits; returns from other software convert and roll forward; data is hosted in Canada; security roles can hide SINs; CCH iFirm Digital Signature handles the T183CORP and issues a certificate of completion. CCH's help pages add two limits the build respects: blank cells are not imported, and T2 year-start and year-end cells are ignored on import (RT-12, RT-13).
- **RULE-3** Preparers are employees and never contact clients.
- **RULE-4** No AI talks to clients. The client Q&A has no AI. AI works only for preparers and the CPA.
- **RULE-5** Every file follows the same process. No special lanes, no routing to calls.
- **RULE-6** The system works with whatever evidence a file has. Nothing is required.
- **RULE-7** The CPA reviews the full return every time. Flags come first; the review is never exceptions-only.
- **RULE-8** The tier rules (green, amber, red) are approved (CK-40).
- **RULE-9** No materiality threshold for now.
- **RULE-10** The learning loop compares versions: AI draft, preparer, CPA-final and CRA-assessed. It catches and ranks lessons on its own.
- **RULE-11** Clients authorize the firm's business number with CRA. Only ops staff sign in to CRA.
- **RULE-12** Sampling, planted test files and similar quality work come after busy season (blueprint 11).

## Design rules

- **RULE-13** Source at birth. A figure gets its source when it is created. Nothing guesses a source afterwards.
- **RULE-14** No orphans at sign-off. A value with no source blocks the preparer's sign-off.
- **RULE-15** Full review, made fast: flags first, every number one click from its source.
- **RULE-16** Every change is a lesson: versions are kept and compared automatically.
- **RULE-17** Code before AI. Anything that can be computed is computed. AI reads documents and handles judgment, and is never the only check on any figure.
- **RULE-18** AI never clears, closes or approves anything. Only a person or a code check does.
- **RULE-19** This repo holds no client sentence. Client-facing wording lives in the client app.
- **RULE-20** Free until go-live, and made-up data only until go-live (decision 0003).
- **RULE-21** Flag, never decide, on tax judgment: when a rule is uncertain the system raises a flag for a person; it never passes an item silently.
