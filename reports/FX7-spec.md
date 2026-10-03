# FX7 spec (3 Oct 2026, A520 patch)

- Branch claude/FX7. Spec commits: 72aa3482 (acceptance tests), c12b1b12 (A511 patch), and the A520 patch (`spec(FX7): A520 patch`; hash on the card's Spec commit line). Validated on main b151c592: typecheck and lint clean; unit 88 failures, all FX7's own (listed below); db 698 passed, 1 expected fail, 5 skipped (none FX7's).
- Clauses: EV-1, EV-5, EV-6, ARC-6, ARC-10, ARC-15, ARC-22, SEC-4, SEC-11, RT-9.

## The tests now (94 in six files, plus SC's rules)

| File | Tests | Fail before the build |
|---|---|---|
| src/contracts/fx7-contracts.acceptance.test.ts | 38 | 30 |
| src/core/safe-read-bytes.acceptance.test.ts | 23 | 23 |
| src/modules/storage/size-cap.acceptance.test.ts | 15 | 14 |
| src/modules/ocr/textlayer/zero-page.acceptance.test.ts | 8 | 5 |
| src/modules/ocr/textlayer/destroy-error.acceptance.test.ts | 5 | 2 |
| tools/test/fx7.acceptance.test.mjs | 5 | 2 |
| tools/test/schema-contract-rules.test.mjs (SC's rules) | 12 FX7 rows | 12 |

The rules file fails by its exact strings until the build fixes each source: R18, R23, R34, R38, R39, R41 (two), R45 (three), R49, R54. known.json holds no FX7 entry (the card's check; A511 dropped corp.identity.business_number from R45's list). The passing tests are controls (a clean value loads, an inverted Letter box reads, a good read destroys once, the committed catalogue holds) and guards that must keep holding after the build.

## The A520 patch (the seven gaps of the Opus spec review, and R41's helper)

1. Blank by class: strings drawn from BLANK_RANGES (each range equally likely), every range's ends and middle, and U+180E, U+FEFF, U+2060, U+E0001 are refused in all seven fields (label, repeating.rowKey, cite ref, enum option, engine name, engine version, documentFingerprint); the control `U+200B x U+3000`, and any visible character between blank runs, is accepted and kept exactly.
2. cra_form: eight Unicode and NFKC near misses added to the planted list; the property runs on valid refs, one-edit near misses and binary strings and asserts both answers occur (more than 50 each).
3. R45 by class: 11 stems under 6 people and bank prefixes (66 keys, T4 slips as `employee_`), each with its kind, each refused by the loader when marked none; every committed "none" key stays "none" and every committed sensitive key keeps its kind (business numbers none).
4. The bytes reader never sizes its buffer from the cap: a 10-byte file under a cap of 2 ** 40 reads in both forms; a negative, fractional or NaN cap throws in both forms with no descriptor left open.
5. Links: a dangling symlink (not-a-file, never gone), a symlink to a folder and a symlink to a FIFO are refused in both forms and never opened. They run on Linux (skipped only on win32; the Check confirms they ran).
6. A508: a good read whose destroy rejects rejects with the destroy error (itself or as cause), stores nothing, and the next read parses again (parseCount 2). This passes on main today (main's finally rethrows); it is a guard against the swallowing build.
7. R54 away from the origin: [72 72 72 864] and [0 792 612 792] are refused; the control [612 792 0 0] reads as a 612 by 792 page with its words.
8. R41's helper: `trimWhitespace` exported from src/contracts/text.ts, exactly String.prototype.trim (examples and a property); R41 now also flags trimStart, trimEnd, trimLeft and trimRight, accepts a call to the helper, and flags a local copy of it; amount-grammar.ts and reading.ts import it from './text' and call it, with a behaviour twin (a padded amount word and a padded text value still match).

## Step 6b (stub sweep, unit and db)

A throwaway stub of every A520 item (plus the blank, cra_form and sensitive-key items) passed all the new tests; the whole unit and db suites then failed only on FX7's own unstubbed items. No test retired or rewritten in this patch. The earlier rounds' rewrites stand (fact-catalogue.ts:61 fixture ref, facts.test.ts:216, facts.acceptance.test.ts:639, by R45-cite).

## Choices (amber)

- The helper's name is `trimWhitespace` and it is String.prototype.trim exactly (not a blank rule: U+200B stays).
- A bad cap throws any Error (the message is not pinned); R45 reasons are matched by the kind as a whole word after the key.
- Earlier rounds' choices stand: STORAGE_MAX_BYTES = 64 MiB from src/modules/storage, one cap for both adapters; refusal words "refused: ... not a plain file" and "... too big" with the cap; transit and institution numbers are bank_account, dob is birth_date; a stray key is refused at every depth (a cite's `note` is allowed); cra_form is `Schedule \d{1,3} line \d{3,4}` or `T2 line \d{3}`, ASCII only; the engine stamp is kept exactly; a zero-size page anywhere refuses the whole PDF; the Node floor is in test-no-network.ts; the A508 rule takes the first error itself or as `cause`.
- Stale rows on unlanded branches (SC5's drive rows, SC12's R94 rows): whichever card lands second deletes them (A520 ruling); FX7's build keeps the drive Index shape.
