# FX7 Rule defects in landed contracts and readers (found by SC)

**Lead directive, 3 Oct 20:17Z (A520): spec patch for the 7 gaps of FX7's Opus spec review (GAPS), then a second Opus spec review, then the build.** The review report stays on the laptop, so this is the whole brief, copied from it. The spec job also rewrites reports/FX7-spec.md (it still describes the pre-A511 state).
1. **Blank is tested by nine characters, not by class.** The facts and reading tests draw only from space, tab, U+00A0, U+3000 and five "past trim" characters. Fix: generate blank strings from `BLANK_RANGES` (exported by src/contracts/text.ts) for every field (label, repeating.rowKey, cite ref, enum option, engine name and version, documentFingerprint), and add the control that a visible character between blanks (`'​x　'`) loads and is kept exactly. Plant: `s.trim() === '' || /^[​⠀ㅤ͏­]*$/.test(s)` passes today; U+180E, U+FEFF, U+2060, U+E0001 must refuse it.
2. **cra_form: no Unicode or NFKC near miss.** fast-check 4.10's `fc.string()` is ASCII only, so the property never meets a non-ASCII digit or space. Fix: add to the planted list 'Schedule １２５ line 9999', 'T２ line 061', 'Schedule 125 line 9999', 'Schedule 125\tline 9999', 'T2 line 061​', 'Schedule 125 line ٩٩٩٩'; run the property on `fc.oneof(validRef, oneEditOf(validRef), fc.string({ unit: 'binary' }))` so both answers occur. Plant: `ref.normalize('NFKC')` before the test, or `\p{Nd}` or `\s` in the pattern.
3. **R45 name rule by example, not by class.** Four keys are named; a build that lists those four strings passes. Fix: a table test over stems {bank_transit, transit_number, transit_no, institution_no, institution_number, dob, date_of_birth, birth_date, sin, account_number, card_number} under every prefix the catalogue uses for people and banks (bank.statement, owner.person, shareholder.identity, director.identity, corp.bank, t4.slip with employee_), expecting the kind; and the false-alarm side: every committed key marked "none" stays "none" (business_number included). Plant: `if (['corp.bank.bank_transit', 'corp.bank.transit_number', 'corp.bank.institution_no'].includes(key)) return 'bank_account'`.
4. **The bytes reader sizes its buffer from the cap.** readRegularFile does `Buffer.alloc(maxBytes + 1)`; with STORAGE_MAX_BYTES every index.json and every PDF read zero-fills 64 MiB (listFolder: one per file), and the tests pin that cap on both reads. Fix: a test that a 10-byte file read with `maxBytes = 2 ** 40` returns its 10 bytes (both forms, since the text form is the bytes form decoded), and that a negative, fractional or NaN cap throws. Plant: the text form's body copied as is (Buffer.alloc(2 ** 40 + 1) throws).
5. **Links: one case only.** Only a symlink to a regular file is planted (Linux). Fix: add a dangling symlink (not-a-file, never gone), a symlink to a directory, and a symlink to a FIFO, all never opened. Plant: an `fs.existsSync(file)` guard first (follows the link and answers gone for the dangling one).
6. **A508: the clean read with a failing destroy is untested.** A build that swallows every destroy error (`await task.destroy().catch(() => undefined)`) passes all four tests and hides a cleanup failure. Fix (amber, SC11's settleAll: no earlier error, so the cleanup error is primary): a good read whose destroy rejects rejects with DESTROY_ERROR (itself or as cause), stores nothing, and the next read parses again (`parseCount()` 2). Plant: the swallowing build above.
7. **R54: zero size only at the origin.** All planted boxes start at 0 0. Fix: add [72 72 72 864] and [0 792 612 792] (zero width or height away from the origin); control [612 792 0 0] (an inverted Letter box) still reads. Plant: `box[2] === 0 || box[3] === 0` on the raw MediaBox.
Lead rulings on the review's notes:
- Stale rows on unlanded branches (SC5's four drive rows: R73, R73-run, R101-json, R101-run; SC12's three R94 rows): whichever card lands second deletes them, as in A514. FX7's build keeps the drive Index shape unchanged, so SC5's rows stay true until then.
- Mutation: the five files the spec marks `// @mutate` reach 100 (testing.md); the Check names the run.
- R41 flags any `.trim()`: the accepted form for a normaliser that is not a blank rule is a named helper exported from src/contracts/text.ts (spec item: a test names the helper and R41 accepts only it); the build moves `lex` in amount-grammar.ts and `collapse` in reading.ts onto it.

**Lead rulings, 3 Oct 19:05Z (A511), from FX7's spec report:** (1) business numbers are not sensitive: SEC-4 does not list them and the catalogue marks the key "none", so the spec job drops `corp.identity.business_number` from R45's list in tools/test/schema-contract-rules.test.mjs and its KNOWN entry goes. (2) One reader: src/core/safe-read.ts gains a bytes form beside readRegularFile (regular files only, capped, binary safe) and the Drive stand-in reads PDFs through it; no second reader inside storage. The spec job adds the bytes-form tests; then an Opus spec review (core) before the build.

Phase 0. Size M. Deps: SC, W00c, FX2, CQ6. Where: cloud.
Tags: core (contracts every figure and citation passes through).
Paths: src/contracts/facts.ts, src/contracts/reading.ts, src/contracts/amount-grammar.ts, src/modules/ocr/textlayer/**, src/modules/storage/**, src/core/test-no-network.ts, src/contracts/auth.ts, tools/test/__fixtures__/planted-interpolated-log.ts.txt, tools/test/__fixtures__/schema-contract/known.json, src/core/safe-read.ts, tools/test/schema-contract-rules.test.mjs, src/contracts/text.ts (A511, A520)
Harness: src/core/test-no-network.ts
Clauses: EV-1, EV-5, ARC-10, ARC-15, SEC-11
Read: `reports/SC-findings.md` (fix list step 3: the FX7 entries), `plan/cards/SC.md`, `src/contracts/text.ts` (the one blank rule).
Spec commit: c12b1b12 (A511 patch; first spec 72aa3482), validated on main a677d7fe

## Goal
SC lands with exact KNOWN entries whose files belong to cards already done (F09, F09A/B, A01, A05, E03): R23 facts.ts; R41 reading.ts, facts.ts, amount-grammar.ts; R45 enum and cite keys; R38 the Node 24 setup check; R39 amountGroups; R49 reading.ts; R34 the A05 log plant; R54 the A01 MediaBox. This card fixes each at its source and deletes its KNOWN entry, so the rule then holds on main.

## Spec
None new: SC's rules are the tests. The spec job lists the FX7 entries from SC's KNOWN on main and confirms each fails for that reason only.

## Build
Fix each defect at its source; never weaken a rule or widen KNOWN (A329). A defect whose file belongs to an open card goes to that card instead (W00c owns the sample-client CSVs).

## Check
A checker who did neither: SC's rules green with no FX7 entry in KNOWN, `npm test`, an Opus read of the contract changes. Mutation 100 on every `@mutate` file the card changes; the Linux-only FIFO and link cases run, not skip (A520).

## Also (A446, reports/A04-findings-5.md RC1)
The drive stand-in (storage/drive) reads through `readRegularFile` with a size cap and a regular-file check; the files store gains the size cap. R94's KNOWN entries for storage/drive and storage/files are owned by FX7.

## SC12 KNOWN entries (A488, 3 Oct)
SC12 (when it lands) lists R93, R94 or R104 KNOWN entries this card owns in tools/test/fs-rules.test.mjs (R93 and R94: src/modules/storage/files/index.ts and src/modules/storage/drive/index.ts; R104: the `store` Map in src/modules/ocr/textlayer/index.ts). The build fixes them (a guarded read or write; a cap from data or a reasoned `// R104 bounded: <reason>` marker); the spec of that round deletes the entries, with that file added to Paths then. If this card lands first, SC12 re-homes them (A488).

## Also (A508)
src/modules/ocr/textlayer/index.ts:108-110: `finally { await task.destroy() }` masks a reading error in flight; keep the first error primary (SC11's settleAll pattern) and delete SC12's KNOWN entry for it if one is on main.

## SC5 KNOWN entries (A514)
SC5 leaves R73 and R73-run entries (Index strict) and R101-json and R101-run key scans on src/modules/storage/drive/index.ts owned by this card: its build fixes each and deletes its entry. If this card lands before SC5, SC5's spec re-homes them.
