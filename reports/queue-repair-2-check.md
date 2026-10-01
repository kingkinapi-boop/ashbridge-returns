# queue-repair-2 check: PASS

Failures: none blocking. Verified: gate behaviour, reopen (lead only), next.mjs waiting-on-deps, 23 tests pass, reverting depGate fails 5 tests, diff vs merge base touches only the 6 listed files.
Minor notes (not failures):
- .claude/skills/dispatch/SKILL.md line 40 does not name the new command `update <card> spec reopened --worker lead` for the findings-review step.
- .claude/cloud-worker-run.md line 7 (release a spec/build whose deps are unmerged) is now rarely reachable; harmless.
- tools/claim.mjs header: the new reopen comment lines sit mid-sentence inside the "until the ... after the findings review" comment (cosmetic).
- No test for "check still flows on a card with a parked dep".
