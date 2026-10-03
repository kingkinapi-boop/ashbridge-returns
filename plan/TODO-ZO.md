# Zo's to-do (Ashbridge Returns)

Two parts only (decision 0022): what needs you, and what the Lead is doing. Answer in the Lead chat with the item number.

## 1. Needs you

1. **Critic proposals of 3 Oct** (details in `reviews/CRITIC.md`; each is small and can be undone): (1) start the screen designs again now, so you get one design sitting about Tue 6 Oct; (2) fix the queue handing out the same check again and again, and the counts that hide failed checks; (3) start no new build-repair cards until the test world (W00c) lands. Reply in the Lead chat `critic ok`, `critic ok 1 3` or `critic no 2`. Until then the Lead keeps building as now.

## 2. What the Lead is doing now (3 Oct, 13:00 UTC)

Turbo. 54 cards are on main. A batch of three (job queue fix, test tooling) is being checked in the cloud now; four cloud workers and three on this laptop are building. The AI runner failed its last train on a clock mix-up (its deadline read one clock, its wait another); the fix is small and stays in this round, and a new check runs every test with the date moved forward so this kind of fault is caught everywhere. The test-world fixes most of the build waits on are in their last round. Nothing else needs you besides item 1.
