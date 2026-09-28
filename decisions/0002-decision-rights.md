# 0002: Who decides what (28 September 2026)

Status: in force. Authority: Zo, 28 Sep 2026: "I only answer red questions. not green or amber. Let's come up with a system where the the Lead can answer most questions itself and where it is amber, it keeps a tally for me to review at a later date. [...] I would like for you to make executive decisions where you can." Never edit: supersede.

## Green: the Lead or a helper just does it
Anything the card and the blueprint settle.

## Amber: the Lead decides, logs one row, moves on
Anything inside the blueprint that it does not settle. One row in `plan/AMBER.md`: what, why, how to reverse. Zo reviews the tally when he likes ("amber ok", or "amber reverse A7"). Nothing waits on it. Examples: a library; a table or field name; a screen layout inside blueprint 06; the testable meaning of an approved tier term; a constant such as a hold timeout; the order of cards; splitting a card; lowering the mode; a tax rule interpretation that cites a CRA or statute source and raises a flag rather than passing anything.

## Red: ask Zo in TODO-ZO section 1, park only what it blocks, keep building
Only these:
1. It would add, remove or change the meaning of a blueprint clause.
2. It costs money, or connects or signs up for any paid service or account.
3. It touches the live client app, the live database, or any live data.
4. It changes who can see what, sign-in, or where data is kept (including data leaving Canada).
5. It would bring real client data into the build.
6. It is client-facing wording (batched into one approval before go-live; never blocks the build).
7. It contradicts a decision in `decisions/`.

Each red item names the clause or decision, asks one question, gives the Lead's recommendation, and says what the Lead does meanwhile. At most 3 open at once. Ten or more open ambers on one blueprint file become one red amendment, not ten questions.

## Tie-breakers for amber, in order
The blueprint; `decisions/`; the smaller reversible option; a flag for a person rather than a silent pass; code before AI; data before code for rules that change; a free stand-in before waiting on anyone; the client app's patterns.
