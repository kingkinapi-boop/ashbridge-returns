# A01 build round 2 (cloud-ff757e)
Branch claude/A01, merged with main (F09A strict schemas, DG round 3 readOwnSource). Files: src/modules/ocr/index.ts (passes options through), src/modules/ocr/textlayer/index.ts (two reasoned Stryker disables), new unit tests textlayer.geometry.test.ts (45, 135, 180 degree and blank pages, adapter tempDir), textlayer.destroy.test.ts (library task destroyed on read and on refusal), adapter.test.ts (moved from src/modules/ocr/index.test.ts, which was outside the card's paths).
Acceptance: 31 of 31 pass on the strict schemas, no spec edit by the builder (the only diff since dce0009 is the spec worker's readOwnSource refit). Full suite 1201 unit + 2 db pass. typecheck, lint, deps:check clean; scope OK; npm audit --audit-level=high exit 0.
Mutation (mutate:changed A01): 100.00 total, 100 per file (textlayer 130 killed, adapter 13 killed), 0 survivors.
Disables (true equivalents): useSystemFonts (fonts only draw; widths come from the PDF); the marked-content type guard (no includeMarkedContent, every item has str); the blank-item skip (pdfjs emits a blank item only between words, so any is already set and no word is made).
Ambers: adapter passes its whole options object to the engine (engine reads only tempDir); word-width amber untouched and not pinned. Reverse: restore the ternary.
Permission gaps: none. Model: Sonnet 5.5. Node: box has 22 and nvm install fails (index unreadable); installed Node 24.21 from nodejs.org tarball to /opt/n24 (needs >=24.11).
Not done: W20 check 1 re-run (W20 not landed).
