# 10 Go-live (every item is red: each needs Zo's yes)

- **LIVE-1** Real Taxprep proof: with three made-up corporations in the firm's Taxprep, the lock export and the check export behave as the simulator does. Differences are fixed in the simulator and the code first. The token cell and the allowed diagnostics, first settled on the Taxprep trial, are confirmed here.
- **LIVE-2** The real cell identifier list for the current Taxprep release is loaded; the mapping and the drift check are clean.
- **LIVE-3** Vendors chosen by testing (OCR, AI, storage, hosting), with Canadian data residency where available, and their costs shown to Zo.
- **LIVE-4** The schema applied to the live database as one reviewed migration; the public key reads nothing. Before it is applied, every live query of both apps that touches a shared table or view is run against the new schema (EXPLAIN), or the code ships first.
- **LIVE-5** Staff accounts with two-factor sign-in and roles.
- **LIVE-6** The client app's side built in its own repo: the year-end questions and the approval summary, in wording Zo approved. The bridge is re-checked against the client app's latest migrations.
- **LIVE-7** AI measured on the fixed test set with the live model; the numbers shown to Zo.
- **LIVE-8** All thirteen return kinds pass end to end against the live backends in test mode.
- **LIVE-9** A walk on the real host that asks only what differs there: upload and reply size limits, time and memory limits, redirects, settings and secrets. Each limit found becomes a clause and a test.
