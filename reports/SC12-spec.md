# SC12 spec report

Worker cloud-dfeb44. Branch `claude/SC12`. File `tools/test/fs-rules.test.mjs` (23 tests) and 12 fixtures under `tools/test/__fixtures__/fs-rules/`.

## What it holds
- R93 (id in a path checked by a named grammar first), R94 (reads through `readRegularFile`, listing names logged quoted), R95 (waiting loops bounded), R96 (child processes have a timeout, no kill by name), R97 (`isTest` and `is_test` written only in `src/pipeline`).
- Each rule: a planted fixture is caught, a clean one passes, then a scan of every product file under `src/` with a KNOWN table (rule, file, exact problem string, open owner card). Unlisted problems fail, stale entries fail, each scan asserts more than 20 files and the sentinels `engines.ts`, `safe-read.ts` and `storage/files/index.ts`.
- Exception for R93: a line comment `// fs-safe: <reason>` on the line before the call.

## KNOWN entries (9)
- R93 and R94 in `src/modules/storage/files/index.ts` and `src/modules/storage/drive/index.ts`: owner FX7.
- R93 `src/modules/ocr/recorded/index.ts` write: owner FX11.

## Validation
- `npx vitest run --project unit tools/test`: 299 passed. Full unit suite: 2870 tests, run on origin/main plus A04 merged, all pass after the fix to avoid the literal schema folder path (ARC-4 R4).

## Amber
- R93 only looks at calls whose path text names an id-like variable (id, name, key, file, tmp, ...); a folder from config is not an id. Reverse: widen `ID_LIKE`.
- Repo-data reads (db, ocr recorded, gaps bank, schemas) are exempt from R93 and R94 by a named table with reasons.
- The spec lists no builder work for A04: it passes today with KNOWN entries, so the build (SC12 build) is only to fix FX7 and FX11 later; it still needs a builder to confirm.

## Permission gaps
None.

## Model
Sonnet 5.5 (no `core` tag on this card).
