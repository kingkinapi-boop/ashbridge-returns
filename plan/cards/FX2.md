# FX2 Stand-ins refuse to start in production when their setting is unset (A01, A05)

Phase 0. Size S. Deps: A06. Where: cloud.
Tags: security (a stand-in chosen by silence in production).
Paths: src/core/env.ts, src/modules/ocr/index.ts, src/modules/storage/index.ts, src/modules/ocr/engine-setting.test.ts, src/modules/storage/engine-setting.test.ts
Clauses: SEC-11, ARC-6, ARC-20
Read: `reports/A06-findings.md` (RC1, R62), `plan/cards/A01.md`, `plan/cards/A05.md`, `src/core/env.ts` after A06 round 2.
Spec commit: (spec-writer fills)

## Goal
A01 reads `OCR_ENGINE ?? 'textlayer'` and A05 its storage engine the same way, straight from process.env, so a go-live deploy that forgets the setting runs the stand-in silently. Both landed, so this card fixes them rather than a later rebuild.

## Spec
1. Both settings are declared in src/core/env.ts with A06's pattern: the stand-in is the default outside production; with NODE_ENV=production and the setting unset, the factory refuses with a message naming the setting.
2. Both directions tested for each (production unset refuses, production set works, development unset uses the stand-in).

## Build
Read the settings through env.ts only; no module reads process.env for an engine.

## Check
A checker who did neither: the card's tests, `npm test`, and R62 (SC3) once it exists.
