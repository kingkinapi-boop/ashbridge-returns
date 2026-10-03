// Clean twin (R62): production with the setting unset refuses, naming the setting.
export function createCleanAdapter(env) {
  if (env['NODE_ENV'] === 'production' && !env['CLEAN_ENGINE']) throw new Error('CLEAN_ENGINE must be set in production')
  return { engine: env['CLEAN_ENGINE'] ?? 'standin' }
}
