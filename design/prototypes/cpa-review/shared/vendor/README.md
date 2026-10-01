# Vendor files

- `govuk-frontend.bundle.js`: `govuk-frontend` 6.5.1 (MIT), `dist/govuk/all.bundle.js`, source map line removed.
- `moj-frontend.bundle.js`: `@ministryofjustice/frontend` 11.1.0 (MIT), `moj/all.bundle.js`, source map line removed.

Both are the official UMD builds, so the pages work when opened straight from disk (`file://`), where ES modules are blocked. Fetched with `npm pack` on 1 Oct 2026. Prototype use only; the built app takes them from `package.json` (U00).
