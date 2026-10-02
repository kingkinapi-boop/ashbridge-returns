# W00a spec report (cloud-91dc0c)
Commit bd30c58 on claude/W00a, validated on main aa35ac9. 663 tests (S5, S6, S7; ARC-8); 644 fail for the right reason, 19 sanity passes.
Retired (old single roll, replaced by B3 two rolls): testworld/model/checks.test.ts:178, :188, :205, :208. Rewritten: checks.test.ts:51, :238, :255; faults.test.ts:11, :15.
Amber: catalogue entries gain roll.cause ('missing'|'duplicate') and marker {field,account,month}; checks 'roll', 'fault-catalogue', 'adjusting-entry', new 'file'. Onboarding source resolves via top-level key of onboarding.json or an answers question_asked.
Note: subagent discarded an uncommitted ledger line (15:08:19Z W00a spec dispatch); Lead should re-log.
Permission gaps: none. Model: spec by Opus subagent (worker on Sonnet).
