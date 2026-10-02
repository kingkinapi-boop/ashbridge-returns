# SC Schema and contract rules

Phase 0. Size M. Deps: F01, F09, F09B (F09A split, A349), F05M. Where: local or cloud.
Tags: core (permissions and citations: the rules keep every later table and box honest).
Paths: tools/test/schema-contract-rules.test.mjs, src/contracts/schema-rules.db.test.ts, tools/test/__fixtures__/schema-contract/**
Clauses: SEC-7, EV-1, ARC-10, EV-5, EV-8, EV-10, FLOW-1, ARC-15
Read: `reports/findings-F01-F09.md` (rule tests R12 to R18, risks), `reports/findings-F09-r2.md` ("Rule tests": its R19 to R21, numbered R26 to R28 here), `reports/findings-wave2.md` (fix 8: R23 to R25; fix 1g: the renumbering), `plan/cards/F01.md`, `plan/cards/F09.md`, `plan/cards/F09A.md`, blueprint 03 (EV-1, EV-5, EV-8, EV-10), 02 (FLOW-1), 08 (SEC-7), 09 (ARC-10, ARC-15), `.claude/rules/testing.md`, `tools/test/db-rules.test.mjs` (the pattern).
Spec commit: 0cc0b2b (validated on main bc97984; 65 rule tests; on main the 10 that need F01 fail by name "nothing to check"; R35 not covered)

## Goal
The faults the F01 and F09 checks found (RC1 to RC5) can come back in every table and contract later cards add. SC turns each into a rule that runs over every table in schema `returns` and every file under `src/contracts` and `src/modules`, so the next card that forgets a TRUNCATE trigger, a non-blank check or the one Box shape fails on main, not at a check.

## Who does what
- The spec job writes R12 to R18 and R23 to R28, each first failing on a planted bad example under `tools/test/__fixtures__/schema-contract/`, and validates on main (spec-writer step 6). Database rules (R12 to R15) live in `src/contracts/schema-rules.db.test.ts` (the `db` project) and read the catalog of a template built with `createTemplate` from the real schema folder through the `db` project's clone, never by naming `db/schema` (TH rule R4); planted bad tables are created in the test's own clone. File rules (R15's list side, R16 to R18, R23 to R28) live in `tools/test/schema-contract-rules.test.mjs` (the `unit` project).
- This card is rules only. A rule that fails on main as it stands is a defect of the card that owns that file; it is added to that card, never fixed here.

## Acceptance checks
1. SEC-7, EV-1 (R12): every table in schema `returns` with an UPDATE or DELETE refusal also refuses TRUNCATE. Planted: a table with update and delete triggers and no truncate trigger.
2. EV-1, FLOW-1 (R13): every column named actor, author, reason, approved_by, holder or `*_by` refuses '' and '  '. Planted: a reason column with no non-blank check.
3. ARC-10 (R14): every version_stamp column refuses `{}`, `{"x":null}` and `{"x":""}`, and every zod VersionStampSchema refuses the same three. Planted: a stamp check that accepts `{"x":null}`.
4. EV-8, EV-10, FLOW-1 (R15): every column named state, `*_state`, status, origin or entry_type has a CHECK whose list equals the matching list in `src/contracts/records.ts`. Planted: a status CHECK with one value missing.
5. FLOW-1 (R16): no `order by ... created_at` or `order by ... id` in `db/schema` or `src/modules` unless an identity seq comes first. Planted: a view ordering state events by created_at then id.
6. EV-5 (R17): one box shape: no zod object with x0, y0, x1, y1 in `src/contracts`, and every box field uses F09's BoxSchema. Planted: a contract with its own `{x0,y0,x1,y1}` box.
7. ARC-15 (R18): every core file under `src/contracts` and `src/modules` carries `// @mutate` in its first 5 lines. A file is core when a card whose `Tags:` line starts with `core` lists it in its `Paths:` line (globs expanded, test files left out); `plan/slices.json` is not the source. Planted: a core card's file without the marker fails; the same unmarked file under a non-core card passes.
8. EV-6 (R26, was R19; findings F09 round 2): no money function returns -0. Every exported function under `src/contracts` and `src/modules` whose JSDoc carries `@money` (the owning card adds the tag; F01, F09, F09A and A07 are the first) is run by a property (fast-check, fixed seed) with an argument generator from a registry in the test file, and no result (or cents field of a result) is -0 by `Object.is`. A `@money` export missing from the registry fails, and so does a registry entry whose export lacks the tag (so the tag set is never silently empty; F09A's `normaliseAmount` is the first entry). Planted: a `@money` function that returns `-0` for "(0.00)".
9. EV-5 (R27, was R20): every contract converter refuses non-finite numbers. Every exported function under `src/contracts` whose JSDoc carries `@converter` is called with NaN, Infinity and -Infinity in each numeric field in turn, and each call throws RangeError (never a ZodError, never a value); F09's two converters (points and pixels) are named in the test and must carry the tag. Planted: a converter that passes NaN through to a schema.
10. ARC-8, EV-6 (R28, was R21): one amount-format table. No file under `src`, `testworld` or `e2e` other than `src/contracts/amount-grammar.ts` defines an amount pattern or format list (a regex literal or string holding a thousands-group or two-decimal amount pattern, or an exported list of amount formats); W20's renderer and A07's reader import F09A's `AMOUNT_FORMATS`. Planted: a renderer file with its own format list and its own amount regex.
10a. EV-5, AI-1 (R23, findings wave 2 RC2): every exported zod schema in `src/contracts` (`env.ts` excluded: it stays non-strict on purpose) refuses a stray key at every depth at runtime (the rule walks each schema's objects and parses a valid sample with one extra key at each). Planted: a contract whose nested object uses plain `z.object`. Known owners on main when it lands: `checks.ts` (CheckRecordSchema, ReconcilingItemSchema, CheckExceptionSchema) go to their owner's next round; reading.ts is F09A's, storage's Index its owner's.
10b. RT-3, ARC-14 (R24, RC3): every exported function whose JSDoc carries `@writes <reader>` passes a fixed-seed fast-check read-back property: what it writes, read by the named reader, gives back what it was given, with extreme generators (Number.MAX_SAFE_INTEGER, 1e21, 0, -0, long decimals, text with quotes and apostrophes). A `@writes` export missing from the test's generator registry fails. Planted: a writer that prints `1e+21`.
10c. RT-13, RT-23 (R25, RC4): no product `.ts` file under `src` (test files, `__fixtures__/` and `__golden__/` excluded) other than `src/contracts/taxprep.ts` holds a literal list of `IDENT.` or `IFirm.` cell identifiers, or a Taxprep description string from the day 2 exports. Planted: a simulator file with its own list of the eight creation cells.
11. On main with F01, F09 and F09A landed: `npm run typecheck`, `npm run lint`, `npm test`, the `db` project and `npm run test:flake` (5 of 5) pass.

## Not in this card
Fixing any schema or contract file (the owning card does it). Seeding helpers that reach later states through events (W00, JH0). Rules for other kinds of record beyond R12 to R18 and R23 to R28 (R19 to R22 are DG's). Adding the `@money`, `@converter` and `@writes` tags (the owning cards; F03R tags the Taxprep CSV writer first).

## Also (F03R findings, 2 Oct)
R29 a refusal ratchet per parser (taxprep, reading, amount-grammar): a golden file of refused inputs stays refused unless a retire list names it (plant: delete a parser branch). R30 every `@writes` module exports its read-back check and a test plants a mismatch (extends R24; plant: a check that always returns true). R31 no two exported finding lists share an entry or a finding string, and each list's findings carry that list's anchor (plant: a spread).

## From F03R round 3 check notes (2 Oct)
- R32 candidate: the B1 apostrophe rule is total over number-like text: `+1'234`, `(1'234)`, ` 1'234`, `1'234 `, `1'234e3`, `--'12`, `1’234` either read as a number per RT-3 or raise a named fault, never pass as plain text silently.
- R33 candidate: read-back of rates compares exact text against `toFixed(4)`, not `Number()`.

## From findings W00 round 1 (2 Oct, reports/findings-W00-r1.md)
- R34 SEC-11 repo scan (sample clients, testworld, fixtures, goldens): Luhn-valid nine digits (spaced, hyphenated, RT suffix), e-mails outside reserved domains, phones outside 555-01xx are refused; planted one of each.
- R35 every exported model or kind check has a planted failing test; a check over an empty collection says "nothing to check" unless declared.
- R36 money read from text only: no `dollarsToCents(number)`, no `x*100` from JSON numbers.
- R37 (was TH R5) byte-compared files are `-text` or `binary` and `git ls-files --eol` agrees; planted CRLF CSV under `eol=lf`.
- R38 (was TH R6) no test builds expected bytes with a non-UTF-8 TextDecoder or TextEncoder; setup fails below Node 24.
- R39 (F09B check note, 2 Oct): any geometry predicate over words sees one page only; planted: `amountGroups` over "1" on page 1 and "234.56" on page 2 must not join (callers other than `valueInBox` pass words from one page, or `amountGroups` splits by page).
- R40 (F09B check note): a word made only of invisible characters (Cf, Cc, U+034F, U+3164, U+2800, whitespace) is blank everywhere WordSchema is used.

## From findings F01 round 2 (2 Oct, reports/findings-F01-r2.md)
- R13 rewritten: catalog-driven non-blank over every text column of schema returns outside the value allow-list (kept in src/contracts/text.ts with reasons), using the F01 blank sample set; planted a `btrim` check that accepts a tab, and a column with no check.
- R41 one blank definition: no `btrim(`, `trim(`, `[[:space:]]` or `\s` in db/schema checks; no `.trim()` or `min(1)` non-blank rule in src/contracts or src/modules; non-blank goes through text.ts. Absorbs R40.
- R42 SQL and zod parity field by field, both ways; planted a `z.string()` field over a non-blank column.
- R43 every return_id, and every `*_id` whose target table exists, is a foreign key; pointer ids to unbuilt tables are non-blank and the allow-list names the future card.
- R44 every identity column refuses OVERRIDING SYSTEM VALUE; every `version_no` or `*_version` column refuses a gap or a jump.
- R45 (E03 check note, 2 Oct): the sensitive-key name rule (facts.ts:45-51) is table-driven and covers bank transit, institution and account numbers, date of birth, SIN, business number and similar; planted keys `bank_transit`, `institution_no`, `dob` must be sensitive. The loader enforces each key's cite pattern and refuses duplicate enum options.

## From findings A07 round 1 (2 Oct, reports/findings-A07-r1.md)
- R46 no module turns a library value into text through `.text`, `String(x)` or a template without a typed switch; planted `cell.text`.
- R47 every ARC-11 cache key covers every input its result depends on and the cache returns a copy; run on each reader adapter (A01, A02, A03, A07, B04): same bytes under two names or options, then mutate a returned result and read again.
- R48 every reader whose contract says "hidden" or "never dropped" is tested with an empty instance (empty hidden row or column, blank page).
- R49 no `z.string().trim()` transform in src/contracts (joins R41).

## From findings W00 round 2 (2 Oct, reports/findings-W00-r2.md)
- R34 widened: the repo scan calls W00b's `guardFolder` (one definition) over sample-clients, testworld, every `__fixtures__` and `__golden__`; binary fixtures only on a reasoned list (A01 PDFs); planted a SIN as a JSON number, a mixed-separator SIN, a .txt file.
- R50 one Luhn: none outside guard.ts and reference/sample-clients/lib/util.mjs, and a property test proves the two agree on every nine-digit shape.
- R51 every loader is guarded: every module in testworld/** and e2e/_harness that reads data files goes through `guardFolder` or `guardValue`.
- R52 markers: every fault-marker field in any answer key or kind has a catalogue entry and the arithmetic proof holds.
- R53 sequences (joins R44): every month or version sequence is complete and each closing links to the next opening.
- R54 (A07 round 2 check): every reader refuses a wrong-kind container with a reason and never throws (A01, A07, E00 intake); no reason carries a library message or URL; number-to-text rules are tested with large-magnitude noise.
- R55 (F01D check, A367 landing rule): every finiteness bound shared by SQL and JS is tested at the double's round-up midpoint (1.797693134862315807937e308), not only at 1e400; 1e-400 and integers above 2^53 in stamps are refused or read back unchanged, the same in SQL and JS.
