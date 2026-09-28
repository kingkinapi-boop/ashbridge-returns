---
paths:
  - "src/**"
  - "db/**"
  - "testworld/**"
  - "e2e/**"
  - "data/**"
---

# Rules for all code in this repo

Loaded automatically when you touch code. Each is also checked by the checker.

- **No client sentence.** This repo never holds wording a client will read (RULE-19). Question bank items are ids, slots and answer shapes; their wording lives in the client app.
- **Made-up data only.** Test data comes from `testworld/`. No real names, SINs, business numbers, addresses or documents. Made-up corporation names end in "(Test)".
- **Free stand-ins only.** Outside services go through their adapter in `src/modules/<service>/`. Live backends stay switched off with no key (decision 0003).
- **Clause IDs in tests.** A test that proves a blueprint clause starts its name with the clause ID (`RT-6 ...`).
- **Append-only records.** Events, versions, approvals and adjusting-entry lines are never updated or deleted; the schema refuses it (EV-1, SEC-7).
- **AI outputs carry citations** that code checks (AI-1, AI-4), and record their versions (AI-10). AI never clears, closes or approves.
- **Sensitive values** (SIN, date of birth, account numbers) are masked on screens and removed before any AI call (SEC-4, AI-9). Never log them.
- **Money:** store cents as integers; show dollars. Tax rules cite their source in the check record (CK-1).
- **Time:** use the injectable clock (`src/core/clock.ts`); tests pin it.
- **Contracts** in `src/contracts/` change only on a card that lists them in its paths.
