/** A module under src/modules/<m>/ imports only src/contracts, src/core and its own folder (ARC-7). */
module.exports = {
  forbidden: [
    {
      name: 'module-boundary',
      severity: 'error',
      comment: 'ARC-7: modules import only src/contracts, src/core and themselves.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/',
        pathNot: ['^src/contracts/', '^src/core/', '^src/modules/$1/'],
      },
    },
  ],
  options: { tsConfig: { fileName: 'tsconfig.json' }, doNotFollow: { path: 'node_modules' } },
}
