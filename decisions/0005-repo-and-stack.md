# 0005: Repo, stack and build shape (28 September 2026)

Status: in force as the Lead's executive decisions (amber A1 to A6), reversible until R00 merges. Authority: Zo, 28 Sep 2026: "I will create a new repo for this. Make sure anything related to this is in one folder [...] I would like for you to make executive decisions where you can." Never edit: supersede.

- **S-1** One folder, `C:\Users\User\Documents\GitHub\ashbridge-returns`, is the whole repo. Nothing for this build lives in ashbridge-app.
- **S-2** Name: ashbridge-returns, so "production" keeps meaning the live client site.
- **S-3** Stack: the client app's (Next.js, TypeScript strict, Postgres, Vitest, Playwright), so agents and patterns carry over.
- **S-4** Tests on PGlite (no Docker, no account); cloud journeys on Postgres 16; the schema as editable files until go-live, then one reviewed migration. Parallel builders never clash on migration numbers.
- **S-5** Modules in their own folders; contracts first (R01 to R03), serial; then modules in parallel. Each card owns its paths, and `tools/next.mjs` never starts two cards whose paths overlap.
- **S-6** A Taxprep simulator built from CCH's published CSV rules replaces Taxprep during the build. The real proof is a go-live gate (LIVE-1).
- **S-7** Cloud builders run as routines (the Agent tool's remote option is gated and can silently run locally); cloud sessions push only to `claude/` branches, so every card branch is `claude/<card>`.
