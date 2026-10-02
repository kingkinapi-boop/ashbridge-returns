# A01 check (cloud-20e77a, 2 Oct 2026)

FAIL (one finding). Everything else in the definition of done passed.

## Passed
- typecheck, lint, deps:check clean; `npm test` 1201 unit + 2 db pass; `npm audit --audit-level=high` exit 0.
- Spec untouched by the builder: the only change to the spec files since dce0009 is the spec worker's readOwnSource refit (40b4f1e).
- `node tools/scope.mjs A01`: OK. Mutation canary 100; `mutate:changed A01` 100 (143 killed, 0 survived).
- No screens, no security tag. Not run: `npm run e2e` (no journeys on this card), `test:flake` (no database or schema change).

## Failure
1. `src/modules/ocr/textlayer/index.ts:71` drops blank items with `item.str.trim() === ''`. F09's WordSchema (`src/contracts/reading.ts:29`) also strips NEL (U+0085) and Cf format characters before testing for blank. A page whose only text is such an item passes `trim()`, becomes a word, and the parse at index.ts:98 throws a raw ZodError ("word text must not be blank", path words.0.text). Expected: a "no text layer" page, or a refusal with a reason. This is the "drop blank items before building words" fix of build round 2, done in part.
   - The Stryker disable at index.ts:70 says "a blank item makes no word", which is false for NEL; the unit test "a page holding only spaces" (textlayer.geometry.test.ts:66) cannot tell the mutant apart.
   - Shown by: a made-up one-page PDF whose only glyph maps to /uni0085, read with `createTextLayerEngine().read`. U+200B and U+2060 are stripped by pdfjs, so they come back as no text layer.
   - Rule candidate: every engine builds words with one blank-text predicate exported from `src/contracts/reading.ts`, never its own `trim()`. A rule test feeds each engine a page holding only NEL or Cf text and expects "no text layer", not a throw.

## For the findings reviewer (not failures)
- `index.ts:120` trusts the fingerprint the caller passes and does not check it against the bytes.
- The store lives in one engine instance and `createReadingAdapter` (`src/modules/ocr/index.ts:20`) makes a new engine per call, so reads through two adapters parse the same bytes twice (ARC-11 holds only per engine).

## Permission gaps
None. Box has Node 22 and `nvm install 24` fails; Node 24.21.0 installed from the nodejs.org tarball to /opt/n24.

## Model
Sonnet 5.5; adversarial read by an Opus subagent.
