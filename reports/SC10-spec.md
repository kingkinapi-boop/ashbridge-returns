
## Patch (cloud-92d46e, 3 Oct): A490
Spec commit e578b6e2, validated on main dfd09276. Deleted the R85 KNOWN entries F00T, V10, SC3 and their three lines in the expected-entries test; nothing else changed. card-rules.test.mjs: 27 of 27 pass (no stale KNOWN entry); lint clean. KNOWN now: R86 FX7 and five R89 guards.
Tests step 6b retired: none. Permission gaps: none. Model: Sonnet 5.5.

## Toolchain refit (3 Oct 2026, cloud-1fcc74)
Merged origin/main (validated on main bd5ec11); no assertion changed. Typecheck, lint and the unit project green (2890 pass). Permission gaps: none. Model: Sonnet 5.5.
