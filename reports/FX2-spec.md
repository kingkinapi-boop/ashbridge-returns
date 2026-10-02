# FX2 spec: released (cloud-4b7764, 2 Oct 2026)

Not started. The card says to follow "A06's pattern" in `src/core/env.ts` after A06 round 2. Neither main nor the claude/A06 build has it: main's env.ts has only NODE_ENV, and claude/A06's env.ts has an optional AUTH_ENGINE with no production refusal (round 2 is still being specced and built; its 8 new tests cover the production engine refusal). A spec written now would pin a pattern that does not exist, and A06 round 2 may change it.

Also: src/modules/storage/index.ts has no engine setting at all (only OCR_ENGINE in src/modules/ocr/index.ts:20 uses `?? 'textlayer'`); the card should name where A05's engine setting lives.

Re-offer after A06 round 2 is built and landed. Model: Sonnet 5.5.
Permission gaps: none.
