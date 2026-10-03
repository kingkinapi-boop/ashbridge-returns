# GL4 Real Taxprep proof kit for ops

Phase 4. Size M. Deps: J3-K01 to J3-K13, FX9. Where: local or cloud (core: spec read and check by Opus).
Tags: core (Taxprep CSV: the kit's files and the compare of real exports with the simulator's).
Paths: reference/golive/**, data/taxprep/proof/**, src/modules/golive/taxprep-proof/**
Clauses: LIVE-1, LIVE-2, RT-22, ARC-14
Read: blueprint 10 (LIVE-1, LIVE-2), 04 (RT-1, RT-2, RT-7, RT-14, RT-15, RT-17, RT-22, RT-23), 09 (ARC-14), decision 0008 (Z8-7: structure only, never values, from the firm's Taxprep); `reference/taxprep/FINDINGS.md` (export settings, the header, the structure exports), `reference/sample-clients/README.md`, `plan/cards/S00.md` (`importCsv`, `exportCsv` filters), `plan/cards/S02.md` (`loadRelease`, `diffReleases`, the release file), `plan/cards/S03.md` (the trial's export settings and diagnostics), `plan/cards/M00.md` (`loadMapping`, `blockedImports`), `plan/cards/T01.md`, `plan/cards/T02.md` (the export reader and identity checks), `plan/cards/T05.md` (the pasted diagnostics list and the allowed list), `plan/cards/FX9.md` (no new Taxprep CSV on main before FX9), the J3 journey family, `reports/phase4-card-review-2026-10-03.md` (C3).
Spec commit: (spec-writer fills)

## Goal
At go-live ops proves that the firm's real Taxprep behaves as the simulator does (LIVE-1) and loads the real cell identifier list for the current release (LIVE-2). This card gives ops the kit: the import files for three made-up corporations, the simulator's expected lock and check exports, a plain procedure, and a tool that compares what real Taxprep gave back with what the simulator gave, cell by cell, and checks the real identifier list against the mapping. Every difference found is fixed in the simulator and the code first (LIVE-1); this card fixes none.

## Spec
- The three corporations (LIVE-1, nothing else): test-world clients C01 (the walking skeleton's client), C07 (rental building, class 1 CCA) and C11 (K01, returning, last year is ours, so the roll-forward and last-year columns are proven). Names end "(Test)"; business numbers fail their check digit.
- Fixtures: the three clients through J3's harness to their CPA-final facts; simulated "real" exports made by the simulator with S01 faults (a renumbered copy, a changed amount, a missing cell, an extra cell, a date in another format, an added diagnostic not on the allowed list); a structure export for the simulator's release and a copy with one identifier renamed; sentinel values planted in the "real" files (a partner name in `IFirm.ContactPartner`, a GUID, a unique amount).
- Classes:
  - ARC-14 kit: `buildKit(outDir, deps)` writes, per client, `import.csv` (T01's writer), `expected-lock.csv` and `expected-check.csv` (the simulator after importing it, S00's "entered" filter and S03's export settings); building twice gives byte-identical files whose sha256 and byte length equal `data/taxprep/proof/kit.json` (the golden). No CSV is committed (FX9, R37): the kit is built into a folder outside the repo when ops needs it.
  - LIVE-1 compare: `compareProof(kitDir, realDir)` reads the real lock and check exports through T02's reader and compares them with the expected ones by identifier and natural row key, never by copy number (RT-7). Each cell gets one class: identical; value differs; format differs (the same value after F03's normalisation); missing in real; extra in real. The creation and contact cells of RT-15 are reported as "Taxprep cell" and never fail the proof. A renumbered copy alone gives no difference. Planted: each S01 fault above gives exactly its class on its cell.
  - RT-1 and RT-2: T02's identity checks run on each real export (business number, year end, header GUID recorded from the first export); the procedure's staleness step (change one cell in Taxprep after exporting, export again) must be refused by T02's content staleness rule, and the tool reports pass or fail for it.
  - RT-17: the pasted Diagnostics panel list for each return is read by T05 and compared with the simulator's list and T05's allowed list; a diagnostic on neither is listed for a person.
  - LIVE-2 and RT-22: `releaseFromStructureExport(file)` builds S02's release file shape from the structure export of a blank return in the current release; then M00's `loadMapping` and `blockedImports` run against it and the tool prints "clean" or each blocked mapping row with its file and identifier. Planted: the simulator's own structure export gives a release equal to the simulator's release; the renamed identifier blocks exactly the mapping rows that use it. Adding the real release file to `data/taxprep/releases/` is a go-live step under an amber row, not this card.
  - Structure only (decision 0008 pattern): real exports are read from a folder outside the repo (the tool refuses a folder inside the working tree); the report holds identifiers, classes and value kinds only, never a value, GUID, name or contact cell content: no planted sentinel appears in any output (scan of every file the tool writes and everything it prints).
  - Report: `report.json` and `report.md` written to a folder the call names: per client, counts by class, each difference row (identifier, class, kind), the identity and staleness results, the diagnostics list, the release check, and one verdict: "matches the simulator" only when every class is identical or Taxprep cell and every check passed; otherwise "differences to fix first" (LIVE-1).

## Build
- `src/modules/golive/taxprep-proof/`: `buildKit`, `compareProof`, `releaseFromStructureExport`, `cli.ts` (`kit --out <folder>`, `compare --kit <folder> --real <folder> --out <folder>`, `release --structure <file>`). `// @mutate` on the compare and the class pick (mutation 100, ARC-15).
- `data/taxprep/proof/kit.json` (strict: the three client ids, the release name, each file's name, sha256 and byte length).
- `reference/golive/taxprep-proof.md`: the steps for ops in plain words (create each made-up corporation's return in the firm's Taxprep, import, lock, export with the trial's settings, copy the Diagnostics panel list, the staleness step, the structure export of a blank return, run the tool, send the report to the Lead). Staff instructions only; no client wording.

## Check
By a third worker (Opus read): acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, the golden hashes equal on two runs, the sentinel scan green, the S00 to S03, M00, T01, T02 and T05 tests unchanged and green, scope clean.

## Not in this card
Running the proof in the firm's real Taxprep (go-live: ops, LIVE-1). Fixing any difference found (simulator and code cards first, LIVE-1). Committing the real release list (go-live, S02's format, amber). The Auto-fill test (decision 0008, the trial).
