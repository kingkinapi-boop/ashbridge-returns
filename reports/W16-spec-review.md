# W16 spec review (round 2), 3 Oct

Spec 704a9432 on claude/W16-r2 (verify.mjs, README.md). Read: plan/cards/W16.md (directive A404), reports/W16-findings.md, blueprint 00 (END-2) and 09 (ARC-8, ARC-16), .claude/rules/testing.md, verify.mjs (R8, R12, regenerate), and the registers in 562b349.

## Verdict: GAPS (3). Gap 1 goes into the spec before the build opens; gaps 2 and 3 can go in with it.

## What holds
- All six moved figures recompute by hand with R8's rates and first-year rule. There are no short years: every incorporation date (2017-06-05, 2020-02-18, 2018-11-20, 2020-01-13, 2015-10-05) is earlier than the assets.
  - 04 class 8 (AII 1.5, calendar years): 2022 CCA 0.2 x 75,000 = 15,000.00, UCC 35,000.00; 2023 adds the cooler 12,000 at 1.5, CCA 0.2 x 53,000 = 10,600.00, UCC 36,400.00; 2024 CCA 7,280.00, UCC 29,120.00. Matches.
  - 08 class 50 (AII, years to 30 Sep): 990.00 (UCC 210.00), 115.50 (94.50), 51.975 rounds to 51.98, UCC 42.52. Matches.
  - 07 class 1 (half-year): CCA 11,200.00, 21,952.00, 21,073.92, 20,230.96, 19,421.72; UCC 466,121.40. Matches.
  - 03 11,020.80, 08 class 8 3,315.20 and 10 4,390.40 (one asset each, cost x 0.7 x 0.8 x 0.8) also match. Book accumulated amortization 12,300.00, 28,000.00, 112,000.00, 5,160.00 and 5,880.00 all match straight line, monthly (five years; 25 for the building).
- Retiring the two guards is right. The README tie fails first on main for the right reason, and its plant proves the comparison. R11 is written at the end state (539 passes, 0 known), and KNOWN and FIX_CARDS are empty.
- The old figures appear nowhere else (git grep: only the five folders' two JSON files and the client files). SC6's R78, run by hand, finds nothing in this verify.mjs.

## Gaps
1. Folder 09 is left unprotected. `clients/c09_10.mjs` is in W16's Paths, and it also generates folder 09. verify.mjs regenerates in place, and nothing on main or in CI checks that the committed folders equal the generator's output: the retired "01 to 10" guard did that by accident. A build could change c09_10.mjs so that 09's output moves and commit only 10. That build passes verify (it reads the regenerated tree) and passes scope (09 is not committed), and stale 09 data lands. Test to add (verify.mjs, ARC-16, every SPEC folder, compared with HEAD rather than main, so R78 allows it): after the two regenerations, `git diff --quiet --ignore-cr-at-eol HEAD -- <every SPEC folder>` is clean ("the committed sample data is the generator's output"). If git fails, the line fails; it never passes. The spec report records a hand proof: a temp clone with one generated file edited and committed fails the line.
2. "No other figure moves" (card Build bullet 3) has no mechanical check. The README tie reads only the lines it lists, and the "from" figures are never checked. Test to add as a check-job step (a one-off, not in verify.mjs, because a comparison with main is what R78 bans): for 03, 04, 07, 08 and 10, parse answer-key.json and onboarding.json on origin/main and on the branch and diff them. Only `assets`, `t2Inputs.schedule8.openingUcc[].ucc` and `prior_year_closing_balances.ucc[].ucc` may differ. The set of changed UCC figures must equal the README's six lines, each README "from" must equal main's figure, and every other file in the five folders must be byte-identical, ignoring CR. Write this into the card's Check section.
3. A bullet under "Opening UCC moved" that misses the line regex (for example "class8") is skipped silently. The check line prints the count of parsed bullets but asserts nothing about it. Test: every "- " bullet in the section parses, or the line fails and names it. Plant a README copy with one bullet broken that way.

## For the Lead and the Opus check read (amber, not a spec gap)
- 07's building went into use on 1 Jan 2020, after 20 Nov 2018, so the accelerated investment incentive applied to class 1. Maximum CCA with factor 1.5 gives UCC 447,096.03, not 466,121.40. Half-year holds only as a claim below the maximum (for example, if the rental-loss restriction capped the claim). Either switch 07 to `aii` (a spec fixup to the README figure) or write the reason into the README line. Decide before the build, because the README figure is the spec's.
- The card body still carries round-1 text that the directive overrides: Build bullet 3 (a retained earnings line moves) and acceptance check 3 (01, 02, 05, 06, 09 and 11 to 15 byte-identical to main). Rewrite both (a plan/ edit) so the checker grades against the directive.
- Land order: the R11 count (539) breaks if another card adds a verify.mjs line first, so whichever card lands second re-runs verify. For the SC6 landing trap, see reports/SC6-spec-review.md gap 4.
