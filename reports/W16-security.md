# W16 security review (SEC-11: only made-up data)

**CLEAN.** Reviewed 3 Oct 2026 (Opus, /security-review standard) on `git diff origin/main...origin/claude/W16-r2`, branch head 9a14299f.

## What changed
- Five answer keys (03, 04, 07, 08, 10) gain an `assets` register: generic descriptions ("Shop equipment brought forward", "Kitchen equipment brought forward", "Walk-in cooler brought forward", "Rental building brought forward", "Studio furniture and equipment brought forward", "Computers brought forward", "Floor machines and vacuums brought forward"), GL account codes, a CCA class, a whole-dollar cost, an in-use date, a book method and `cca.firstYear: "aii"`. No names, addresses, SINs, business numbers or bank details are added.
- Six opening UCC figures move in the answer keys and in onboarding's `prior_year_closing_balances.ucc` (03, 04, 07, 08 x2, 10), each with its existing "made-up" note kept.
- Generators `clients/c03_04.mjs`, `c07_08.mjs`, `c09_10.mjs`: data-only edits (an in-service date, an opening UCC figure, the `c.assets` line). No new import, no I/O, no shell, no network.
- `verify.mjs`: the empty `KNOWN` and `FIX_CARDS` tables; the two hard-coded "folders 01 to 10 / 01 to 12 unchanged since main" lines are replaced by one line that compares every regenerated SPEC folder with HEAD; a new README-to-data opening UCC tie with two planted sample-copies.
- `README.md`: status counts and an "Opening UCC moved" section (figures and asset descriptions only).

## Checks made
1. **Real data:** no person or firm name, address, SIN, business number, phone, email, URL or bank detail in any added line (manual read plus a pattern scan for nine-digit runs, URLs, `@`, transit or institution numbers, keys and tokens: no hits). The descriptions are generic asset types.
2. **Secrets or keys:** none in the diff. `.env` was not read.
3. **Generators:** only literal data changed; no new `import`, `fs`, `child_process` or `fetch`.
4. **verify.mjs reach:**
   - New `spawnSync` calls run `git -c core.safecrlf=false diff --quiet --ignore-cr-at-eol HEAD`, `git diff` and `git ls-files --others --exclude-standard`, all with an argument array (no shell), `cwd` set to `reference/sample-clients/`, and pathspecs limited to the SPEC folders. They only read; there is no network command (no fetch, pull or push).
   - The removed lines also ran only `git merge-base` and `git diff`, so the change does not widen what git commands run.
   - New writes are two README sample-copies under the existing `tmpRoot` (`fs.mkdtempSync(os.tmpdir() + 'sample-copy-')`). That temp folder was already used by the earlier planted-fault fixtures and is removed by `fs.rmSync(tmpRoot)` at the end. Nothing is written outside `reference/sample-clients/` except that temp folder, as before.
   - No network call, no `process.env` read and no home-directory read.
5. **SEC-11 guards not weakened:**
   - The SEC-11 code (verify.mjs lines 147 to 153 and 311 to 313) and the per-folder name, business number, SIN and "no SIN-shaped or bank-shaped digit runs" checks are outside the diff and unchanged.
   - The retired "folders unchanged since main" lines were ARC-16 scope checks, not SEC-11 checks. Their replacement (regenerated output equals HEAD, no untracked files) is stricter for determinism. Scope stays with `tools/scope.mjs` (rule R78).
6. **Ran it:** `node reference/sample-clients/verify.mjs` in a clean worktree of 9a14299f gives `541 passed, 0 known, 0 failed`. On 03, 04, 07, 08 and 10: "every person and company name ends in (Test)", "every business number and SIN fails its check digit" and "no SIN-shaped or bank-shaped digit runs" all PASS, and R8 PASSES. The only side effect is that regeneration rewrites `taxprep/import.csv` with CRLF line ends (no content change under `--ignore-cr-at-eol`); that is known and existing behaviour.

## Findings
None.
