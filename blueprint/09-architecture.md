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
  | AI | recorded answers in tests; `claude -p` on the subscription to measure prompts | the Claude API |
  | File storage | a local folder | chosen at go-live |
  | Client documents (Google Drive) | a local folder shaped like the Shared Drive | the firm's Shared Drive, read-only |
  | Staff sign-in | test users | per-person logins with two-factor |
  | Taxprep | the simulator (RT-23) | people importing and exporting by hand |

- **ARC-7** Code is split into modules, each in its own folder with its own tests, so builders can work in parallel. Shared types live in `src/contracts/` and change one card at a time.
- **ARC-8** The test world (`testworld/`) generates the twelve return kinds: the right answers as data, the documents as PDFs (some as scans), and planted faults with the flags they must raise.
- **ARC-9** Tests carry clause IDs. `node tools/matrix.mjs` lists every clause and the tests that cover it.
- **ARC-10** Every AI output and every derived record stores the versions that made it (AI-10).
- **ARC-11** Page images and word boxes are prepared when a document arrives, so sources open fast (RV-4).
