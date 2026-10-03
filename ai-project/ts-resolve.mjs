// Lets Node run the repo's TypeScript files by their extensionless import names (the repo writes './runner/runner',
// Node wants './runner/runner.ts'). Used only by ai-once.mjs. Resolution only: nothing here reads or writes data.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    const code = error !== null && typeof error === 'object' ? error.code : undefined
    if ((code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_UNSUPPORTED_DIR_IMPORT') && /^\.{1,2}\//.test(specifier)) {
      for (const suffix of ['.ts', '/index.ts']) {
        try {
          return await nextResolve(specifier + suffix, context)
        } catch {
          // try the next form
        }
      }
    }
    throw error
  }
}
