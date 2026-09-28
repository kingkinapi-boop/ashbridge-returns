# 0001: How this build runs (28 September 2026)

Status: in force. Authority: Zo, 28 Sep 2026: "I want the coding to be happening in the background, however, I don't want to be actively involved. [...] I want us (you and me) to come up with a blueprint of what things look like at end state. and then the build keeps working. It only asks me questions that are blueprint altering. otherwise keep me out of it. [...] I like the current setup." Never edit: supersede with a new file.

- **R-1 Blueprint first.** `blueprint/` is the end state. Builders build only what a card asks, and a card asks only for blueprint clauses. The blueprint changes only with Zo's yes (skill `blueprint-change`).
- **R-2 Roles.** Lead (`go`): runs the loop, writes cards, dispatches, merges, keeps the status files; never writes product code. Reviewer (`review`, or a scheduled routine): audits drift, ambers, usage and quality; can slow or hold the build, never raise it. Spec-writer: turns a card into failing acceptance tests. Builder: makes them pass without editing them. Checker: runs the checks and compares the branch with the card. Tester: walks staff screens. Scout: reads and summarises.
- **R-3 Nobody grades their own work.** The spec-writer writes the tests, a builder makes them pass, the checker and the full suite decide.
- **R-4 Zo's part.** He answers red questions in `plan/TODO-ZO.md`, raises the mode, types `go` after a usage reset, and looks at the progress page when he likes. His comments become tests and fixes without follow-up questions.
- **R-5 Resume from anywhere.** `plan/NOW.md` is true at every moment. The Lead writes a dispatch into NOW.md before making it. Any session can be cleared and resumed with `go`.
- **R-6 Background by default.** Builders run in the cloud or in local background worktrees. The Lead checks in on a timer (ScheduleWakeup) and never waits in the foreground.
- **R-7 Kept from the client app build:** the three-section to-do, the 3-line chat endings, status files rewritten not appended, decisions never edited, merges only after independent checks, the push guard and the NOW.md stop hook.
