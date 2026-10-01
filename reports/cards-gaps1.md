# Cards: phase 1 review gaps (1 Oct 2026)

Answers bigger issues 1, 5 and 6 of `reports/review-phase1.md`.

## What changed
- **New sample clients:** W14 (clients 11 for K01 and 12 for K05) and W15 (13 for K06; 14 and 15, one corporation's two years, for K13), both M, phase 1, core and security, through the existing generator. The spec job writes the README rows and the `verify.mjs` entries first; the build job writes the builders. Both prove the ten existing clients stay byte-identical. W14 has no deps and can start now; W15 follows W14 (shared verify and README files). W01 and W05 now depend on W14; W06 and W13 on W15. W00's loaders go by folder number, so 11 to 15 load without a W00 change; the kind family names the new folders.
- **Waiting on AI run (V05):** a new blocker "Waiting on AI run" with the date and time the oldest open `ai:*` job was queued, plus "AI run failed" for a dead one; new check 9; deps add F06; clause ARC-5 added. F06's `statusForReturn` now also gives per kind the oldest open job's `created_at` (new check 12).
- **Amalgamation flag (B03):** the client app holds no such field (contract sections 1 and 2), so a bridge field would need a client-app change (red). Chosen: a preparer-entered fact with a reason, `recordReorganisation`, writing E03's new keys `corporation.reorganisation.kind` and `.effective_date` through L00 (purple dot). B03 build, fixture and check 5 rewritten; B03 deps add E03; E03 lists the keys; F07's "Not in this card" says why the bridge has none.
- Tools: `node tools/status.mjs` 233 carded; `node tools/next.mjs 12` can start F00, W14, D01; `node tools/matrix.mjs --plan` PLAN OK. `plan/MATRIX.md` not committed.

## For the Lead
- The screen that calls `recordReorganisation` belongs with the return record (a later card); until then tests and journeys call it. Add it when the return record screen is carded.
- D04's design brief should show the "Waiting on AI run" blocker; D04 is a family card with no file, so it is not edited here.

## Ambers
- New card ids W14 and W15, not W21. Why: W21 is already the bank statements renderer in `plan/slices.json`. Reverse: renumber the two cards and their deps.
- Split into two M cards (11 and 12; 13 to 15). Why: five folders, a no-account client and a two-year roll in one card would pass L. Reverse: merge into one L card.
- K13 is two sample-client folders (14 for 2024, 15 for 2025) for one corporation with one business number. Why: the generator builds one year per client; two folders keep the engine unchanged and let verify prove 15 opens from 14. Reverse: a multi-year client in the engine and one folder.
- K05 (client 12) has no account, QBO or document files; every figure names an onboarding answer; an engine option is allowed only if it keeps clients 01 to 10 byte-identical. Why: "onboarding answers only" means no other evidence (END-6). Reverse: give 12 the client's own QBO books as a second source.
- K01 (client 11) carries a `prior_year` block in its answer key: last year's return as the firm filed and CRA assessed it. Why: "last year is ours" needs B03's source step 1. Reverse: drop the block and build the prior version in W01's kind only.
- Acceptance for W14 and W15 is `verify.mjs` and `make-csv.mjs --check`, with each new check naming its clause, written by the spec job before the build. Why: the sample clients have no Vitest project and the README keeps expectations apart from the generator. Reverse: a Vitest acceptance file over `reference/sample-clients/`.
- W00 loads every numbered folder present, an empty account list for a no-account folder and the optional `prior_year` block. Why: W00 is phase 0 and must not wait for W14 and W15. Reverse: add loaders C11 to C15 in a later card.
- Amalgamation or wind-up is a preparer-entered fact with a reason (`recordReorganisation`, E03 keys `corporation.reorganisation.kind` and `.effective_date`, supplied by `judgment`), not a bridge field. Why: the client app holds no such data, and a bridge field needs a client-app change (red); a fact with a reason is the smaller reversible option and fits EV-5. Reverse: read a bridge column when the client app adds one, keeping the fact as the fallback.
- No reorganisation fact means prior-year values carry as usual (no flag on every return). Why: a flag on every return would be noise, and the red tier already lists amalgamations. Reverse: flag returns with no recorded answer.
- V05 shows "Waiting on AI run" from F06's `statusForReturn`, which now also returns per kind the oldest open job's `created_at`; dead `ai:*` jobs show "AI run failed"; V05 gains dep F06 and clause ARC-5. Why: the queued time had no source and a dead job would otherwise vanish from the queue. Reverse: drop the time and the failed blocker, and the F06 addition.
- B03 depends on E03. Why: it writes E03's new fact keys. Reverse: remove the dep if the keys move to B03's own data.
