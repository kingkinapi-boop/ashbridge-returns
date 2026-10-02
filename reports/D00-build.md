# D00 build (cloud-550660): released, wrong premise

Branch claude/D00 (head = spec refit 82aeffe + main merge). No product code written.

Why released (builder step 4, "check the premise"):
1. The card says F00 installs govuk-frontend and MOJ Frontend with `npm ci`. They are not in `package.json` or the lockfile (checked on main 7dd2c02+). Missing: `govuk-frontend`, `@ministryofjustice/frontend`, `sass`, `nunjucks`, `axe-core` (the spec test resolves `axe-core/axe.min.js`), `moment` (MOJ peer). `playwright` resolves only through `@playwright/test`. Adding them changes `package.json` and `package-lock.json`, outside the card's Paths (`design/basis/**`) and the worker rules (npm install only when a card creates or changes package.json).
2. The logo `public/brand/ashbridge-tax-logo.png` lives in ashbridge-app, which this session cannot read (repo scope), and no copy is in this repo. The test needs `design/basis/ashbridge-tax-logo.png`.

Needed from the Lead: add those packages (pinned, per reference/design-basis.md: govuk-frontend ^6.5, @ministryofjustice/frontend ^11.1, sass, nunjucks, axe-core, moment) to package.json and the lockfile on main (a small card or Lead edit), and put the logo PNG in the repo (a Lead-copied file under design/basis/ or reference/). Then reopen the D00 build. The build.mjs contract is in the spec test header.

Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
