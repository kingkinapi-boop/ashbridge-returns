# TH spec (cloud-4ab7b4)
- 9 failing tests (card's own) + 18 passing planted/rule tests in tools/test/toolchain-rules.test.mjs, fixtures in tools/test/__fixtures__/test-homes/. Clauses: ARC-17 (R1-R3), ARC-4 (R4), ARC-9, A05 gitleaks.
- validated on main 2cb2159: typecheck and lint clean, npm test green except the 9 TH tests failing by name (no tools/test-homes.json, .gitleaks.toml; checks.yml lacks --log-opts="HEAD").
- Data file shape the build must create: { unit:{include,exclude}, db:{include}, evals:{include}, tsconfig:{include} }; tsconfig.json include must equal tsconfig.include (order free). Sample in fixtures homes.json.
- R3 and R4 real-repo tests pass already (no violation today); their planted tests prove the rule.
- Amber: own tiny glob matcher in the test (no dependency); gitleaks allowlist regexes read from ''' ''' strings in .gitleaks.toml.
## Permission gaps
None. 
## Model
Sonnet 5.5 (card not core).

## Refit (cloud-d1020a, 2 Oct, A287)
R1 now walks without `reference/` (new `r1Files`; R2 to R4 unchanged). 27 of 27 rule tests pass; typecheck, lint and full `npm test` green with the build in place. Old validated sha 2cb2159, new validated on main 1a7c0a4. Model: Sonnet 5.5 (not core). Permission gaps: none.

## Egress rewrite (cloud-7c7b81, 2 Oct, Reviewer SLOW finding 6)
`src/core/egress-rules.acceptance.test.ts`: SEC-5 now runs ESLint `lintText` (path of the real `src/core/log.ts`, text from `tools/test/__fixtures__/egress/`) and asserts `no-console` and `no-restricted-syntax` on the planted file, none on the clean one, and no `no-console` under `db/global-setup.ts`. SEC-10 checkout: a planted checkout without the setting and a planted workflow with no checkout are caught; `checks.yml` must hold at least one checkout. Both tests shown failing with the feature removed (eslint rule off, persist-credentials deleted), passing restored. Typecheck, lint, `npm test` green; validated on main 3b28533. Model: Sonnet 5.5 (card not core). Permission gaps: none (nvm install 24 needed in this cloud image).
