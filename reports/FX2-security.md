# FX2 security review, 3 Oct 2026, Opus 5.5

FINDINGS (one, low). Branch claude/FX2 at 97df89eb; diff `origin/main...origin/claude/FX2` read in full, with env.ts, ocr/index.ts, storage/safe.ts and auth/index.ts read whole on the branch.

## Finding

1. **src/modules/ocr/index.ts:34** (low; SEC-10). The mistyped-engine error prints the setting's value: `reading engine "${engine}" is not available yet`. In production a mistyped OCR_ENGINE (or a key pasted into the wrong setting) lands in the error, and from there in logs. The storage twin (safe.ts:52) and env.ts:24 name the setting only. Pre-existing from A01, but the line sits in a file in this card's Paths. Fix, one line: `throw new Error('OCR_ENGINE names a reading engine that is not available yet')`, plus a planted-value test (OCR_ENGINE set to a planted string, message must not contain it), through a spec job. It fails closed, so it does not let a stand-in start; it is a leak, not a bypass.

## Checked and clean

- Production with the setting unset: auth (auth/index.ts:19), OCR (ocr/index.ts:21) and both storage stand-ins (safe.ts:48, reached from files/index.ts:21 and drive/index.ts:29) throw, naming the setting. Blank reads as unset (env.ts:6 and 11).
- Mistyped value: OCR falls to the switch default and throws; storage throws "must be local or live"; AUTH_ENGINE is a zod enum and throws "Invalid settings: AUTH_ENGINE". A whitespace value is not blank and also throws. No path starts a stand-in.
- Mistyped setting name (for example OCR_ENGIN): the real name stays unset, so production refuses.
- Mistyped NODE_ENV (for example `prod`, `Production`): the zod enum rejects it and readSettings throws naming NODE_ENV only. Fails closed.
- process.env: the only read in src outside tests is env.ts:20 (the readSettings default). The three `?? process.env` fallbacks in auth, files and drive are gone.
- No secret, key or real data in the diff; the planted values in tests are made up and marked (Test).
- No guard or permission check weakened: the change only adds refusals. The engine-setting tests keep the process.env scan and read source through readOwnSource; nothing is unmarked @mutate or excluded.

## Notes for the Lead (not findings against this card)

- NODE_ENV unset on a production host defaults to `development` (env.ts:9), so every stand-in (auth included, A06's pattern) starts silently. The card defines production as NODE_ENV=production, so this is outside FX2; a go-live check that NODE_ENV is set belongs with GL1.
- ocr/index.ts:39 and 41 and storage/index.ts:2 and 3 export the stand-in constructors themselves. The storage ones still pass through readEngine; createTextLayerEngine and createRecordedEngine do not. No caller outside tests uses them today; a later card that wires OCR should go through createReadingAdapter.
