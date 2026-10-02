# Findings W00 round 1

Recorded by the Lead from the Opus findings reviewer's returned text (2 Oct 2026). Inputs: reports/W00-check.md, W00-build.md, W00-spec.md (on claude/W00), plan/cards/W00.md, AMBER A347 and A351, .claude/rules/testing.md, the W00 diff (33 files), tools/mutate-changed.mjs, vitest.mutate.config.ts, tools/test-homes.json, cards SC, TH, S00 and claude/S00's harness. A351 (browser tests) does not bear on W00.

## Root causes

**RC1. Byte-exact files depend on the environment, not on committed bytes** (check failure 1, the Windows-1252 note).
- `* text=auto eol=lf` rewrites line endings, so each reader repairs them its own way: F03's `taxprepBytes` (src/contracts/taxprep.acceptance.test.ts:84) adds CR and refuses a file that already has it; S00's harness (claude/S00 `src/modules/taxprep-sim/core/__fixtures__/harness.ts:23`) uses `\r?\n`.
- Main is already mixed: `git ls-files --eol` shows 11 and 12 `import.csv` stored CRLF, 01 to 10 and 13 to 15 LF. A347 makes all 15 CRLF, which breaks the strict helper.
- Same family: the property test's ALPHABET comes from Node's `TextDecoder('windows-1252')` (line 1050); Node 22 and 24 differ.
- Where else: reference/taxprep exports (LF; F03 line 240 through `taxprepBytes`, line 579 tolerant; S00 harness line 33), S00 goldens for 01, 05, 08, W14/W15 generators, B04 (`qbo/*.csv`), B01 GIFI file, S02, S03, W20 rendered files.

**RC2. The mutation gate only looks under `src/`** (check failure 2).
- `mutate-changed.mjs:35` keeps only `^src/.*\.ts$` and exits 0 with "no mutation targets changed" even on a core card; `vitest.mutate.config.ts` keeps only `src/` globs. Markers alone would score nothing in `testworld/`. W00's Build never asks for markers.
- Where else: W01 to W13 (`testworld/kinds/**`), W14 and W15 (`reference/sample-clients/lib/*.mjs`, never mutated), core tools under `tools/`.

**RC3. Money enters as a float, and a second strict converter exists** (ARC-13, `load.ts:14` with `money.ts:35`).
- `dollarsToCents(String(x))` after `JSON.parse`: large amounts lose cents silently; "1.230" is accepted.
- `testworld/model/money.ts` has its own `DECIMAL` regex beside F09A's `normaliseAmount`; SC R28 will go red on it.
- Where else: A01, A05, B04, JH0, W01 to W13 (all read answer keys); F03 WriteValue (whole dollars, acceptable today).

**RC4. Checks take their pass condition from the data they check** (ARC-8 group).
- Roll waiver and "listed fault" read the same `rolls:false` bit (`faults.ts:204-212`, `checks.ts:126`); the catalogue is built from the answer keys (`faults.ts:35`), so check 7 is circular.
- Vacuous passes: no statementBalances means no roll check (`load.ts:163`); transaction `acct` never checked against declared accounts (`checks.ts:136-138`); zero-line entry nets to zero (`checks.ts:104-110`); entry type derived from sources (`load.ts:190-195`); null GIFI skips the four-digit check (`checks.ts:145`).
- Where else: plan/cards/families/kind.md check 3; E01, E02, E03 ties ("no false alarm" on an empty set). SC R26 is the pattern.

**RC5. The SEC-11 guard checks a hand-picked field list with narrow patterns** (`load.ts:229-255`, `guard.ts:50`, `guard.ts:66`, builder amber 3).
- Never guarded: T4/T5 SINs, Schedule 9 business numbers and names, owner SINs, holder names, spouse name. E-mail and phone scanned only in onboarding.json and profile.md. Phone pattern misses "(416)555-1234", "4165551234". A business number with spaces or an RT suffix is treated as made-up.
- Where else: verify.mjs (`luhnValid`), W14/W15 generators, W20, B04, JH0, A05 fixtures, `src/modules/storage/__fixtures__/harness.ts`, W01 to W13.
- Reviewer's scan of 122 sample files: 0 e-mails outside a reserved domain, 0 phones outside 555-01xx, 0 Luhn-valid nine-digit numbers.

Process gap: `/security-review` not yet run on this security card.

## Card corrections (amber)
- Check 7 is circular: the catalogue is a hand-written typed list in `testworld/model/faults.ts`, compared with the answer keys both ways; the roll waiver reads the catalogue (client, account, month).
- One converter: move strict `decimalToCents`/`centsToDecimal` into `src/core/money.ts` (recommended) or allow-list in R28.
- Build adds `// @mutate` on money, guard, checks, faults.
- Entry type: builder amber 1 stands; drop "has a type" from the checks.
- generate.ts runs `make-csv` without `--check` (correct for a temp-copy compare); fix the wording.
- "Not in this card" still says no change to reference/sample-clients; A347 overrides it.

## Consolidated fix list
Tool (lands before W00's re-check): T1 `mutate-changed.mjs` adds `testworld/**/*.ts` (not tests) to targets, and on a core card zero marked targets in the card's Paths fails. T1b `vitest.mutate.config.ts` includes testworld test globs; re-run `mutate:canary`.

Spec (W00 round 2):
- S1 `taxprepBytes`: CRLF-stored returned as is; LF-only gets CRLF; mixed refused; assertions kept; in a shared fixture `src/contracts/__fixtures__/taxprep-bytes.ts` that S00 adopts next round.
- S2 ALPHABET from a fixed hand-written table (the 27 defined code points in 0x80 to 0x9F).
- S3 ARC-13: loader refuses money written "1.230"; a 16-digit amount stays exact; rates and percentages are not money.
- S4 ARC-8 planted tests: `rolls:false` with no catalogue entry; account with transactions and no balances; transaction on an undeclared account; zero-line entry; missing GIFI on a balance line; extra key flag not in the catalogue. Each refused.
- S5 check 7 against the hand-written catalogue, both ways.
- S6 SEC-11 table-driven: a planted real-looking value per field kind and per file kind (CSV payees need "(Test)" or TEST); phones in five formats; a business number spaced and with RT0001 passing Luhn. Run the widened guard over all 15 folders first; failures go to the Lead and are fixed by the generator.

Build (W00 round 2): B1 converter placed per the card; money read from source text via a `JSON.parse` reviver with `context.source`, money fields only. B2 guard walks every JSON string, every CSV cell, e-mail and phone over all text. B3 S4 and S5 checks; waiver reads the catalogue. B4 `// @mutate` on the four files, score 100 once T1 is in. B5 `/security-review` before boarding.

## Rule tests
- TH R5: every byte-compared file (`reference/sample-clients/**/taxprep/*.csv`, `reference/taxprep/**/exports/*.csv`, `**/__golden__/**`) is `-text` or `binary`; `git ls-files --eol` shows no index endings that disagree; planted CRLF CSV under `eol=lf`.
- TH R6: no test builds expected bytes with a non-UTF-8 TextDecoder/TextEncoder; setup fails below Node 24; planted old ALPHABET loop.
- DG R: a core-card fixture with only testworld paths and no markers fails.
- SC R34: SEC-11 repo scan of sample clients, testworld, fixtures, goldens: Luhn-valid nine digits (spaced, hyphenated, RT suffix), e-mails outside reserved domains, phones outside 555-01xx.
- SC R35: every exported model or kind check has a planted failing test; a check over an empty collection reports "nothing to check" unless declared.
- SC R36: money read from text only; no `dollarsToCents(number)`, no `x*100` from JSON numbers.

## Risks and re-tests
- S1 touches F03R's tests: re-run all of taxprep.acceptance.test.ts with RT07 (LF), MAPLE (CRLF) and a planted mixed file; the edit sits in W00's spec commit.
- `-text` plus regenerated CSVs: re-run verify.mjs (`make-csv --check`) and tools/test/sample-prior-year.test.mjs; W14/W15 generators on Windows and Linux; use fresh worktrees.
- S00: re-run its spec validation and golden imports for 01, 05, 08 after W00 lands; W00 lands before the S00 build.
- Money reviver could catch rates or three-decimal amounts: grep all 15 answer keys first.
- Wider guard could refuse a sample on the bank-description TEST rule: run over all 15 before the build.
- T1 lengthens Stryker and may change DG's tests: re-run done-gate.test.mjs, mutate:canary, and one src core card (F05M).
- Converter in src/core/money.ts: re-run F00's money acceptance and property tests.
