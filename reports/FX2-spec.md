# FX2 spec (cloud-253f9f, 3 Oct 2026)
- 23 tests in src/modules/ocr/engine-setting.test.ts (9) and src/modules/storage/engine-setting.test.ts (14); 14 fail for the right reason (OCR_ENGINE, STORAGE_FILES_ENGINE, STORAGE_DRIVE_ENGINE not in env.ts; no production refusal). Clauses: SEC-11, ARC-6, ARC-20, SEC-10.
- validated on main 7eaf18c: typecheck and lint green; npm test green except the 14.
- Step 6b retired tests: none (existing settings.acceptance and adapter.acceptance tests use no NODE_ENV, so they are unaffected).
- Amber: A05's settings are STORAGE_FILES_ENGINE and STORAGE_DRIVE_ENGINE (the card did not name them); the refusal message names the setting; blank reads as unset; live still fails as "off" in production. Builder must also drop the `process.env` default in storage files/drive index (read via readSettings) and make readEngine take env.ts values.
Model: Sonnet 5.5. Permission gaps: none.
