# 0004: Usage modes and the October budget (28 September 2026)

Status: in force. Authority: Zo, 28 Sep 2026: "I need you to put in an ultra usage mode where we are not wasting usage but where we go all out [...] between 1st and 8th I use all 20x twice, including reset and then once more between the 8th and 10th. [...] we need to use the cloud sessions as much as possible. but the all out thing needs to be an option that I intentionally unleash." Never edit: supersede.

- **M-1** Five modes: pause, prep, steady, ultra, wind-down (skill `modes` has the table). The mode lives in `plan/mode.json`.
- **M-2** Only Zo raises the mode. The Lead lowers it when a usage limit stops work (to pause, with `resume_to` set), when the Reviewer says SLOW or HOLD, or at the wind-down time.
- **M-3** A hook (`.claude/hooks/budget-guard.mjs`) logs every dispatch to `plan/ledger.jsonl` and refuses dispatches over the mode's daily cap. The statusline copies live plan usage to `plan/usage-now.json` when Claude Code provides it.
- **M-4** Calendar, read as October 2026 because 10 September had passed when Zo wrote it (amber A9): prep to 30 Sep; weekly resets Thu 1 Oct and Thu 8 Oct; Zo holds one extra reset; the plan ends Sat 10 Oct; wind-down starts Fri 9 Oct 18:00 Toronto time.
- **M-5** What pays: Anthropic's docs say cloud sessions and routines share the Max plan's limits with local sessions (code.claude.com/docs/en/claude-code-on-the-web, /routines). The client app's notes of 24 Sep say cloud sessions first draw on a $250 cloud credit, valid to 5 Nov 2026. The two disagree; the modes do not depend on which is right. Ultra runs every slot until something stops it, and the Lead records what actually stopped it.
- **M-6** Ultra never lowers quality: the three checks before merge stay. It raises parallel builders, not risk.
