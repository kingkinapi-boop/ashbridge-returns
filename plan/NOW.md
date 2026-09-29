# NOW

True at every moment. 60 lines max. Last rewritten: 29 Sep 2026, evening.

## State

- ON HOLD for a plan review. Zo asked a Critic chat (29 Sep) to review the whole plan and system before building. The review and his answers live in one doc: https://claude.ai/code/artifact/754b9ceb-5cb2-4743-b887-7ebeabf075b4 . Research behind it: reference/research/INDEX.md. Until Zo answers and the Critic finalises the plan: no F00, no rehearsal, no turbo, no new cards. If Zo types `go`, say "Waiting on the plan review." and stop.
- Mode: prep (plan/mode.json). Nothing runs in the cloud. Turbo only on Zo's code `turbo on` (decision 0007); he said "just setting up" tonight.
- Blueprint v1 DRAFT (216 clauses), waiting on Zo (TODO-ZO 1). Decision 0006 proposed; 0007 in force (his answers tonight).
- Repo on GitHub (kingkinapi-boop/ashbridge-returns, private), pushed. ashbridge-app cleared of this build; memories moved to this project's memory folder.
- Cards: 255 in 17 waves (widest 36). Carded: P01 (done), F00 to F05, F07, SK0, D00, D01, and every family card (templates in plan/cards/families/). `node tools/matrix.mjs --plan` is clean.
- Research in reference/: lessons-deep.md (23 patterns), build-practices.md (74 items), design-basis.md, onboarding-contract.md (P01).
- Tools tested tonight: claim.mjs (race of four workers: four different jobs), protect-spec hook (builder refused on acceptance tests; checker refused outside reports/), budget-guard (pause refuses, turbo allows), next, status, matrix --plan, scope, metrics --dry.
- Budget: Max 20x resets Thu 1 Oct and Thu 8 Oct, plan ends Sat 10 Oct (amber A9); one extra reset; cloud credit $240 to 5 Nov, spent first by cloud work (decision 0007 Z-9).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| none | | | | |

## Next, in order

0. The plan review first (see State). Its findings change items 1 to 7 below: Zo's own build order (prove the Taxprep round trip first) comes back, the queue needs repairs before any scale, and new roles (Critic, Value, design research, research pairs) join. The Critic rewrites this list, the README and TODO-ZO once Zo answers.
1. Zo's "blueprint ok": write the decision putting 0006 in force (quote him); slices.json blueprint "v1"; mode prep to normal only when F00 is merged (skill modes).
2. F00 locally (Lead dispatches one local worker; spec n/a). Then enable Dependabot alerts (card step).
3. The rehearsal (skill modes): create routine returns-worker-1 only, one small card end to end, a train, landing, the Reviewer routine once. Fix every prompt in .claude/settings.json. Record the result here.
4. Create the returns-review routine (daily in normal) after the rehearsal.
5. Write the next cards: F06, F08, F09, W00, W20, S00, S01, S02, A01 to A07, JH0, U00 (next.mjs lists them). Spec jobs for the first wave (prep allows 2 at once).
6. A card review of phase 1 by an independent worker before its first spec job (CLAUDE.md loop 2).
7. D00 and D01, then D02 to D10, then the design look for Zo (D11).

## Watch out

- The main checkout stays on main; train work in .claude/worktrees/train (hook enforced).
- Heredocs in Git Bash mangle backslashes: edit files with the Edit tool, not shell scripts with escapes.
- Another Lead works in ashbridge-app. Read-only there, always. The client app's migrations moved on 28 Sep (0033, 0034): F07 re-checks against the latest.
- GitHub Actions free minutes: 2,000 a month on a private repo; checks skip docs-only pushes and the claims, train and review branches.
