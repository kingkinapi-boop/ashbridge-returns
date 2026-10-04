# SC5 Settings and strictness rules R71 to R73

**Lead note, 3 Oct 22:00Z (A529):** S5 also adds the driver for the JSON reader in src/modules/ai/project/index.ts (through runAiProjectOnce); A08 no longer holds tools/test/settings-rules.test.mjs.

**Lead directive, 3 Oct 19:40Z (A514): round 2 is a spec patch S1 to S5 (core: an Opus spec writer), no build, after W00c lands (W00c brings testworld readers and z.record files the derived lists must cover); then the Lead marks the build reported and an Opus check runs.** From SC5's findings review 1 of the check FAIL on 80f21140 (Opus; the report stays on the laptop, so this is the whole brief). Root causes: rules list their subjects by hand instead of finding them (R101-run, R84); the owner test checks that the owner card is open, not that it can fix the file; walker branches never planted (R73, R101-record). The Lead moves (FX16 Paths, FX11 and FX7 owner lines, B04 and A08 driver lines) are on main.
R101 owner set (amber): FX16 (records.ts, contracts/bridge.ts, ai/runner schemas.ts, engines.ts, runner.ts, gaps/bank); FX11 (ocr/recorded); FX7 (storage/drive). R84 reads every JSON file in src and testworld carrying both fields, in any folder.
- S1 (RC-1) R101-run derives its readers from the R101-json parser list; a parser with no driver prints `<file>: parses JSON and has no R101 reader driver`. Plant: a test asserting every parser in SRC_TW() has a READERS entry fails on 80f21140 (engines.ts, runner.ts). Then add drivers for engines.ts (a recording and an outbox file) and runner.ts (the approved list) through their exported API, and FX16 KNOWN rows for what they print.
- S2 (RC-1) R84 scans every `*.json` in src and testworld (fixtures of tools aside) and asserts the golden as a second sentinel. Plant: `expect(checked).toContain('src/modules/ocr/recorded/__golden__/one-page.recording.json')` fails on 80f21140.
- S3 (RC-2) KNOWN owner rule: each entry's file matches a glob in its owner card's Paths (tools/lib.mjs globToRegExp) and the owner card's text names the entry's base rule (R101, R73, ...). Plant: today's known.json fails on FX16/contracts/bridge.ts, FX11/R101, FX7/R73 and R101 until moves 1 to 3 land on main.
- S4 (RC-3) planted-r73-schemas.mjs: a loose object behind a pipe (`z.object(...).transform(...)`), plus one loose leaf each behind union, intersection, tuple, map, lazy and a strict object with a loose catchall; expect each path. Plant: delete `case 'pipe'` in a scratch copy of nodes(): today's test still passes, the new one fails. Add a record behind a union and a lazy to planted-r101-records.mjs.
- S5 Re-validate the whole file on main after W00c lands; new KNOWN rows only on owners that pass S3.
Risk: drivers on runner.ts use its exported functions only (A04C and FX16 touch it); re-run settings-rules after both land.

Phase 0. Size S. Deps: A06, FX2, A04. Where: cloud.
Tags: core (settings that switch engines and go-live; strict parsing of files read from disk).
Paths: tools/test/settings-rules.test.mjs, tools/test/__fixtures__/settings-rules/**
Clauses: ARC-20, ARC-15, ARC-22, SEC-11
Read: `reports/A04-findings.md` ("Rule tests for everywhere", "Where else"), `plan/cards/SC.md` (rule style, R23, KNOWN table), `plan/cards/SC3.md` (R62), `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Goal
The causes behind A04's failed check, made rules that run on every module, so B04, A08, L00 and later cards cannot repeat them: settings read around src/core/env.ts, a hard-coded boolean that hides a branch from tests, and loose schemas on files read from disk.

## Spec
Each rule first shown failing on its planted fixture, then passing on main (any failure in landed code gets a KNOWN entry naming its owner card; a KNOWN entry that passes is a failure):
- **R71** `process.env` appears in no `src/**` file except `src/core/env.ts` (tests and fixtures aside), and every setting name a module exports (`*_SETTING_NAMES`) or reads is a key of env.ts's schema. Planted: `options.env ?? process.env`. Expected KNOWN on landing: ocr, storage and auth/index.ts (owner FX2) unless FX2 has landed.
- **R72** no boolean literal constant gates a branch in `src/modules` or `src/core` (for example `const X = false as boolean; if (!X)`). Planted: a `GO_LIVE_ON` constant.
- **R73** R23 extended: every zod schema in `src/modules/**` that parses a file read from disk is strict at every depth. Planted: a recording schema built with `z.object`. Expected KNOWN: the storage drive `Index` (owner FX7, A414).
- **R88** (A435, reports/FX2-security.md) no thrown or logged message in `src/**` interpolates the value of a setting read from env.ts; it names the setting. Planted: a refusal built with `${engine}` from a setting. Expected KNOWN: src/modules/ocr/index.ts (owner FX13).
- **R83** (A426, reports/A04-findings.md) every `src/**/__recordings__/*.json` whose `stamp` parses with `versionStampSchema` and matches a job fixture by key agrees with that job on every part in A04's `STAMP_PARTS_FROM_JOB`, unless named on that folder's planted-mismatch list. Planted: a copy of finding-c01-good with `ocrEngine: "other-ocr"`.
- **R84** (A426) a recording with two provenance fields for one fact (an OCR recording's `sourceEngine` and `result.engine`) agrees on both. Planted: a C01 OCR recording with a different `result.engine.version`. Expected KNOWN: A03's recorded OCR (owner FX11).

## Build
Rules only; no product code. A rule that fails on landed code is a KNOWN entry, never a product fix here.

## Check
A checker who did neither: the three rules fail on their planted fixtures and pass on main (with the KNOWN entries named), and the KNOWN table lists owners that exist in plan/slices.json.

## Not in this card
The fixes themselves: FX2 (ocr, storage, auth index), A04 round 2 (runner), FX7 (drive Index).

## KNOWN shape (3 Oct, A407)
Every KNOWN entry names one rule, one file, the exact problem strings (no regex) and an open owner card; any problem not listed fails, and a listed string not produced fails as stale. Every file scan asserts it read at least one file and a named sentinel.

## Also (A450)
- **R101** every `z.record` in src/** and testworld/** has keys that refuse prototype names, and every JSON read from disk is scanned for repeated and reserved keys. Expected KNOWN: src/contracts/records.ts (owner FX16) and the gaps bank reader (owner FX16).
