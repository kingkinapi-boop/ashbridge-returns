# W16 check (round 2): PASS

Worker local-2 (laptop), Opus 5.5 (core card: this is also the Opus read). Branch claude/W16-r2 at 3d19647f (origin/main merged). Spec commits 704a9432, 31e0de5a, 6c428ac4 (refit); build 49ae6ddf, report 3d19647f.

## Commands
- `npm run typecheck` clean; `npm run lint` clean; `npm run deps:check` "no dependency violations found (197 modules, 679 dependencies cruised)".
- Unit project (run before verify, see the CRLF note): 2548 tests, 2545 pass; the 3 failures are the known laptop-only ones (design/basis RV-52 build timing; storage/real-parent two ARC-6 symlink tests, EPERM on Windows). W16 touches no db code; db project and test:flake not needed.
- `node reference/sample-clients/verify.mjs` twice: "541 passed, 0 known, 0 failed" both times. R8 passes on 03, 04, 07, 08 and 10, and KNOWN has no R8 entry. The ARC-16 lines pass (second generation byte-identical, 122 files; every SPEC folder equals HEAD). The three W16 README tie lines pass, and so do the SEC-11 name, BN and SIN lines.
- `node reference/sample-clients/make-csv.mjs --check`: 1255 passes, 0 failures. Afterwards the CRLF import.csv files were restored with `git checkout -- reference/sample-clients` (a diff that ignores CR showed nothing).
- Spec diff: `git diff 6c428ac4 HEAD` over verify.mjs, README.md and plan/cards/W16.md is empty.
- Scope: `node tools/scope.mjs W16` prints "SCOPE FAIL W16: spec file edited by the build: README.md, verify.mjs in 562b349". It reads origin/claude/W16, the retired branch, not W16-r2. By hand on W16-r2: the build commit 49ae6ddf touches only clients/c03_04.mjs, c07_08.mjs, c09_10.mjs and answer-key.json and onboarding.json of 03, 04, 07, 08 and 10, all inside Paths. Only spec(W16) commits touched verify.mjs, README.md and the card. Clean.
- Mutation: no `@mutate` file in Paths (data and verify only), so nothing to score. Not run on the laptop: mutate:canary, `/security-review` (this worker has no slash-command tool; a manual security read is below).

## One-off step against origin/main (card Check)
- In the five folders, only answer-key.json and onboarding.json differ (ignoring CR). In those files only `assets` (added), `t2Inputs.schedule8.openingUcc[].ucc` and `prior_year_closing_balances.ucc[].ucc` changed.
- The changed figures equal the README's six, from main to branch, with Schedule 8 and onboarding moving together: 03 class 8 9,840 to 11,020.80; 04 class 8 21,400 to 29,120; 07 class 1 481,200 to 447,096.03; 08 class 8 3,440 to 3,315.20; 08 class 50 1,210 to 42.52; 10 class 8 2,940 to 4,390.40.

## Opus read: UCC by hand, one class per client (two for 08)
- 03 (fiscal year Jul to Jun), class 8, 24,600, in use 1 Jan 2022, AII: 7,380, 3,444, 2,755.20, giving 11,020.80. Book amortization: 30 months of 60 = 12,300, the same as opening TB 1531.
- 04 (calendar), class 8: 50,000 in use Jul 2022 (CCA 15,000), then the cooler, 12,000 in use Oct 2023 (2023 CCA 7,000 + 3,600). 2024 CCA 7,280, giving 29,120. Book 25,000 + 3,000 = 28,000, the same as TB 1531.
- 07 (calendar), class 1, 560,000, in use 1 Jan 2020, AII factor 1.5: 33,600, 21,056, 20,213.76, 19,405.21 and 18,629.00, giving 447,096.03. Book 22,400 x 5 = 112,000, the same as TB 1511.
- 08 (Oct to Sep), class 8, 7,400: 2,220, 1,036, 828.80, giving 3,315.20. Class 50, 1,200: 990, 115.50, 51.98 (half up), giving 42.52. Book 8,600 x 36/60 = 5,160, the same as TB 1531.
- 10 (calendar), class 8, 9,800: 2,940, 1,372, 1,097.60, giving 4,390.40. Book 5,880, the same as TB 1531.
- Trial balances unchanged (no TB field in the diff). Every in-service date is after incorporation and before the year, so no flag or planted issue moves: the dated flags (03-F04, 04-F05, 07-F02, 08-F07, 10-F06) all fall inside the year. Each register's yearly book amortization also adds up to the current-year amortization add-back with the in-year additions, for example 03: 4,920 + 9,184.66 + 172.66 = 14,277.32.

## Security read (manual)
Data only, made up: generic asset descriptions, no names, no BN or SIN added. verify.mjs (spec) calls git through spawnSync with an argument array (no shell) over known folders. No network, no key, no client sentence.

## Observations for the Lead (not failures)
- 07's land (account 1500, 310,000) is not in the register. R8's shape needs a CCA class for every row, so land cannot be listed, and a land cost is never tied to a register. The card asked for "a rental building and its land". Rule candidate (SC): R8 accepts a row for property that is not depreciated (land) and ties every fixed-asset cost account in the opening trial balance to the register.
- scope.mjs reads the retired claude/W16. Delete that branch, or teach scope.mjs the -r2 branch, before boarding.
- `/security-review` itself was not run (the card is tagged security). Run it before boarding if the manual read is not enough.
