// The bridge module's public exports (ARC-2, ARC-7). Other modules use src/contracts/bridge.ts.
export { formatClientRef, parseClientRef } from './client-ref'
export { returnYearEnd } from './year-end'
export {
  listBridgeReturns,
  listClientRefs,
  listOpsItems,
  runBridge,
  type BridgeReturn,
  type BridgeRun,
  type CreatedReturn,
  type OpsItem,
  type SkippedEntity,
} from './run'
