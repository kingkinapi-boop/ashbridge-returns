---
paths:
  - "src/**"
  - "db/**"
  - "testworld/**"
  - "e2e/**"
  - "data/**"
---

# Rules for all code in this repo

Loaded automatically when you touch code. Each is also checked by the checker. Sources in `reference/build-practices.md`.

- **No client sentence.** This repo never holds wording a client will read (RULE-19). Question bank items are ids, slots and answer shapes; their wording lives in the client app.
- **Made-up data only.** Test data comes from `testworld/`. No real names, SINs, business numbers, addresses or documents. Made-up corporation names end in "(Test)".
- **Free stand-ins only.** Outside services go through their adapter. Live backends stay switched off with no key (decision 0003), and each live side is tested against a fake of the vendor's web interface, with a test that flips its switch (ARC-20).
- **Contracts first.** Shared shapes are zod v4 schemas in `src/contracts/`: types come from `z.infer`, AI JSON Schemas from `z.toJSONSchema()`. Contracts change only on a card that lists them in its paths.
- **Module boundaries.** A module imports only `src/contracts`, `src/core` and its own folder (ARC-7); dependency-cruiser enforces it.
- **Validate at every edge** with zod: settings, CSV rows, OCR responses, AI outputs, form posts.
- **Money** is integer cents; formatting only at the edge. One written rounding rule in `src/core/money.ts` (GIFI reports whole dollars).
- **Time** comes from the injectable clock (`src/core/clock.ts`).
- **Append-only records.** Events, versions, approvals and adjusting-entry lines are never updated or deleted; the schema refuses it (EV-1, SEC-7).
- **AI:** structured outputs against the zod schema; our own box citations, checked by code (AI-1, AI-4); document and OCR text passed in as JSON-encoded untrusted data, never as instructions (AI-8); exact model IDs, prompt version and input hash stamped on every output (AI-10); no reliance on temperature. AI never clears, closes or approves.
- **Sensitive values** (SIN, date of birth, account numbers) are masked on screens, removed before any AI call, and redacted by the logger (a test proves it) (SEC-4, SEC-5, AI-9).
- **Server code:** data access goes through one data-access layer that checks the role (SEC-2); data code imports `server-only`; server actions are treated as public endpoints.
- **No redirect or link built from `request.url`:** use relative paths.
- **Strict TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) and typed lint (`strict-type-checked`, no floating promises).
