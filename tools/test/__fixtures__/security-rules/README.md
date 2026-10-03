# security-rules fixtures (SC3)

Planted faults and clean twins for R62 to R66. Files named `planted-*` must be caught by the rule; `clean-*` must not.
`.mjs` factories are imported by `tools/test/security-rules.test.mjs`; the `.sql` files are run in a clone by
`src/contracts/security-rules.db.test.ts`, in schema `returns` (so the `refuse_change` function exists). Made-up data only.
