# SC5 Settings and strictness rules R71 to R73

Phase 0. Size S. Deps: A06, FX2, A04. Where: cloud.
Tags: core (settings that switch engines and go-live; strict parsing of files read from disk).
Paths: tools/test/settings-rules.test.mjs, tools/test/__fixtures__/settings-rules/**
Clauses: ARC-20, ARC-15, ARC-22, SEC-11
Read: `reports/A04-findings.md` ("Rule tests for everywhere", "Where else"), `plan/cards/SC.md` (rule style, R23, KNOWN table), `plan/cards/SC3.md` (R62), `.claude/rules/testing.md`.
Spec commit: 7f49fdb0 (validated on main 89be70a6)

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
