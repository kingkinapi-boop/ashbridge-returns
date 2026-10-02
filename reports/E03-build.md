# E03 build report

Branch `claude/E03`. Worker cloud-839492. Node 22 in this cloud machine (nvm has no Node 24 offline): `npm ci --engine-strict=false` was needed; typecheck and the full suite pass on it.

Files: `src/contracts/facts.ts`, `src/contracts/facts.test.ts`, `data/facts/catalogue.json` (156 keys).
Acceptance: 109 of 109 pass. Own unit tests: 3. Full suite 203 of 203, typecheck clean.
Scope: `node tools/scope.mjs E03` flags only the spec's `src/contracts/__fixtures__/fact-catalogue.ts` (the spec writer's file, not mine; add it to the card's paths).

Ambers:
- `DOCUMENT_KINDS` = the 16 extractor ids plus `payroll-remittance` and `cra-notice` (E02 names them; reverse: drop them).
- Entry shape per the spec's fixture header (entries list, cites, repeating rowKey); version = sha256 of canonical content sorted by key.
- Card numbers are sensitive by the `.card_number` name rule; CRA program numbers are keyed `onboarding.cra_program.program` (no account number key, a documented non-restricted exception).
- Many catalogue labels and cites for CRA lines are best-effort from memory; the Lead may want a check of the line numbers against the T2 forms.

Not done: nothing outstanding.
Permission gaps: none. Model: Sonnet 5.5 (core card, build is not spec/check).
