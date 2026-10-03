# CQ6 spec (cloud-65d267, 3 Oct 2026)
13 tests in tools/test/mutate-harness.test.mjs (ARC-15); 8 fail by name (no harness list, tag read only at line start), 5 pass today as over-reach guards. Validated on main a4c7991: typecheck and lint clean; tools suite 281 of 289 (only the 8 new fail).
Step 6b: none retired (only a new file). Run in a temp git world, base ref local main, stops before Stryker.
Amber: (1) importer scan covers all src and testworld non-test modules, not only changed ones; import forms caught: import, export-from, dynamic import, .js/.ts extension. (2) The family-card half of the goal (A430, "gates no family card") has no bullet in the Spec, so no test; Lead to add if wanted. (3) vitest-setup.ts is at the root, outside the src filter, so it is listed but never printed. (4) CQ4 (dep) is not merged; no CQ4 file is touched.
Model: Sonnet 5.5 (card not core). Permission gaps: none.
