# 11 Not building

- **OUT-1** No client-facing screens, emails or wording in this repo.
- **OUT-2** No AI that talks to clients.
- **OUT-3** The system never files, pays, moves money, writes to QuickBooks or connects to a bank. Ops transmits returns from Taxprep.
- **OUT-4** No Taxprep API.
- **OUT-5** Edge cases for a handful of clients are handled by a person and listed in the firm's manual, not built.

## Future ideas (not this build; moved in only by Zo)

- Taxprep Web API, to automate the CSV steps.
- Scripting the Taxprep import and export clicks, if CCH's licence allows it.
- Random full reviews of green files, and planted test files (after busy season).
- Fixes that test themselves silently, then switch on.
- Bank feeds as an independent source.
- Live connections to the client's accounting software.
- Per-preparer scorecards.
- Reviewing a family's T2s and personal returns together.
