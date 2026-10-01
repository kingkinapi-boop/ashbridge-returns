# Phase 1 cards, batch a

1 Oct 2026. Helper drafting cards for the Lead. Branch `claude/cards-phase1a`. Read: CLAUDE.md, `.claude/rules/testing.md`, `blueprint/README.md`, blueprint 00, 03, 05 (AI), 08, 09, `plan/slices.json`, the reviewed phase 0 cards (F00, F01, F04, F09, W00, A01, SK0, JH0), `plan/cards/families/render.md` and `kind.md`, `reports/review-phase0.md`, `reference/onboarding-contract.md` (Drive shape), decision 0008.

## Cards

| Card | Size | Tags | Deps | One line |
|---|---|---|---|---|
| F06 | M | none | F01 | Jobs table, idempotent keys, fixed backoff, leases, dead jobs kept, status per return; interface in `src/contracts/jobs.ts`. |
| F10 (new) | M, hard | none | F06, SK0, A05 | The pipeline composition root `src/pipeline/`; the skeleton moves onto it with its stubs injected from test code. |
| W20 | M | security | W00, F09, A01 | Renderer framework: pdf-lib layout, answer files with F09 boxes, deterministic bytes, `toScan` for image-only copies. |
| A02 | M | core | A01, F09, W20 | Tesseract (tesseract.js, local language data, no network) for pages with no text layer. |
| A03 | S | core | A01, F09 | Recorded reading results keyed by fingerprint; missing or stale fails "re-record", never falls back. |
| A04 | M, hard | core, security | F04, F06 | AI runner: recorded answers, the Claude project exchange folder (inbox and outbox), redaction stamp required, approved-triples gate, no API engine. |
| A05 | S | security | F00 | Write-once content-addressed file store and a read-only Drive stand-in shaped like the client app's folders; live slots off. |

After the update: `node tools/status.mjs` shows carded 205, to write 60, done 2 of 280. `node tools/next.mjs 12` starts F00 and D01; next cards to write: A06 A07 U00 L00 L01 E00. `node tools/matrix.mjs --plan` gives PLAN OK.

## The composition root (review-phase0 issue 1 and 3)

- Decided: `src/pipeline/` (card F10), outside `src/modules/`, so F00's module rule still holds unchanged. It imports only `src/contracts`, `src/core` and each module's `index.ts`; no module imports it; modules take other services (jobs, storage, reading, AI) as contract interfaces passed in. `src/app/` calls the pipeline for cross-module work. `src/pipeline/testing.ts` (step overrides) is importable only from `e2e/**` and tests. The rule goes into `.dependency-cruiser.cjs` (F10 lists it).
- One file per step (`src/pipeline/steps/<step>.ts`, nine steps); F10 writes all nine, with `read` (A01) and `taxprep` (the S00 simulator as the stand-in) real and seven "not built" placeholders, so step cards each replace one file and never share a register. F10 also writes `e2e/steps/<step>.ts` as thin calls into the pipeline, and JH0's harness takes its order from `src/pipeline/order.ts`.
- Cards that replace SK0 stubs, now listing `e2e/skeleton/stubs.ts`, `e2e/skeleton/stubs.md` and `e2e/steps/skeleton-*.ts` plus their step file in slices.json, with a dep on F10: E01 (fact), T01 (figure, import file), M00 (mapping row), T04 (trace), Q00 (tie). E00 (`intake.ts`) and B05 (`books.ts`) gain their step file and the F10 dep. I00 gains `src/modules/ai/index.ts` (A04 creates it). These cards share skeleton paths, so they run one after another.

## Ambers (one line each: what; why; reverse)

- F10: the composition root is `src/pipeline/`, one file per step, stubs injected only from test code. Why: keeps F00's module rule as is and gives step cards no shared register. Reverse: server actions in `src/app` as the root, or a named `src/modules/pipeline` exception.
- F10 adds a `facts` step between `read` and `books` and a `taxprep` step name for JH0's "simulator round trip", with JH0's order read from `src/pipeline/order.ts`. Why: extraction is its own card (E01) and the product's Taxprep adapter is the simulator only as a stand-in (ARC-6). Reverse: keep JH0's eight names and fold facts into read.
- Modules never import each other's services; they take contract interfaces (jobs, storage) as parameters, so F06 adds `src/contracts/jobs.ts` and A05 adds `src/contracts/storage.ts`. Why: F00's boundary rule. Reverse: a boundary exception for jobs and storage.
- F06: fixed backoff 1, 4, 16 minutes with no jitter, max 3 attempts, 10-minute lease, jobs never deleted. Why: pinned tests (ARC-16) and nothing lost. Reverse: seeded jitter, other limits.
- W20: pdf-lib for writing, pdfjs-dist with @napi-rs/canvas for rasterising (all free, MIT or Apache); scan bytes are compared only on the same platform and committed only from the cloud Linux runner. Why: rasterisers differ by platform. Reverse: another library, or commit scans from the laptop.
- W20 depends on A01 and F09 to prove every placed value through the real reader. Why: the render family's check 2 needs a text-layer reader, and one box shape. Reverse: read the text layer with pdfjs in the test.
- A02: tesseract.js with the English data from a pinned npm package, rasterised at 300 dpi, a 9 of 10 amounts threshold on a clean synthetic scan, 60-second page cap, depends on W20 for its scan fixtures. Why: free, no network, real-looking scans. Reverse: native Tesseract in the cloud image, or committed scan fixtures.
- A02 and A03 add their engines to A01's `src/modules/ocr/index.ts` (in their paths); joining text-layer and Tesseract pages for one document is E00's. Why: one switch; F09's result has one engine per result. Reverse: a per-page engine field in F09.
- A04: the Claude project exchange is a folder (`AI_EXCHANGE_DIR`, `inbox/` and `outbox/`), off by default, made-up returns only until go-live; no API engine at all. Why: decision 0008 Z8-11 and ARC-22 with nothing paid. Reverse: a different exchange (a table the project reads) behind the same engine.
- A04 refuses any job without a redaction stamp, and any (step, prompt version, model) not in `data/ai/approved.json` (empty at first; I40 fills it). Why: AI-9 before any AI call, AI-11 gate, a flag rather than a silent pass. Reverse: drop the checks until I00 and I40.
- A05: content-addressed, write-once local store (no overwrite, no delete) and a read-only Drive stand-in in the client app's folder shape. Why: binders freeze later (FLOW-9) and the Shared Drive is read-only (ARC-6). Reverse: a plain keyed store with overwrite.
- Tags: A02, A03 core (citation words); A04 core and security; A05 and W20 security; F06 and F10 untagged. Reverse: change the tags.

## For the Lead

1. No card sets up the Claude project itself (its orders and rules, and permission to write only `outbox/`). A04 builds Returns' side and a fake project. Suggest one small card before the first real AI step (I00 or I40), possibly with a TODO-ZO note, since Zo runs it on his subscription.
2. F06 has no `security` tag although it adds a table; its RLS check is in the card. Tag it if you want the security review.
3. The next cards to write are A06 A07 U00 L00 L01 E00; E00 and L00 should repeat F10's rule (take services as contract interfaces) in their Build.

## Red

None. Nothing costs money, touches live data or the client app, or carries client wording. The Claude project exchange stays off and runs made-up data only.
