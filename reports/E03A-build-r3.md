# E03A build round 3 (cloud-2f60ce, 2 Oct): released

Branch claude/E03A (main merged in, 540d420). Catalogue and acceptance work are as in reports/E03A-build.md; nothing to change there.

Blocker: `gitleaks detect --no-banner --redact --log-opts="HEAD"` (v8.28.0, same as CI) finds 1 leak: rule generic-api-key, `src/contracts/facts-askable.acceptance.test.ts` line 526, commit 5acfe13 (spec(E03A)). Not a secret: the line is `entries.find((e) => e.key === 'prior_t2.schedule_8.cca_closing_undepreciated')`, a catalogue fact name. The `"key":` allowlist regex in `.gitleaks.toml` does not match the `e.key ===` form.

Why released: the line is in the spec file (builder may not edit it) and the fix is in `.gitleaks.toml` (outside the card's paths, TH's file). The commit is in history, so rewriting it is not allowed either.
Proposed fix (Lead or a toolchain card): add to `[allowlist] regexes` in `.gitleaks.toml`:
  `'''\.key\s*===\s*'[a-z0-9_]+(\.[a-z0-9_]+)+\''''`  (fact names in test comparisons, no paths)
Then re-run the command above: expect no leaks.

Permission gaps: none beyond Bash chaining being refused once.
Model: Sonnet 5.5.
