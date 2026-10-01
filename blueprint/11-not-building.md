# 11 Not building

- **OUT-1** No client-facing screens, emails or wording in this repo.
- **OUT-2** No AI that talks to clients.
- **OUT-3** The system never files, pays, moves money, writes to QuickBooks or connects to a bank. Ops transmits returns from Taxprep.
- **OUT-4** No Taxprep API.
- **OUT-5** Edge cases for a handful of clients are handled by a person and listed in the firm's manual, not built.
- **OUT-6** Personal returns (T1) are not prepared in this system. A client-app record with only personal returns, or a company with no T2 bought, is skipped without error and without stopping the others.
- **OUT-7** No bookkeeping module: the books live in QBO, where the firm keeps them for bank-only clients, and Returns only reads them (TB-1 to TB-12).
- **OUT-8** No financial statements and no CSRS 4200 compilation work: QBO makes the statements and the GIFI mapping.
- **OUT-9** No slip preparation: T4 and T5 slips are prepared by hand in Taxprep, and Returns only checks them (CK-23, CK-24, CK-38).
- **OUT-10** No measuring of time saved, and no shadow-pilot planning (decision 0008, Z8-15).
- **OUT-11** Only Ontario corporations are built for (decision 0008, Z8-4); a return showing a permanent establishment outside Ontario is flagged for a person and prepared by hand.

## Future ideas (not this build; moved in only by Zo)

- Taxprep Web API, to automate the CSV steps.
- Scripting the Taxprep import and export clicks, if CCH's licence allows it.
- Random full reviews of green files, and planted test files (after busy season).
- Fixes that test themselves silently, then switch on.
- Bank feeds as an independent source.
- Live connections to accounting software other than QBO.
- Per-preparer scorecards.
- Reviewing a family's T2s and personal returns together.
