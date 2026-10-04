# A08 build, round 3 re-run (BLOCKED: mutation 96.08)
Worker cloud-c37c7e (Sonnet). Branch claude/A08 at the round 3 build f01217d9, main merged in (af3ea848). No source change this run: the build already holds B1 to B6, G2, G5, G8.
Numbers (Node 24.21, Linux): 4 unit files 381 passed, 2 skipped. Cloud `mutate:changed -- A08 -- --force` (full run, no timeout): overall 96.08; env.ts 100; call.ts 98.25; index.ts 95.19; scan.ts 97.02. 19 survived, 8 no coverage.
Survivors (tests are spec-owned, so not edited; needs a findings review, then a spec patch or Lead rulings):
- call.ts:55 `e.code ?? 'error'` literal, no coverage.
- index.ts: 52, 55, 59, 60 (vendor names ANTHROPIC, OPENAI, GEMINI, GOOGLE API_KEY blanked: no row names each); 90 `existsSync` guard; 109 realNative equality (the `true` mutant); 110, 111 catch returns false (no coverage); 117 `'utf8'` in the approved read; 121 `triples: []` fallback; 190 issue-path join text; 234 and 353 `force: false` on rmSync; 266 `value !== undefined` (an undefined child value row); 282, 297 refusal text and guard; 293 `'utf8'` of the catalogue read; 294, 295 unreadable orders/settings/catalogue row.
- scan.ts: 21 BANK_SHAPE flag `'u'`; 37 Luhn `sum -=` (a row where the sign matters); 47 `?? ''`; 62 array walk in the marker scan; 68 `typeof fact === 'string'`.
Not run: pg16, Windows rows (G4, G5), security review.
Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
