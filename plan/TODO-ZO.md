# Zo's to-do (Ashbridge Returns)

Two parts only (decision 0022): what needs you, and what the Lead is doing. Answer in the Lead chat with the item number.

## 1. Needs you

Nothing now. (Critic proposals of 3 Oct: you said "critic ok"; the Lead applies them.)

## 2. What the Lead is doing now (3 Oct, 13:00 UTC)

Turbo. 54 cards are on main. A batch of three (job queue fix, test tooling) is being checked in the cloud now; four cloud workers and three on this laptop are building. The AI runner failed its last train on a clock mix-up (its deadline read one clock, its wait another); the fix is small and stays in this round, and a new check runs every test with the date moved forward so this kind of fault is caught everywhere. The test-world fixes most of the build waits on are in their last round. Nothing else needs you.

**Reviewer, 3 Oct 13:15 UTC:** mode lowered from turbo to normal (too few cards ready to build; one test class passed only on one date). Today is past normal's cap, so no new worker starts before 8 pm Toronto. Details in `reviews\REVIEW.md`. Type `turbo on` in the Lead chat once the Lead says its four quick fixes are done; nothing is lost by waiting.
