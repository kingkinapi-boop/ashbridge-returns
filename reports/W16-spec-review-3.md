# W16 spec review 3 (3 Oct, Opus, cold)

Spec fixup 31e0de5a on claude/W16-r2 (main 31defba1 merged): verify.mjs, README.md, plan/cards/W16.md, reports/W16-spec.md. Read: plan/cards/W16.md (A408, A404), reports/W16-spec-review.md, blueprint 00 (END-2), 09 (ARC-8, ARC-16), .claude/rules/testing.md, the fixup diff, and generate.mjs, lib/emit.mjs for what the generator writes.

## Verdict: GO. The three gaps are closed and client 07 is handled as the directive says. Three tests of the same kinds are left; none blocks the build (below, for SC6).

## Gap 1, folder 09 unprotected: closed by class
One ARC-16 line, after the two regenerations, runs `git diff --quiet --ignore-cr-at-eol HEAD` and `git ls-files --others` over every SPEC folder. It fails on a diff, an untracked file, a missing SPEC folder, a regeneration error, or any git exit other than 0 or 1. It is not tied to 09 or to this card's folders, and it compares with HEAD, never main, so R78 holds. generate.mjs writes only inside each client's folder (lib/emit.mjs:264-273), so the SPEC folders cover every committed output. Hand proofs in the report: an edited, committed 09 file fails; with .git moved away, the line fails.

## Gap 2, "no other figure moves": closed
The card's new Check section has the one-off step against origin/main. Only `assets`, Schedule 8 `openingUcc[].ucc` and onboarding `prior_year_closing_balances.ucc[].ucc` may differ. The changed set must equal the README's six lines, each "from" must equal main and each "to" the branch, the two UCC figures must move together, and every other file must be byte-identical ignoring CR. The report records a pass on the finished-state stub and a planted failure naming both faults. Build bullet 3 and acceptance check 3 are rewritten to the directive (no retained earnings line moves; 09 is protected through HEAD).

## Gap 3, a bullet that misses the regex: closed for the section
Every `- ` line under "Opening UCC moved" must parse, or the tie line fails and names it. A second plant ("class8") proves it, and the plant line fails if there is nothing to plant.

## Client 07: as directed
R8 models the accelerated investment incentive (factor 1.5 for an asset in use after 20 Nov 2018 and before 2024, 1.0 for 2024 to 2027), so 07 uses `aii`. Recomputed by hand at 4% on 560,000.00: 33,600.00 (UCC 526,400.00), 21,056.00 (505,344.00), 20,213.76 (485,130.24), 19,405.21 (465,725.03), 18,629.00, so UCC is 447,096.03. That matches the README line and the card's Build bullet. The other five figures are also AII (cost x 0.7 x 0.8 x 0.8 for one class 8 asset; 08 class 50 210.00, 94.50, 42.52), so the README sentence "every register uses the incentive" is true. No R8 gap to name.

## Same kinds left (not blocking; tests to add, through SC6's verify.mjs rules or a later W16 spec touch)
1. R11 reads `([0-9]+) known` from the first match anywhere in the README and treats a missing phrase as 0, so a README that drops "0 known" still passes. Test: R11 fails when the Status line has no "N known", read from that line only. Plant: a README copy without "0 known".
2. Under "Opening UCC moved", only lines starting with `- ` count as bullets: a `* `, `+ ` or indented bullet is skipped silently. Test: any list line in the section must parse. Plant: "* 04 class 8: ...".
3. The untracked check covers SPEC folders only: a client file whose `dir` is not in SPEC writes a folder nobody checks. Test: every `NN-*` folder on disk is in SPEC. Plant: a temp root with an extra 16-planted folder.

## For the Lead and the checker
- AII depends on the acquisition date (after 20 Nov 2018), and R8 keys it on `availableForUse`. That is harmless for made-up data that holds no acquisition date. If R8 is ever held to the law, it is a rule test for R8's owner (amber).
- The checker runs `npm test` before verify.mjs, or checks import.csv out again afterwards: verify leaves the CSVs as CRLF on disk, and F03's byte-for-byte test then fails. That is pre-existing (R37, owner FX7).
- The check runs the Check section as written: verify twice, `make-csv.mjs --check`, `node tools/scope.mjs W16` after the last commit, the one-off origin/main step, `/security-review`, and an Opus recompute of one class per client (07 with AII).
- Land order: README says 541 passes. Whichever verify.mjs card lands second (W16 or SC6) re-runs verify and re-counts.
