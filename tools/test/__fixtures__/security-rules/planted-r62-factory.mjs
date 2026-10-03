// Planted (R62): a factory that picks its stand-in by silence, even in production.
export function createPlantedAdapter(env) {
  const engine = env['PLANTED_ENGINE'] ?? 'standin'
  return { engine }
}
