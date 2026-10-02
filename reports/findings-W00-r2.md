# Findings W00 round 2

Recorded by the Lead from the Opus findings reviewer's returned text (2 Oct 2026). Inputs: reports/W00-check.md and W00-build.md (claude/W00), plan/cards/W00.md through "Round 2", reports/findings-W00-r1.md, findings-F01-r2.md, findings-A07-r1.md, .claude/rules/testing.md; code guard.ts, checks.ts, load.ts, index.ts, kinds.ts, schema.ts and the acceptance test names. Read-only probes on the 15 sample folders in a scratch copy (string keys, roll sequences, markers, source resolution).

Headline: round 2 did what round 1 listed, so the same cause came back. The guard and the checks still refuse only shapes someone listed. Round 3 makes each closed-world: anything unknown is refused, and every test takes its cases from a walk over the data.

## Root causes
**RC1. The SEC-11 guard lets through anything it was not told about** (check findings 1 to 4; build lows L2 to L5). Only JSON string values (numbers and keys never seen: `sin: 130692544`, `1.30692544e8` pass); nine-digit numbers only with one repeated separator from none, space, hyphen (dots, mixed, commas, NBSP, en dash, full-width digits pass; the `(?<![\d.])` lookbehind skips "BN.123..."); names only under six keys, skipped when the object has `key`, `account` or `gifiName`; only .json, .csv, .md (others silently skipped); CSVs scanned as one string. The samples hold 138 distinct string keys; name-like keys not listed: grantor, tenant, payer, holder, books_kept_by; `accounts[].holder` is not a name, so the rule goes by path. Where else: `loadKind` runs no guard (W01 to W13 data never checked; kind.md check 4 assumes it is); W20 needs a value and text entry point; B04 stand-in folders from `testworld/qbo/export.ts` never guarded; JH0 seeders; a second Luhn in `reference/sample-clients/lib/util.mjs:99` used by verify.mjs and W14/W15; SC R34 as written.

**RC2. Checks test each record alone, never how records relate** (findings 5, 6b; L1). Months: no check that the list is complete and ordered, that closing equals next opening, that first opening and last closing equal the account's balances, that every transaction falls in a month, or that every `statementBalances` key is a declared account. Adjusting entry sources never resolved ("nope" passes); `file`/`qboFile` joined without staying inside the client folder. Where else: F01 R44, E01 to E03 ties, W15 prior-year closing to next opening between folders 14 and 15, kind.md check 2, B04 snapshots.

**RC3. Fault markers still change the check's arithmetic** (finding 6a; round 1 RC4 again). `missingFromExport` removes a transaction from the month's activity, so a fudged closing passes; `dupOf` (C10 March) and `priorYear` (C10, 8 rows outside every month) are not compared with the catalogue. Probe: in C10, with `dupOf` rows out and `missingFromExport` rows counted, every CHQ month rolls, so a waiver can be proven with arithmetic.

**RC4 (process). Tests list examples, not classes:** `NAME_FIELDS`, `NUMBER_FIELDS`, `TEXT_FILES` are typed lists (same as F01 r2 RC4 and A07 RC4; second time for W00).

## Card decisions (amber)
- New `testworld/model/guard-fields.ts`: a closed, hand-written table of every JSON leaf path pattern, each classed name, id-number, free-text, code or other; an unclassified path is refused.
- The guard exports `guardFolder(folder)` and `guardValue(obj)`; `loadKind(id, {root})` runs `guardFolder`.
- Catalogue roll entries gain `cause: 'missing' | 'duplicate'`. Two rolls: the statement roll (`dupOf` out, `missingFromExport` in) holds every month with no waiver; the export roll may fail only where the catalogue lists the month, and the cause explains the gap exactly. Every marker needs a catalogue entry (client, account, month, flag).
- kind.md check 4 cites `guardFolder`; W16 and W01 to W13 add `guard-fields.ts` to Paths.
- No check that export row counts equal transaction counts (layouts B and C differ by design: 02, 03, 06, 07, 13, 14, 15).

## Consolidated fix list
Spec (a new worker; each test fails on the head; first a throwaway scan of all 15 folders, failures to the Lead and fixed by the generator):
- S1 Closed world: walk every JSON leaf (keys and values, strings and numbers) in all 15 folders; each path classed in guard-fields.ts; planted `{"nickname":"x"}` refused as unclassified.
- S2 Names by the walk: every name-class value without "(Test)" refused; `{"name":"Jane Doe","key":"x"}` at a name path refused; every declared person's bare name in any text (profile.md, notes, CSV cell) without "(Test)" or TEST refused.
- S3 Numbers (fast-check, fixed seed): any Luhn-valid nine digits refused in every placement (JSON string, JSON number integer and exponent, JSON key, CSV cell quoted with commas, md line) and every shape (per-gap separator from none, space, -, ., /, NBSP, U+2013, comma; prefixes "BN.", "SIN:"; RT0001 suffix; full-width digits). Controls pass: money shapes and Luhn-invalid numbers. Phones: any NANP with any separators, brackets or +1; seven digits with space, dot or hyphen; any `+` international; `4168675309` as a JSON number; all refused unless 555-01xx.
- S4 File types: plant .txt, .tsv, .xml, .pdf, .xlsx, no extension, a dotfile, a nested folder; text kinds scanned; binary or unknown refused "cannot be checked"; invalid UTF-8 refused.
- S5 Month sequences, every account in a temp copy: drop first, middle, last month; duplicate a month; a month outside the year; break closing to next opening; break first opening or last closing; a `statementBalances` key for an undeclared account; each refused naming account and month. Property: removing any one transaction is refused for that month.
- S6 Markers: `missingFromExport` in an unwaived month refused; fudged closing plus `missingFromExport` refused; `dupOf` or `priorYear` with no catalogue entry refused; C10 still loads.
- S7 Relations: a transaction source resolves to a transaction id; an onboarding source resolves to an onboarding.json top-level key or an id in it (C12: FL:96, YE1.vehicle, BQ2.earn); `file` "../x.csv" or absolute refused; a missing file gives a LoadIssue, not ENOENT.
- S8 Kind gate: `loadKind` on a planted temp kind folder with a Luhn-valid SIN (.ts and .json) refused; `guardValue` on a name path without "(Test)" refused.

Build: B1 guard-fields.ts (`// @mutate`). B2 one scanner: NFKC; number tokens are digits joined by single separators from `\p{Zs}\p{Pd}` and `./,`, classed by digit count, money shapes exempt; JSON numbers scanned from source text (reviver `context.source`) and keys scanned; CSVs per cell; a table of text file kinds, anything else refused; linear e-mail match (L5); export `guardFolder`, `guardValue`. B3 checks.ts: S5 to S7 relations, both rolls, markers against the catalogue. B4 faults.ts: `cause` on roll entries; entries for 10-F02 (`dupOf`) and 10-F03 (`priorYear`). B5 kinds.ts `loadKind` takes `{root}` and calls `guardFolder`. B6 mutation 100 on guard, guard-fields, checks, load, faults, kinds; replace line-wide Stryker disables in load.ts; `/security-review` again.

## Rule tests for SC
- R34 widened: the repo scan calls W00's `guardFolder` over sample-clients, testworld, every `__fixtures__` and `__golden__`; binary fixtures only on a reasoned list; planted SIN as a JSON number, a mixed-separator SIN, a .txt file.
- One Luhn: none outside guard.ts and lib/util.mjs; a property test proves the two agree on every nine-digit shape.
- Every loader is guarded: every module in testworld/** and e2e/_harness reading data files goes through `guardFolder` or `guardValue`.
- Markers: every fault-marker field in any answer key or kind has a catalogue entry and the arithmetic proof holds.
- Sequences (joins F01 R44): every month or version sequence is complete and each closing links to the next opening.

## Last-round rule (as proposed)
Narrow failure (only S3's exotic shapes or S8's API details): land W00; those cases go to a follow-up W00G. Any failure in S1, S2, S4, S5, S6 or S7: park W00 and split into W00a (model, loader, money, catalogue, rolls, CRLF CSVs, taxprep-bytes fixture) and W00b (the guard).

## Risks and re-tests
- False positives from the wider scanner (comma money, dates, transaction ids, card numbers): the pre-scan comes first; today no sample has a nine-digit-or-longer integer (C10 probed) and every file is ASCII.
- The closed table breaks generators that add keys (W14, W15, W16, W01 to W13), by intent; class `accounts[].name`, `accounts[].holder`, comma-separated `payer` with care.
- Roll redefinition: all 15 folders are contiguous, link closing to opening and match account balances; re-run clients.acceptance check 4 and C10's waivers.
- S00: round 3 must not touch taxprep/*.csv, .gitattributes or src/contracts/__fixtures__/taxprep-bytes.ts; re-run taxprep.acceptance, taxprep-bytes.acceptance, verify.mjs `make-csv --check`, tools/test/sample-prior-year.test.mjs, F00 money tests, S00 spec validation.
- loadKind change: re-run kinds-faults check 6 ("not built" fails, never skips).
- Scope FAIL on the Lead's plan/cards/W00.md commit 8d44550 is a tool-scope matter (amber).
- Re-check: typecheck, lint, `npm test`, `test:flake` 5 of 5, `mutate:changed` 100 per file, an Opus read that attacks classes.
