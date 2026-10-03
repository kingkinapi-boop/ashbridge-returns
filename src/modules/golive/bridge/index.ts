// GL3 (ARC-2, LIVE-6): the client-app views and the shared-table grant, a draft for the client repo's Lead.
// Nothing here runs at runtime: tests and the go-live run call it.
export { applyDraft, findNeverRead, probeClientSchema, probeReach, viewDependencies } from './db'
export { parseViewsManifest, readViewsManifest, type ViewsManifest } from './manifest'
export {
  NEVER_READ,
  draftReads,
  findSentenceLiterals,
  missingColumns,
  neverReadFindings,
  reachDiff,
  type ColumnRef,
  type SentenceLiteral,
  type ViewDependency,
} from './scan'
