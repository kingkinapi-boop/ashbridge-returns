# FX2 Stand-ins refuse to start in production when their setting is unset (A01, A05)

**Lead directive, 3 Oct (A414): round 2 from reports/FX2-findings.md.** Spec job first: both engine-setting tests read source through `readOwnSource` with the same files and regexes (never drop the process.env check, skip in the sandbox, unmark @mutate or exclude files from Stryker: A329); the scan adds `src/modules/auth/index.ts` (fails today for the right reason). Paths now name where the setting is read (storage safe.ts, files/index.ts, drive/index.ts) and auth/index.ts; storage/index.ts dropped. Build round 2: merge the spec; auth/index.ts calls `readSettings(opts.env)`; nothing else. A test that needs an edit outside Paths: stop and report, never edit. Check: scope, npm test, test:flake, mutation 100 on env.ts and ocr/index.ts, then `/security-review` before boarding. Re-run auth, storage, env acceptance tests. FX2 lands before FX7.

Phase 0. Size S. Deps: A06. Where: cloud.
Tags: security (a stand-in chosen by silence in production).
Paths: src/core/env.ts, src/modules/ocr/index.ts, src/modules/storage/safe.ts, src/modules/storage/files/index.ts, src/modules/storage/drive/index.ts, src/modules/auth/index.ts, src/modules/ocr/engine-setting.test.ts, src/modules/storage/engine-setting.test.ts
Clauses: SEC-11, ARC-6, ARC-20
Read: `reports/A06-findings.md` (RC1, R62), `plan/cards/A01.md`, `plan/cards/A05.md`, `src/core/env.ts` after A06 round 2.
Spec commit: see claude/FX2 spec(FX2) commit; validated on main 7eaf18c

## Goal
A01 reads `OCR_ENGINE ?? 'textlayer'` and A05 its storage engine the same way, straight from process.env, so a go-live deploy that forgets the setting runs the stand-in silently. Both landed, so this card fixes them rather than a later rebuild.

## Spec
1. Both settings are declared in src/core/env.ts with A06's pattern: the stand-in is the default outside production; with NODE_ENV=production and the setting unset, the factory refuses with a message naming the setting.
2. Both directions tested for each (production unset refuses, production set works, development unset uses the stand-in).

## Build
Read the settings through env.ts only; no module reads process.env for an engine.

## Check
A checker who did neither: the card's tests, `npm test`, and R62 (SC3) once it exists.
