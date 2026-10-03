// Planted (SC R31): the second finding list is built by spreading the first.
export const PLANT_SKIPPED = [
  { identifier: 'IDENT.Ident120', finding: 'FINDINGS.md, silent skips (item 5): the year-start cell is skipped (Test)' },
]
export const PLANT_LISTED = [
  ...PLANT_SKIPPED,
  { identifier: 'IDENT.Ident230', finding: 'FINDINGS.md, filters ("entered", item 9): the language cell is listed (Test)' },
]
