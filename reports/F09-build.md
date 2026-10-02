# F09 build round 2 (cloud-e1c409)

Branch claude/F09; head: see `git log -1 claude/F09` (this report is in the same push).
Files changed: src/contracts/reading.ts only (spec file untouched; scope OK).
Acceptance: 53 of 53 pass in reading.acceptance.test.ts (18 round-2 tests were red before). Typecheck, lint on reading.ts, `npm test` (217), `test:flake` 5 of 5 clean. Stryker on reading.ts: 76.49 (break 70).
Built: maximal amount groups (same line, joined only across "$", sign words, ".dd", ",ddd", space-separated three-digit group; whole-group match); text joins with one space; leading-zero refusal; "$-", "-$", "$(" signs; BoxSchema overflow refusal; converters throw on off-page or zero-size rect or page (no clamp, float-noise snap only); page list exactly 1..pageCount; "box on another page" for page < 1 or > pageCount; `// @mutate`.
Ambers: (1) float tolerance 1e-9 in BoxSchema and converters so round-trips at the page edge pass; reverse by setting EPS to 0. (2) Text values compared only when the value is not an amount, so "001234" as a value falls to text compare.
Not done: re-check (another worker); A02 Tesseract splits may drop (join is lexical) per the findings risks.

## Permission gaps
None. Needed Node 24 via `nvm install 24` (preinstalled Node 22 fails `npm ci`).

## Model
Sonnet 5.5, no subagents (F09 core build; adversarial read is the checker's).
