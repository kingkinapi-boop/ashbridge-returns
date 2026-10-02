# G12 spec released (cloud-76f46b, 2 Oct 2026)
Not specced: topic assets-cca has no client-askable fact in data/facts/catalogue.json (the only CCA fact, prior_t2.schedule_8.cca_closing_undepreciated, is document-supplied; no asset purchase, disposal or class fact has suppliedBy onboarding or qa). The vehicle facts belong to G11 (expenses). Acceptance check 2 ("every fact key exists in the catalogue") cannot hold for any item.
Needs the Lead: add the asset facts to the catalogue (for example purchases or disposals of equipment in the year, as boolean or money, supplied by qa), or re-scope the card to a catalogue card plus G12. Then re-offer the spec (mirror claude/G10 and claude/G11 specs).
- Permission gaps: none. Model: Sonnet 5.5.
