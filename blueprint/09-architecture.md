# 09 Architecture

- **ARC-1** Its own repo (ashbridge-returns): a staff-only web app on the client app's stack: Next.js, TypeScript (strict), Postgres, Vitest, Playwright.
- **ARC-2** Its tables live in their own database schema, `returns`. At go-live that schema sits in the client app's database (LIVE-4). Client-app data is read through read-only views named in the bridge contract. This system writes only to its own schema, plus one shared table the client app reads (question lists and approval summaries as ids, slot values and numbers, never sentences). The question bank catalog (ids, slots, answer shapes, the fact each resolves) lives here; its wording lives in the client app.
- **ARC-3** Until go-live the schema is a set of editable files in `db/schema/`, one per module. At go-live they become one reviewed migration.
- **ARC-4** Tests use an in-process Postgres (PGlite). Cloud journeys use Postgres 16.
- **ARC-5** Heavy work (reading documents, AI steps, diffs) runs as jobs in a jobs table: idempotent, retried, with a status per return. The runner can be swapped.
- **ARC-6** Every outside service sits behind an adapter with a free stand-in. The live backend exists in code, switched off, with no key, until go-live.

  | Adapter | Free stand-in in the build | Live (off until go-live) |
  |---|---|---|
  | Reading documents (OCR) | PDF text layer with word positions; Tesseract for scans; recorded results | a vendor with word boxes, chosen by testing (LIVE-3) |
  | AI | recorded answers in tests | a Claude Code project on the firm's subscription (ARC-22), not a paid API |
  | File storage | a local folder | chosen at go-live |
  | Client documents (Google Drive) | a local folder shaped like the Shared Drive | the firm's Shared Drive, read-only |
  | Staff sign-in | test users | per-person logins with two-factor |
  | Taxprep | the simulator (RT-23) | people importing and exporting by hand |
  | QuickBooks Online (read only: API for balances, transactions and attachments; uploaded .GFI for the mapping) | the sample-client files and Intuit developer sandbox companies | the firm's QBO companies, read only |

- **ARC-7** Code is split into modules, each in its own folder with its own tests, so builders can work in parallel. Shared types live in `src/contracts/` and change one card at a time.
- **ARC-8** The test world (`testworld/`) starts from the ten sample clients in `reference/sample-clients/` and extends them, never inventing a second set, to the thirteen return kinds: the right answers as data, the documents as PDFs (some as scans), their books as QBO data, and planted faults with the flags they must raise.
- **ARC-9** Tests carry clause IDs. `node tools/matrix.mjs` lists every clause and the tests that cover it.
- **ARC-10** Every AI output and every derived record stores the versions that made it (AI-10).
- **ARC-11** Page images and word boxes are prepared when a document arrives, so sources open fast (RV-4).

## How it is built and tested

- **ARC-12** Every card's acceptance tests are written by a different agent from the one that builds it, before the build, named with the clause IDs they prove, and shown to fail first. The builder never edits them.
- **ARC-13** Money is stored as integer cents. Money and tax arithmetic is tested with property-based tests as well as examples.
- **ARC-14** Taxprep CSV files are tested with golden files: a known file in, the same file out.
- **ARC-15** Mutation testing runs on the core modules (ledger, books, round trip, checks, approval). A surviving mutant in a core module fails the train.
- **ARC-16** Tests pin clocks and random seeds. A flaky test counts as a failure: it is fixed or removed within a day, never retried until it passes.
- **ARC-17** GitHub runs typecheck and unit tests on every build branch. The full suite and the browser journeys run in Claude cloud sessions. Main moves only to a batch of cards (the train) that passed both.
- **ARC-18** Dependencies are pinned to exact versions with a committed lockfile, and a free audit shows no high or critical issue.
- **ARC-19** Work reaches builders through one queue (`tools/claim.mjs`): each card is specified, built and checked by three different workers, and no two workers hold overlapping files.
- **ARC-20** Each adapter's live side is tested from the start against a fake of the vendor's web interface, and a test flips its switch both ways, so the live path is never first run at go-live.
- **ARC-21** Browser journeys run against the production build (`next build`, then `next start`), never the development server.
- **ARC-22** AI jobs run in a separate Claude Code project on the firm's subscription, with its own orders and rules: Returns queues each job with its inputs, the project returns schema-checked JSON as the job's result (AI-1), code checks every citation (AI-4), and the project has no other write access to Returns.
