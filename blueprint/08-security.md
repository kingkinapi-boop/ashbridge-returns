# 08 Security and data

- **SEC-1** Per-person logins with two-factor sign-in. Roles: preparer, ops, CPA, owner.
- **SEC-2** A preparer sees only the returns assigned to them. Ops sees ops work. The CPA and the owner see everything.
- **SEC-3** Every source a person opens is logged: who, what, when.
- **SEC-4** SINs, dates of birth and banking details are masked on every screen. In Taxprep, security roles hide SINs.
- **SEC-5** Sensitive values are masked in text and blacked out on page images before any AI call (AI-9).
- **SEC-6** All database access is server-side. Row-level security denies everything by default. The public key reads nothing, and a test proves it.
- **SEC-7** Events, versions and approvals cannot be changed or deleted; the database enforces it.
- **SEC-8** Binders are kept at least six years, and each T183CORP at least six years after the return was filed.
- **SEC-9** No client data leaves Canada unless Zo approves that vendor (red).
- **SEC-10** No secret in the repo, in logs or in chat.
- **SEC-11** Until go-live, only made-up data exists in this system.
