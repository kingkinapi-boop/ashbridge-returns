# 07 Learning loop

- **LL-1** Saved automatically for every return: the AI's raw facts (before any person touches them), the AI draft import, export 1, export 2 (preparer version), the CPA-final version (export 2 at approval), export 3, and the assessed amounts from the notice.
- **LL-2** Each cell in each version has an owner: AI-filled, held back (not imported), preparer-only (judgment input or allowed typing), rolled forward, or calculated. Only AI-filled cells count against the AI.
- **LL-3** Versions are compared by figure key and natural row key, never by copy number.
- **LL-4** Each difference gets a cause, set by code rules first: late information (a document or answer that arrived after the draft), reading (the extracted value differs from the words in its box), classification, mapping, client data, question design, judgment, tax knowledge, missing check. AI proposes a cause only when no rule applies, marked unconfirmed.
- **LL-5** Each difference records where it was caught and the earliest stage that could have caught it.
- **LL-6** Also captured: flags the preparer dismissed, client disputes at approval, questions whose answers changed nothing, and AI citations that failed (AI-4).
- **LL-7** Ranking: how often it happens times its tax effect, with a fixed weight for zero-dollar items; anything a client or CRA caught goes first.
- **LL-8** Every Monday the system writes the top ten as draft build cards, each with a failing test built from made-up data shaped like the case. They join the build queue. A fixed item that recurs reopens itself at the top.
- **LL-9** Measures: AI draft match (AI-filled cells still right at CPA-final); extraction accuracy on raw facts, by document type; preparer match; repeat rate after a fix; escape rate (caught later than it could have been); false alarms per check; red-team hit rate.
