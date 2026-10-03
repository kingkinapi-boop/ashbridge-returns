# SC findings review (3 Oct 2026, Opus, cold)

Input: reports/SC-check.md (FAIL, 5 findings), SC-build.md, SC-spec.md on claude/SC (bf1ca4b); cards SC, FX3 to FX6, SC2 to SC6; KNOWN in tools/test/schema-contract-rules.test.mjs:30-70 and src/contracts/schema-rules.db.test.ts:48-62.

## Root causes
RC1 An exemption is a regex with no size. `onlyKnown` (both files) fails an entry only when it matches nothing; it never fails when an entry matches more than it was written for. So open patterns pass silently: R43 `returns\.[a-z_]+\.[a-z_]+_id` (any pointer, future ones too), R23 `\w+RecordSchema` (about 22 schemas, any new one), R41 five files in one entry, R37 every CSV under two folders, R45 `sensitiveKindForKey\("[^"]+"\)`, R18 four files in one entry, R46 two defects in one entry, db R13/R15/R42/R44 alternations over several tables. Findings 1 and 2.
  Same cause, not in KNOWN: BINARY_FIXTURES (:880) excuses `ocr/textlayer/__fixtures__/[a-z-]+\.pdf` and `storage/__fixtures__/drive-*/.+\.pdf` (any future PDF); PENDING (:977) is never checked for staleness, so A03 recorded and A07 sheets stay "pending" after landing.
RC2 A scan skip in place of a named excuse. `testDataFiles()` (:897) drops all of tools/test/__fixtures__/schema-contract/, goldens and clean twins included, to hide the three planted-r34 files. Finding 3.
RC3 A scan that can be empty passes. R16, R17, R18, R41, R49, R56 never assert they read a file (or a core file). The card's own rule "a rule with nothing to check fails" is applied to PENDING subjects but not to the file scans. Finding 4.
RC4 Owners that cannot fix. Most entries name landed cards (F02, F05M, F09B, E03, G01, F03R, TH, A05 done; F01, W00 parked) or non-cards ("F01 family", "G00 or G02", "A01 successor", "FX3 spec job"). A done card has no next round, so the entry never shrinks. The FX3 directive in SC.md covered only the 20:45Z build list. Finding 2's owner half.
Finding 5 is not a defect: an R34 plant must be Luhn-valid to prove the rule; it needs a named excuse (RC2), not a new number.

## Spec or build
Spec. Every item is in the two SC test files, which the spec job wrote and the builder may not edit. No product code changes. The Lead first puts a bold directive on SC.md, widens FX3 Paths and cards FX7 (below).

## Consolidated fix list (one SC spec job, then build re-run, then check with an Opus read)
1. Merge main (68 commits ahead; A06, A07D landed) and re-run every rule to get the real problem list.
2. Change `onlyKnown` in both files: an entry is `{ rule, file, problems: [exact strings], owner: '<card id>' }`; it fails when a listed string is missing (stale) and any problem not listed fails, so no entry can grow. Owner must be a card in plan/slices.json that is not done or parked.
3. Narrow, one file and one defect per entry, exact strings counted:
   - db R43: name the 20 pointer columns (ids.ts lacks FUTURE_POINTERS) plus client_handoff.fact_id; owner FX3 (add src/contracts/ids.ts to FX3 Paths).
   - R23 records.ts: list each RecordSchema by name; FX3. R23 checks.ts (3 schemas): FX3 (add checks.ts to Paths). R23 facts.ts: FX7. R23 lifecycle.ts: FX5.
   - R41: one entry per file that fails on the merged main; reading.ts, facts.ts, amount-grammar.ts to FX7, taxprep.ts to FX6, sheets.ts to FX4, gaps/bank, ai.ts, run.ts to FX3. Drop any of the five that no longer fails.
   - R37: name each CSV; FX7 (.gitattributes and the files). R45: name each key; R45-enum, R45-cite: FX7.
   - R18: four entries, one per file, plus gaps/index.ts; all FX3. R16 queue.ts FX3; R16 lifecycle FX5.
   - R46: two entries; R36, R56 raw.ts: all FX4 (FX4 rebuilds src/modules/sheets/**), not FX3.
   - db R13, R15, R42, R44: one entry per table and column; FX3. R12, R15 exceptions, R55: FX3.
   - R28, R30, R32, R38 taxprep acceptance test: FX6 (owns taxprep.ts). R38 Node 24 setup, R39 amountGroups, R49 reading.ts, R34 A05 log plant, R54 A01 MediaBox: FX7.
4. Sheets is on main: replace KNOWN R47, R48, R54 sheets with a READERS entry (as done for A03 at 21:40Z); any exact failure it then shows goes to FX4. Delete PENDING rows whose subject exists, and make a PENDING row with an existing subject fail as stale.
5. R34: scan the SC fixtures folder; excuse planted-r34-pii.json, .txt, -dotted.txt by name, each with the problem strings it must raise (so the excuse also proves the rule). Narrow BINARY_FIXTURES to file names.
6. Every file-scan rule asserts a non-empty scan and one named sentinel file (R16 a db/schema .sql, R18 a core file, R41/R49/R56 src/contracts/text.ts); same helper for R34, R36, R46, R50, R51.
7. Lead (before the spec): card FX7 "Rule defects in landed contracts (found by SC)" with Paths for facts.ts and its loader, reading.ts, amount-grammar.ts, ocr/textlayer, .gitattributes and the taxprep CSVs, the Vitest setup file, the A05 plant; add the SC defects to FX3, FX4, FX5, FX6 cards; amber row.

## Rule test that refuses a broad entry (add in step 2, planted first)
`KNOWN shape`: every entry has one `file`, one `rule`, a non-empty `problems` array of literal strings (no RegExp), and an owner id that exists and is open; a problem matched by no entry, or an entry string not produced, fails. Planted: an entry with `match: /^src\/contracts\/.*/`, an entry with two files, an owner 'F02' (done). A shared `tools/test/lib/known.mjs` holding this for every rules file is a card of its own (SC7, deps SC), run over every `*-rules.test.mjs`.

## Where else it bites
- SC4 (claude/SC4): entries are per input (good); R69 owner "the Lead assigns" becomes FX6 (A406). SC6 (claude/SC6): R77 owner W14 is done; R78 `verify\.mjs:\d+` is an open line set; narrow both before SC6 checks. SC2, SC3, SC5 (not spec'd): add the KNOWN shape to their cards now; SC5 already asks for live owners.
- .claude/rules/testing.md has no KNOWN rule: add one line (Lead): one file, one defect, exact strings, a live owner, a non-empty scan.

## Risks and re-test
- Exact strings break when a message wording changes: that is intended (the entry is reviewed again), but the spec must print messages without line numbers or counts that drift.
- Narrowing and step 4 may surface new failures (A07D, A06 on main): each gets an exact entry and an open owner, never a skip.
- R34 over the whole fixtures folder may flag goldens: excuse by name with the reason, or fix the golden via its owner.
- Re-test: both SC files, `npm test`, db project, `npm run test:flake` (the last run printed nothing), Opus read of the KNOWN diff only.

## Can SC land this round
Yes. All fixes are test-file edits in SC's Paths plus Lead card work; nothing waits on another card. One spec job, a build re-run, one check. If the narrowed list then fails only on a new landing, refit and land; a third failure splits KNOWN tooling into SC7.
