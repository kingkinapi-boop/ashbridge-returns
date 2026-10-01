# F00 security review (SEC-10, card security points)

Reviewer: an Opus helper that did not spec, build or check F00. Diff: `git merge-base origin/main origin/claude/F00` (a57ee2f) to origin/claude/F00 (53 files). Reviewed by the /security-review checklist by hand, plus an adversarial read against `plan/cards/F00.md`.

## Verdict: FINDINGS

No secret, no key, no high or critical issue. Three medium findings should be fixed before F00 boards the train (1, 2, 3); the rest are low or for the Lead.

## Findings

1. **Medium. `.github/workflows/checks.yml:39`: gitleaks binary downloaded and run with no checksum.** `curl ... | tar -xz gitleaks` then `./gitleaks detect`. A swapped release asset would run with the job's token and the repo checkout. Fix: download to a file, check it against a pinned SHA-256 (`echo "<sha256>  gitleaks.tar.gz" | sha256sum -c -`, the value from the v8.28.0 `checksums.txt`), then extract. A rule test in `tools/test/toolchain-rules.test.mjs` that every `curl` in `.github/**` is followed by `sha256sum -c`.

2. **Medium. `package.json:20` (`e2e`), `playwright.config.ts:19` (`next start`), and every `next build` on the train: Next.js telemetry is on, so a test run calls telemetry.nextjs.org.** Nothing at test time may reach an outside service (card, SEC-10 spirit, CLAUDE.md "free, no live service"). It carries no client data, but it is an unasked network call from the build. Fix: set `NEXT_TELEMETRY_DISABLED=1` in the workflow `env:`, for the `e2e`, `build` and `dev` scripts (cross-platform, so through a small plain-Node wrapper in `tools/` that sets it before running `next`), and in Playwright's `webServer.env`. Rule test: every script that runs `next` sets it.

3. **Medium. `src/core/log.ts:2`: the redaction key pattern misses camelCase and common names.** Checked with node: `clientSin`, `spouseSIN`, `socialInsuranceNumber`, `bankAccount`, `transitNumber`, `institutionNumber` all print in clear; only `sin`, `sin_number`, `birthDate`, `dateOfBirth`, `accountNo` and snake_case are caught. Dates of birth inside a message string are never redacted (only the 9-digit SIN pattern is). Later cards log client fields through this logger, so the gap would become a SEC-4/SEC-10 leak once real data arrives. Fix: normalise each key (lower case, drop `_`, `-` and spaces) and redact when it contains `sin` as a word part, `socialinsurance`, `dob`, `birth`, `account`, `transit` or `institution`; add a fast-check property over generated key spellings (camel, snake, kebab, upper) for each sensitive name. The test change goes through a spec job, not the builder.

4. **Low. `.github/workflows/checks.yml:27,30`: actions pinned by moving tag (`@v4`), not by commit SHA.** Fix: `actions/checkout@<full sha> # v4.x.y` and the same for `actions/setup-node`.

5. **Low. `.github/workflows/checks.yml:27`: checkout keeps the job token in `.git/config` while `npm ci` runs third-party code.** Permissions are `contents: read`, so the harm is small. Fix: `with: persist-credentials: false` (gitleaks and the tests need no token).

6. **Low. `tools/mutate-changed.mjs:29`: `shell: true` on Windows with file names from `git diff` joined into the command.** A file name with `&` or `|` would run as a command on the laptop. File names are repo-controlled, so the risk is small. Fix: run Stryker's bin through `process.execPath` with `shell: false`, or reject any target not matching `^[\w./-]+$`.

7. **Info. npm audit (lockfile, at high): clean.** 2 moderate (`qs` via `typed-rest-client` via `@stryker-mutator/core`, dev only, never in the app). No action at the card's threshold; Dependabot alerts (Lead, still to turn on) will track it.

8. **Info, card mismatch. `tools/test/__fixtures__/mutation-canary/stryker.canary.config.mjs`: canary break threshold 75, card says the canary must score 100.** Already in the build and check reports (two equivalent mutants in the spec's `canary.ts`). Lead decides: a spec job fixes `canary.ts`, then break 100.

## Checked and clean

- No secret, key or token in the net diff or in any of the 15 branch commits (pattern scan; booleans only, no `.env` read). No `.env*`, key or credential file is tracked; `.gitignore` has `.env*` and `git check-ignore .env.local` is true.
- Workflow: `permissions: contents: read`, triggers and `paths-ignore` match the card (skips claims, train, review branches and docs-only pushes), one concurrency group per branch, gitleaks with `--redact` on full history, `npm audit signatures` and `npm audit --audit-level=high` present, no journeys and no mutation on GitHub.
- Dependencies: exact versions, `.npmrc` with `save-exact`, `min-release-age=7`, `engine-strict`; lockfile v3, all 417 packages resolved from registry.npmjs.org with integrity; the only install script is optional `fsevents` (macOS). Next 16.3.6 is past the React2Shell fix. No dependency needs an account, a key or money.
- `src/core/env.ts` names failing settings only, never values (a test plants a value and checks it is absent). Tests reach no network: PGlite in-process, Playwright on localhost:3100 only.
- Adversarial read: home page text, tsconfig strict flags, ESLint `strictTypeChecked`, Vitest projects, Playwright settings, dependency-cruiser boundary, `.gitattributes` and scripts all match the card, apart from item 8.
