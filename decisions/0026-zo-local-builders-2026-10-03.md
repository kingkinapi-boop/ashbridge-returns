# 0026: Two to three local builders on this computer (3 October 2026)

Status: in force. Authority: Zo, 3 Oct 2026, about 03:35Z. Quotes are his words. Never edit: supersede.

- **Z26-1** "make sure this is not lost when you are compacted or cleared: this computer is not running anymore builds and has capacity to run 2-3 builders. let's use the compute on this computer as well if it helps speed things up."
- The laptop may run up to three local queue workers (plan/mode.json `local_workers` 3), besides the Lead, its short helpers and the one Chrome walker, whenever the queue has jobs. Supersedes the "two local workers" of 0018 Z18-2 and CLAUDE.md's "at most two local workers". Cloud workers stay first (0009); local workers add to them, never replace them.
- Lead's choices inside it (amber A399): local workers take any job, core included (the worker orders already start an Opus subagent for core specs and adversarial checks); `heavy_slots` rises from 1 to 2 so three workers do not queue behind one test run; the Lead drops back to two local workers if Zo says the laptop is slow or a heavy run times out.
