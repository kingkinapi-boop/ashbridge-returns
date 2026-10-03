# GL6 OCR benchmark on the test world (for choosing a vendor at go-live)

Phase 4. Size M. Deps: A01, A02, W37, W38, F09, FX11. Where: cloud (Tesseract timing and scan reading on the cloud Linux runner).
Tags: none (no money arithmetic, no permission; it measures engines on made-up documents and changes no reading).
Paths: src/modules/ocr/benchmark/**
Clauses: LIVE-3, ARC-6, EV-6, ARC-16, SEC-11
Read: blueprint 10 (LIVE-3), 09 (ARC-6 and its adapter table, ARC-11, ARC-16, ARC-20), 03 (EV-6), 08 (SEC-9, SEC-11), decision 0003 (free until go-live); `plan/cards/F09.md` (the reading contract, `valueInBox`), `plan/cards/A01.md`, `plan/cards/A02.md`, `plan/cards/FX11.md`, `plan/cards/GL1.md` (the engine registry; `live` refuses until go-live), `src/modules/ocr/index.ts` (`createReadingAdapter`), `plan/cards/W20.md` (answer files: each placed value's page and box), `plan/cards/families/render.md`, the W37 and W38 entries (scans, the messy set), `reports/phase4-card-review-2026-10-03.md` (C3).
Spec commit: (spec-writer fills)

## Goal
At go-live an OCR vendor is chosen by testing (LIVE-3). This card builds the test: a benchmark that runs any reading engine through the OCR adapter on the test world's documents and scores what matters for citations, whether each known value is found in its known box (EV-6), plus speed and failures. It runs here on the free engines only (`textlayer` and `tesseract`), so the stand-ins have a baseline and a vendor engine plugs into the same port at go-live. No vendor is named, run or priced here.

## Spec
- Fixtures (pinned clock, fixed seeds): a small set of test-world documents with W20 answer files: born-digital pages, W37 scans and W38 messy documents; fake engines through F09's reading contract: one exact, one that moves every box one box-width right, one that drops page 2, one that throws on one document; a planted answer file listing a value not printed in its PDF; a document with no test-world answer file.
- Classes:
  - EV-6 score: for each placed value in a document's answer file, a hit when F09's `valueInBox` finds it at its page and box in the engine's words; "elsewhere" when it is on the page outside its box; a miss otherwise. Rates per document family and per kind (text, scan, messy) as integer basis points, `floor(10000 * hits / cases)`, or "no cases" (I40's convention). Planted: the exact engine scores 10,000 on every fixture value except the planted unprinted one (a miss for every engine); the moved-box engine gives 0 hits and every value "elsewhere"; the page-2 engine misses exactly the page-2 values.
  - Failures: an engine error on one document is counted with the document id and the reason, and every other document is still scored (never a thrown run, never a silent skip).
  - ARC-6 one port: engines come only from `createReadingAdapter` by engine name (a source scan finds no import of an engine folder in `benchmark/`); asking for `live` while go-live is off refuses with the adapter's reason and scores nothing; `recorded` is refused naming it (it replays, it measures nothing).
  - SEC-11 made-up only: every document must have a test-world answer file and pass W00's made-up data guard; the document with none is refused and nothing is read. The benchmark never takes a document from outside the test world, in the build or at go-live.
  - ARC-16: scores are deterministic (two runs give byte-identical `scores.json`); time per page (median and 95th percentile, milliseconds) is measured with an injected clock and written to a separate `timing.json`, which no golden file holds.
  - Compare: `compareEngines(resultDirs)` writes one table (`report.md` and `report.json`) of the engines run: rates per family and kind, "elsewhere" counts, failures, time per page, and a cost column that reads "not measured here (LIVE-3)" for every engine.
- Golden file (`src/modules/ocr/benchmark/__golden__/`): the fixture set's `scores.json` for the exact fake engine and for `textlayer`.

## Build
- `src/modules/ocr/benchmark/`: `benchmark(engineName, documents, deps)`, `compareEngines`, `cli.ts` (`run --engine <name> --out <folder>`, `compare <folders>`; prints scores and paths only). `// @mutate` on the scoring (mutation 100, ARC-15).
- Results go to the folder the call names; nothing is committed by a run. The free engines' first full run on the test world is a Lead step after this card lands, its numbers kept for LIVE-3.

## Check
A checker who did neither: acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, the golden files equal on two runs, A01, A02 and FX11's tests unchanged and green, scope clean.

## Not in this card
Choosing, connecting or paying any OCR vendor, or sending any document to one (LIVE-3 and SEC-9: Zo's yes at go-live). The vendor's live engine (GL1 builds the vendor-neutral port). Changing how any engine reads (A01, A02).
