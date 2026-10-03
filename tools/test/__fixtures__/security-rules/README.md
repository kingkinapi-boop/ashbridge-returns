# security-rules fixtures (SC3)

Planted faults and clean twins for R62 to R66. Files named `planted-*` must be caught by the rule; `clean-*` must not.
`.mjs` factories are imported by `tools/test/security-rules.test.mjs`; `.ts.txt` files are scanned as text; the `.sql`
files are run in a clone by `src/contracts/security-rules.db.test.ts`, in schema `returns` (so `refuse_change` and
`is_handoff_id` exist). Made-up data only.

`harness.ts` is not a fixture: it holds the rule functions and reviewed lists (FREE_TEXT, KNOWN, FORMAT_FUNCTIONS,
NOT_SETTINGS, INVENTORY, REGISTRY, LANDING) that both rule files import, so every db rule has a unit twin (A391, A452).
It lives here because this folder is in SC3's Paths; SC7 and SC9 move shared helpers to `tools/test/lib/`.

The lists owners may edit in `harness.ts` (FREE_TEXT, INVENTORY.notAdapter, APPEND_ONLY_SENTINEL, the R66 KNOWN
columns per owner) are pinned in `tools/test/security-rules.test.mjs`, outside the owners' Paths: an owner can delete
its own lines, never add one (A458 G6).
