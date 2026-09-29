# Review prompt: Ashbridge production system design

You are reviewing a system design for Ashbridge Tax. Review it the way a panel of top experts would, all at once:

- A senior Canadian CPA who runs a high-volume T2 practice for owner-managed Ontario corporations.
- An audit quality and controls partner who designs review systems firms can defend.
- A product and workflow designer who has built high-throughput review tools, where speed and accuracy both matter.
- A data and AI engineer who has shipped document extraction, provenance tracking and LLM checking systems in production.
- A pragmatic builder who knows what a first version must include and what can wait.

## The document

Read the full design first:

- Live doc: https://claude.ai/code/artifact/e61d55f9-6f1a-49b2-a46e-82bbc1577112
- If you cannot open the link, use the attached file `ashbridge-production-system-design.md`, or the Project doc `claude/production-system-design-full-2026-09-28.md`. They hold the same content. Diagrams appear as text descriptions.

## Context

- Ashbridge Tax is an AI-native Ontario firm. It prepares T2 corporate returns for owner-managed corporations.
- The client onboarding app is already live (Next.js, Supabase, Netlify, Google Drive for files).
- The tax software is CCH iFirm Taxprep.
- The goal: one CPA reviews a very large number of returns, quickly and with confidence. The CPA clicks any number on the T2 and its source opens, instead of hunting through Drive.
- Preparer hours are cheap. AI capacity is plentiful.
- AI coding agents will build the system in the background. The design must be clear enough for them to build from.
- The owner is not technical. He wants plain language, short sentences and no em dashes.

## Fixed decisions (treat as settled; do not reopen)

1. No Taxprep API. It is too expensive. CSV import and CSV export only.
2. CCH has confirmed all of the following:
   - CSV import can fill any T2 cell, text included.
   - Every cell, including repeating schedules, has an identifier.
   - One saved filter can hold every input cell.
   - The CSV export lists each cell's identifier and value, one export per file.
   - Diagnostics can be printed with the return.
   - Locking a return stops edits.
   - Returns from other software convert and roll forward.
   - Data is hosted in Canada.
   - Security roles can hide SINs.
   - CCH iFirm Digital Signature handles the T183CORP and issues a certificate of completion.
3. Preparers are employees. They never contact clients.
4. No AI talks to clients. The client Q&A has no AI for now. AI works only for the preparer and the CPA.
5. Every file follows the same process. There are no special lanes and no routing to calls.
6. The system works with whatever evidence a file has: a past T2, financial statements, bank statements, articles, CRA access, or only the client's onboarding answers. Nothing is required.
7. The CPA reviews the full return every time. Flags are pinned first and highlighted, but the review is never exceptions-only.
8. The tier rules (green, amber, red) are approved.
9. There is no materiality threshold for now.
10. The learning loop is built on comparing versions: the AI draft CSV, the preparer's export, the CPA-final export and the CRA assessment. It must catch and rank lessons on its own, because people will not drive improvements.
11. Clients authorize the firm's business number with CRA.
12. This is the first build, for busy season. Sampling, planted test files and similar quality-assurance work happen after busy season. They belong on the future ideas list.

## Out of scope (do not comment on these)

Pricing, free vs paid clients, when free clients get CPA review, staffing, CPA capacity or time math, legal and engagement letters, insurance, onboarding screens, go-live dates and timelines, and any person's availability. Do not suggest involving the CPA or any named person. If expert input is needed, list it as a research request the owner can obtain.

## What to judge (use broad judgment; this list is a floor, not a ceiling)

1. **The goal.** Will this make a full CPA review of a T2 fast and trustworthy? What would make it faster or more trustworthy still?
2. **Provenance.** Is the evidence ledger right? Test hard cases:
   - figures built from several sources, allocations, estimates and pure judgment figures;
   - calculated cells, repeating schedules, prior-year columns and rolled-forward values;
   - corrections after lock, and one document feeding many figures.
3. **The CSV round trip.** Where can manual steps fail: wrong file, wrong client, stale export, partial import, cell identifiers changing between Taxprep releases? What should the system check or automate around them?
4. **Checks.** Do the hard ties and AI checks cover the real risk areas for Ontario owner-managed CCPCs? Is anything technically wrong? What belongs in code rather than AI, and the reverse? How are false alarms kept low?
5. **AI design.**
   - Grounding, independence of the red team, hallucination control and prompt injection.
   - How AI accuracy is measured.
   - Where AI adds the most leverage, and where it is overused or risky.
6. **The review screen.** Cognitive load, what the CPA sees first, and how "full review" works in practice without slowing down. Also the preparer's experience.
7. **The learning loop.**
   - Signal quality, and whether causes are assigned correctly.
   - Noise, ranking, and resistance to gaming.
   - How lessons reach the next build.
   - The smallest version that still works.
8. **Simplicity.** What is over-engineered for a first build? What should be cut, merged or deferred? Are the phase gates testable?
9. **Buildability.** Where is the spec too vague for AI coding agents? Which schemas, identifiers, state transitions or contracts must be pinned down first?
10. **Security and data handling,** within the system's own scope.
11. **Missing pieces.** Anything a world-class version of this system would have that this one lacks.
12. **The art of the possible.** Is there a fundamentally better architecture or approach? Say so, even if it means rethinking part of the design.

## Rules

- Verify any tax or technical claim you rely on. If you search, cite the source. Separate fact, inference and guess.
- Say "I don't know" rather than guess.
- Do not invent dates, turnaround times or prices.
- Be adversarial. The owner wants honest pressure-testing, not praise.
- Stay inside the scope above. Before you send anything, check it for out-of-scope comments and remove them.
- Suggest changes only. Do not edit the document.

## Output (keep it tight; the owner does not read long reports)

1. **Verdict:** three sentences at most.
2. **Top 10 improvements,** ranked by impact. For each give: the problem, why it matters, the exact change (ready-to-paste wording for the doc, or a spec), and effort (small, medium or large).
3. **Errors:** anything technically or logically wrong, each with its fix.
4. **Cut or defer:** what to remove from the first build, and why.
5. **Missing:** pieces the design lacks, each with a one-line fix.
6. **Better alternatives:** at most two, each with its trade-off.
7. **Research requests:** only outside information the owner must get, one line each.

Use plain language and short sentences. No em dashes.
