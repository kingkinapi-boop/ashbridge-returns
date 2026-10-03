# FX7 Rule defects in landed contracts and readers (found by SC)

**Lead rulings, 3 Oct 19:05Z (A511), from FX7's spec report:** (1) business numbers are not sensitive: SEC-4 does not list them and the catalogue marks the key "none", so the spec job drops `corp.identity.business_number` from R45's list in tools/test/schema-contract-rules.test.mjs and its KNOWN entry goes. (2) One reader: src/core/safe-read.ts gains a bytes form beside readRegularFile (regular files only, capped, binary safe) and the Drive stand-in reads PDFs through it; no second reader inside storage. The spec job adds the bytes-form tests; then an Opus spec review (core) before the build.

Phase 0. Size M. Deps: SC, W00c, FX2, CQ6. Where: cloud.
Tags: core (contracts every figure and citation passes through).
Paths: src/contracts/facts.ts, src/contracts/reading.ts, src/contracts/amount-grammar.ts, src/modules/ocr/textlayer/**, src/modules/storage/**, src/core/test-no-network.ts, src/contracts/auth.ts, tools/test/__fixtures__/planted-interpolated-log.ts.txt, tools/test/__fixtures__/schema-contract/known.json, src/core/safe-read.ts, tools/test/schema-contract-rules.test.mjs (A511)
Harness: src/core/test-no-network.ts
Clauses: EV-1, EV-5, ARC-10, ARC-15, SEC-11
Read: `reports/SC-findings.md` (fix list step 3: the FX7 entries), `plan/cards/SC.md`, `src/contracts/text.ts` (the one blank rule).
Spec commit: (spec-writer fills)

## Goal
SC lands with exact KNOWN entries whose files belong to cards already done (F09, F09A/B, A01, A05, E03): R23 facts.ts; R41 reading.ts, facts.ts, amount-grammar.ts; R45 enum and cite keys; R38 the Node 24 setup check; R39 amountGroups; R49 reading.ts; R34 the A05 log plant; R54 the A01 MediaBox. This card fixes each at its source and deletes its KNOWN entry, so the rule then holds on main.

## Spec
None new: SC's rules are the tests. The spec job lists the FX7 entries from SC's KNOWN on main and confirms each fails for that reason only.

## Build
Fix each defect at its source; never weaken a rule or widen KNOWN (A329). A defect whose file belongs to an open card goes to that card instead (W00c owns the sample-client CSVs).

## Check
A checker who did neither: SC's rules green with no FX7 entry in KNOWN, `npm test`, an Opus read of the contract changes.

## Also (A446, reports/A04-findings-5.md RC1)
The drive stand-in (storage/drive) reads through `readRegularFile` with a size cap and a regular-file check; the files store gains the size cap. R94's KNOWN entries for storage/drive and storage/files are owned by FX7.

## SC12 KNOWN entries (A488, 3 Oct)
SC12 (when it lands) lists R93, R94 or R104 KNOWN entries this card owns in tools/test/fs-rules.test.mjs (R93 and R94: src/modules/storage/files/index.ts and src/modules/storage/drive/index.ts; R104: the `store` Map in src/modules/ocr/textlayer/index.ts). The build fixes them (a guarded read or write; a cap from data or a reasoned `// R104 bounded: <reason>` marker); the spec of that round deletes the entries, with that file added to Paths then. If this card lands first, SC12 re-homes them (A488).

## Also (A508)
src/modules/ocr/textlayer/index.ts:108-110: `finally { await task.destroy() }` masks a reading error in flight; keep the first error primary (SC11's settleAll pattern) and delete SC12's KNOWN entry for it if one is on main.
