# D00 build (cloud-055342)

Branch claude/D00; head is the commit that adds this report. Premise fixed by A350 (packages, logo).
Files: package.json and lockfile (govuk-frontend 6.5.1, @ministryofjustice/frontend 11.1.0, sass 1.105.1, nunjucks 3.2.4, axe-core 4.13.0, moment 2.31.0, all exact), design/basis/{build.mjs, settings.scss, entry.scss, parts.md, templates/sample.njk, ashbridge-tax-logo.png}.
Acceptance: 15 of 15 pass (design/basis). typecheck, lint, deps:check clean; scope OK (5 paths). Full unit project: 738 of 739 pass; the one failure is RT-3 RT-9 property (Windows-1252 round trip), not touched by this card.
Ambers: (1) MOJ clash workaround: build.mjs copies the MOJ package to a scratch dir and removes the two fixed `with (...)` configurations in vendor/govuk-frontend/_base.scss and _index.scss; node_modules never edited; it throws if the pattern disappears. Reverse: drop strip() when MOJ 11.2 lands. (2) The footer crest rule is stripped from the compiled CSS (RV-55). (3) Header is hand-written Generic header markup because the govukHeader macro hardcodes the GOV.UK logotype; service name comes from the service navigation macro.
Not done: no `// @mutate` (not a core card). Local axe run needed a symlinked chromium (box has 1194, Playwright wants 1243): PLAYWRIGHT_BROWSERS_PATH scratch dir; the checker may meet the same gap.
Rule candidate for the Lead: the box browser build does not match Playwright 1.63; fix in the cloud setup.
Permission gaps: Read of node_modules is denied, so MOJ internals were learnt from sass errors only. Model: Sonnet 5.5.
