# A03 build (cloud-85bb68, 2 Oct 2026)
Branch claude/A03, head ef35600 (main merged in). Files: src/modules/ocr/recorded/index.ts (new), src/modules/ocr/index.ts (recorded case, recordingsDir option, exports), src/modules/ocr/recorded/recorded.test.ts (own tests).
- Acceptance: all 2 spec files pass (25 tests of the 168 in src/modules/ocr); full suite 1942 + 427 pass. typecheck, lint, deps:check clean; scope OK (11 files); mutate:changed A03 = 100.00 (every file 100).
- Amber: the recording file is validated whole by a strict zod schema (unknown top-level key refused); fingerprints must be 64 lowercase hex (path safety); record also refuses a result whose documentFingerprint is not the document's own sha256. Static mutants (module-level regex and schema) moved into functions so they can be killed. Reverse: edit index.ts.
- Not done: none. Permission gaps: none. Model: Sonnet 5.5.
