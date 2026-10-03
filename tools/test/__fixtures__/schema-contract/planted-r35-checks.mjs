// Planted (SC R35): a model check module. checkRolls says "nothing to check" over an empty collection and has a
// planted failing test; checkMarkers returns a silent pass over an empty collection and has no planted test.

/** Every month rolls. */
export function checkRolls(months) {
  if (months.length === 0) return { ok: false, issues: ['nothing to check: no months'] }
  return { ok: months.every((m) => m.opening + m.activity === m.closing), issues: [] }
}

/** Every marker has a catalogue entry. */
export function checkMarkers(rows) {
  return { ok: rows.every((r) => r.marker === undefined || r.catalogued), issues: [] }
}
