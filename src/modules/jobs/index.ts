// The jobs module's public exports (F06): the queue and the runners. Other modules use the
// contract in src/contracts/jobs.ts; the handlers are wired in src/pipeline (F10).
export { createJobQueue, backoffMs, DEFAULT_LEASE_MS } from './queue'
export { createRunner, createSyncRunner } from './runner'
export type { RunnerOptions } from './runner'
