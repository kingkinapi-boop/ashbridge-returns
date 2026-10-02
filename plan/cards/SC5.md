# SC5 Settings and strictness rules R71 to R73

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
- **R71** `process.env` appears in no `src/**` file except `src/core/env.ts` (tests and fixtures aside), and every setting name a module exports (`*_SETTING_NAMES`) or reads is a key of env.ts's schema. Planted: `options.env ?? process.env`. Expected KNOWN on landing: ocr and storage indexes (owner FX2) unless FX2 has landed.
- **R72** no boolean literal constant gates a branch in `src/modules` or `src/core` (for example `const X = false as boolean; if (!X)`). Planted: a `GO_LIVE_ON` constant.
- **R73** R23 extended: every zod schema in `src/modules/**` that parses a file read from disk is strict at every depth. Planted: a recording schema built with `z.object`. Expected KNOWN: the storage drive `Index` (owner FX2).

## Build
Rules only; no product code. A rule that fails on landed code is a KNOWN entry, never a product fix here.

## Check
A checker who did neither: the three rules fail on their planted fixtures and pass on main (with the KNOWN entries named), and the KNOWN table lists owners that exist in plan/slices.json.

## Not in this card
The fixes themselves: FX2 (ocr, storage), A04 round 2 (runner), A06 round 2 (auth index).
