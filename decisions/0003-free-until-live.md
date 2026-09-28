# 0003: Free until go-live, made-up data only (28 September 2026)

Status: in force. Authority: Zo, 28 Sep 2026: "We keep this build free. anything that needs money, we build the infra for but it won't be paid / connected until we go live." Never edit: supersede.

- **F-1** No paid service, account, key or subscription is added before Zo's go-live yes (blueprint 10). Each outside service gets an adapter with a free stand-in and a live backend that stays switched off (blueprint ARC-6).
- **F-2** Free stand-ins: PGlite and Postgres 16 in the cloud for the database; a local folder for files and for the Drive; the PDF text layer and Tesseract for reading documents; recorded answers, and `claude -p` on Zo's existing subscription, for AI; test users for sign-in; the Taxprep simulator for Taxprep.
- **F-3** Made-up data only: the twelve test-world corporations. No real client, document, name, SIN or business number enters the build. The client app's repo may be read (read-only) to learn its data shapes, never its data.
- **F-4** No hosting before go-live. Staff screens are shown to Zo through screenshots on the progress page.
- **F-5** Claude usage (plan and cloud credit) is not "money" for this rule: it is already paid for and is governed by the modes (decision 0004).
