# SC5 check (cloud-8c7eee, 3 Oct 2026)

FAIL. Typecheck, lint, deps:check clean; tools/test 503 of 503 pass; settings-rules 42 of 42; spec diff empty (build touched no spec file); scope OK (23 files); no @mutate file. Opus adversarial read (reports/SC5-opus-read.md) FAILS on coverage and KNOWN ownership:

1. tools/test/__fixtures__/settings-rules/known.json:53: FX16 entry names src/contracts/bridge.ts, but FX16's Paths (A511) name src/modules/bridge/bridge.ts, which does not exist; FX16 cannot fix the file or delete the entry. FX11 owns the R101-json and R101-run entries (lines 99, 133) though its card only names R84.
2. settings-rules.test.mjs:1178: R101-run drives only 3 hand-listed readers; a disk JSON reader with no driver fails nothing (R73-run and R84-run do fail), so engines.ts and runner.ts never get the behaviour test.
3. settings-rules.test.mjs:1028: R84 scans only `__recordings__/`; src/modules/ocr/recorded/__golden__/one-page.recording.json (both engine fields) is never checked.
4. planted-r73-schemas.mjs:9 (test :943): title says a loose piped part is caught, but the piped stamp is strict; the pipe walk is never tested with a loose part.

Clean: plants for R71, R72, R73, R88, R83, R84 match main's phrasing; STAMP_PARTS_FROM_JOB derives from versionStampSchema.shape; every scan asserts a sentinel; no other rule, owner entry or pinned list edited.
Rule candidate: every "run every reader" rule fails a reader with no driver.
Permission gaps: none. Model: Sonnet checker; Opus read for the adversarial pass.
