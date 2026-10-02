// The test world's public entry: the ten sample clients (and W14 and W15's), the thirteen kinds, the fault catalogue.
export { loadClient, clientFolders } from './clients/load'
export { listKinds, loadKind, KIND_IDS, type Kind, type KindEntry, type KindId } from './model/kinds'
export { faults, type FaultEntry } from './model/faults'
export { checkRegeneration } from './generate'
export * from './model/index'
