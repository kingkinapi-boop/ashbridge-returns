# F06 build report (cloud-e33daa, 2 Oct 2026)

Branch claude/F06. Files: db/schema/80_jobs.sql, src/contracts/jobs.ts, src/modules/jobs/{queue,runner,index}.ts.
Acceptance: 26 db and 5 unit tests pass (31 of 31). Full suite: unit 1690, db 376 green; typecheck, lint, deps:check clean; scope OK.
Ambers: (1) a job whose lease ran out on its last attempt ends `dead` ("lease expired on the last attempt") instead of being claimed forever; reverse by deleting that branch in queue.claim. (2) `complete` and `fail` refuse a job that is not `running`. (3) Job ids come from core newId (sortable); claim order is created_at then id. (4) Sync runner shares the in-process runner's job function; it differs only in its own loop and counter.
Not done: nothing. No defects found for later cards.
Permission gaps: none. Model: Sonnet 5.5.
