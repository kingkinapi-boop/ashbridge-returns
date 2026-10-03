# CQ8 check (local-4, 3 Oct)

FAIL (one failure, a spec gap; the build code itself reads correct).

Checked claude/CQ8 at e09db959 (build 522ae3a0, spec 01c11942 and refit 503c5204), on the laptop.

## Failure
1. Card rule 3 has no acceptance test (checker definition of done, item 4: every acceptance check on the card has a passing test). The card plants "FX10 (Where: cloud) offered to local-1"; `grep -c local- tools/test/next-paths.test.mjs` is 0. The spec report (refit cloud-aab122) and the build report (amber 1) both say so. The builder cannot add it (tests come from another worker), so this needs a spec job: tests for a local-* worker refused a spec, build and check of a `Where: cloud (...)` card and of a `Where: cloud.` card, offered a `Where: cloud, then one laptop run` and a `Where: local or cloud` card, a cloud worker still offered the cloud card, and next.mjs tagging only the cloud card `cloud only`. My read of the rule 3 code (claim.mjs cloudOnly in the check, build and spec loops; next.mjs tag) finds it correct for every Where variant on main; I could not run a throwaway check (the checker hook refuses any file outside reports/).
   Rule candidate: a card whose Spec lists N rules has at least one test named for each rule; the spec job's report lists rule to test, and the checker refuses a spec with an untested rule.

## Passed
- Spec untouched: `git diff 01c11942 HEAD -- tools/test/next-paths.test.mjs tools/test/queue.test.mjs` empty.
- Acceptance: next-paths 8 of 8 and queue 39 of 39 (`node tools/heavy.mjs -- npx vitest run tools/test/next-paths.test.mjs tools/test/queue.test.mjs`, 47 of 47).
- tools/test: 385 of 388 in the full laptop run; the 3 failures were 5 s and 10 s timeouts under load in schema-contract-rules, done-gate and scope-spec-files (none touches the changed files). Rerun alone: 142 of 142 pass, so 388 of 388.
- typecheck: 7 errors, all in src/core/db/index.ts (`pg` missing from the main checkout's node_modules; not this card). lint: tools/ is outside eslint's scope (files ignored). deps:check: no violations.
- `node tools/scope.mjs CQ8`: SCOPE OK, 7 files.
- Rules 1 and 2 read against the code: next.mjs holders (`build working|reported`, `spec working`, untagged) match claim.mjs busyFor (isActive and holds); a reopened check is re-offered and NEEDS_LEAD only matches state released; only `--worker lead` may reopen (exit 6 otherwise).
- No client sentence, no person data, no key or paid service.

## Amber (for the Lead, not failures)
- claim.mjs and next.mjs read a slices.json `where` field differently (claim.mjs stops at `.` or `(`; next.mjs compares the whole string). No card in slices.json has `where` today, so it cannot bite yet; the shared helper should move to lib.mjs (builder amber 2).
- F00's Where line is "a cloud worker", which rule 3 does not treat as cloud only; card writers should keep the "Where: cloud" form.
