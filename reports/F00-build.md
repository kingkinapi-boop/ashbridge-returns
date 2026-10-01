# F00 build report
Branch claude/F00, scaffold commit on top of main. Worker cloud-vm (Node 24.21 via nvm, npm 11.19).
Files: package.json + lockfile, .npmrc, .nvmrc, .gitattributes, .gitignore, tsconfig, next/vitest/playwright/eslint/stryker/dependency-cruiser configs, .github/workflows/checks.yml, src/app, src/core (clock, money, ids, env, log, db), core tests, e2e smoke.
Checks run: typecheck, lint, deps:check clean; `npm test` 23 passed (unit + db); `npm run e2e` smoke passes on the production build; `npm audit --audit-level=high` clean (2 moderate in stryker dev chain via qs); `npm audit signatures` ok; scope OK.
Acceptance 7 (laptop CRLF check) not testable here.
## Ambers
- TypeScript pinned 5.9.3, not 7.x (typescript-eslint support). Reverse: bump once supported.
- Playwright uses /opt/pw-browsers/chromium via executablePath (PW_CHROMIUM_PATH overrides); on other machines set it or install a browser.
- Next 16.3.6, React 19.3.0, zod 4.6.5; client app versions not readable here.
- gitleaks in CI is downloaded by curl at v8.28.0 (no paid action). Stryker mutates only money.ts and ids.ts for now.
## Permission gaps
- `gh api -X PUT .../vulnerability-alerts` (Dependabot alerts) was denied by the auto-mode classifier; Zo or the Lead must turn it on (repo Settings, Code security).
- Default Node was 22; installed 24 with /opt/nvm.
## Model
claude-sonnet-5-5
