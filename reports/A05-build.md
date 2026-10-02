# A05 build: reported
Worker cloud-45ec67. Branch claude/A05 (merged with main).
Files: src/contracts/storage.ts; src/modules/storage/{index.ts,safe.ts,files/index.ts,drive/index.ts,storage.test.ts}.
Acceptance: 27 of 27 pass (plus 1 own test); typecheck, lint, deps:check, scope clean; full suite 119 pass.
Ambers: (1) settings are read in `src/modules/storage/safe.ts` with the four setting names, not through `src/core/env.ts` (outside the card's paths; its schema holds only NODE_ENV). The Lead may move them into env.ts. (2) File ids and keys: refuse "\\", leading "/", drive letter, null, ".." segments; keys must be `sha256/<2 hex>/<64 hex>`. (3) Stored files are mode 0444, temp file `.tmp-<uuid>` in the key folder, removed if the write fails. (4) Settings log only when a `sink` is given, by name only. (5) Drive: an index entry is listed only when its folder is exactly the corporation's folder; SEC-11 tests the first path segment for "(Test)" on getFile and the legal name on listFolder. Reverse: edit the module.
Not done: `/security-review` (the card is marked security; the checker runs it).
Permission gaps: none. Cloud image has Node 22 only (Node 24 fetched from nodejs.org; /opt/nvm does not exist). Model: Sonnet 5.5.
