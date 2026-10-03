// Planted (SC R26): a money function that returns -0 for "(0.00)".

/**
 * Integer cents from "(d.cc)" or "d.cc".
 * @money
 */
export function plantedReadAmount(text) {
  const m = /^(\()?(\d+)\.(\d\d)\)?$/.exec(text)
  if (m === null) return { ok: false, reason: 'not an amount' }
  const cents = Number(m[2]) * 100 + Number(m[3])
  return { ok: true, cents: m[1] === '(' ? -cents : cents }
}

/** A registry entry points here, but the export carries no money tag (planted). */
export function plantedUntagged(text) {
  return { ok: true, cents: text.length }
}
