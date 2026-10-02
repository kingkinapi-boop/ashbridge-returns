# A01 spec (2 Oct, cloud spec worker)

1. Tests: 31 in `src/modules/ocr/textlayer/textlayer.acceptance.test.ts` (21, checks 1 to 6 plus fixture drift), `src/modules/ocr/adapter.acceptance.test.ts` (5, check 7), `src/modules/ocr/textlayer/dependency.acceptance.test.ts` (5, check 8). Fixtures: `__fixtures__/make-fixtures.ts` writes 8 raw-syntax PDFs (one-page, rotated /Rotate 90, two-pages, image-page with page 2 a scan, scan-only, encrypted RC4-40 with user password, truncated, not-a-pdf) and 5 `*.expected.json`; Courier 12 with explicit /Widths so boxes are exact; `harness.ts` compares boxes at 0.01.
2. Clauses: ARC-6, ARC-10 (stamp), ARC-11, EV-6, END-8. Every check 1 to 8 has a test; planted faults for the box comparison, value-in-box, the store key, live with a key present, lock licences and install scripts, and source reading settings or URLs.
3. Fail for the right reason: all 3 files fail "Cannot find module './index'". Proven non-vacuous: a throwaway pdfjs-dist 6.3.289 reader (scratch only, never committed) passed all 26 reading and adapter tests; only the two package.json/lock tests failed, as they must until the builder adds the dependency. The encrypted fixture opens with password "user (Test)" in pdfjs, so it is a real encrypted file.
4. Validated on main e91389f (with F09's src/contracts/reading.ts checked out locally, not committed): typecheck and lint errors only in these 3 files and only from the missing module (TS2307 and the unsafe-any rules it causes; with a stub module both are clean); `npm test` unit: only these 3 files fail, plus one pre-existing failure on main not from this spec (F03 round 2 RT-3 RT-9 Windows-1252 property, counterexample ["A ","import"]); db project 2 of 2 pass.
5. Commit dce0009 on claude/A01. A01 cannot typecheck on main until F09 lands (reading.ts).

## Interface assumed (written at the top of each test file; the builder follows it)
- `src/modules/ocr/textlayer/index.ts`: `createTextLayerEngine(options?: { tempDir?: string }): TextLayerEngine`, where `TextLayerEngine extends ReadingEngine` with `name: 'textlayer'`, `isLive: false`, `read(doc)`, and `parseCount(): number` (times the library parsed a PDF; a read answered from the store does not count). `TEXTLAYER_LIBRARY: { name, version }` (npm package and exact pin).
- Result: F09's ReadingResult; `engine.version` contains `TEXTLAYER_LIBRARY.version`; `readAt` from the injected clock at parse time; pages hasTextLayer false for a scan page; one word per whitespace-separated word.
- Refusals reject with an Error containing "refused" and "encrypted" or "broken"; nothing written (fs write spies and the temp folder stay empty).
- `src/modules/ocr/index.ts`: `createReadingAdapter(options?: { env?, tempDir? }): ReadingEngine`; settings `OCR_ENGINE` ('textlayer' default | 'tesseract' | 'recorded' | 'live') and `OCR_LIVE_KEY`; live fails "live reading is off until go-live" from the factory or first read, and the key never appears in the error.

## Amber (spec choices)
- ARC-11 store is per engine instance, keyed by fingerprint; a stored result keeps its first readAt (proves no re-parse) and is a copy (a caller mutating a result does not change the store).
- Vertical word box = baseline to baseline + font size; the 0.01 tolerance absorbs ascent/descent conventions. Font size 12 so a trailing space in a width (7.2 pt) is outside tolerance.
- Check 8: `npm audit --audit-level=high` needs the registry, so tests cannot run it; the checker runs it. Tests cover the exact pin (dependencies, lock, installed), open-source licences and no install script for the library and everything it pulls in, and no process.env, URL or key in the textlayer source.
- An unknown OCR_ENGINE value and the tesseract/recorded slots are not tested (A02, A03).

## Permission gaps
A Bash call with `| tail` after `npm install` and a grep into node_modules/pdfjs-dist were denied; worked around with plain commands and the Read tool. The main checkout was on claude/W15 with plan/ledger.jsonl modified, so `git checkout -B claude/A01` aborted; worked in worktrees /home/user/wt-A01 and /home/user/wt-A01-main instead.

## Model
Opus 5.5.
