// Planted (R62, A452 item 9, L3): refuses an unset setting in production but takes a blank one as the stand-in.
export function createBlankAdapter(env) {
  if (env['NODE_ENV'] === 'production' && env['BLANK_ENGINE'] === undefined) throw new Error('BLANK_ENGINE must be set in production')
  return { engine: env['BLANK_ENGINE'] || 'standin' }
}
