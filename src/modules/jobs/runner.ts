// The runners (ARC-5): the in-process runner and a synchronous test runner over the same handlers,
// so the runner can be swapped. Time comes from the injected clock.
import type { Clock } from '../../core/clock'
import type { Handler, JobQueue, Runner } from '../../contracts/jobs'

export interface RunnerOptions {
  queue: JobQueue
  handlers: Record<string, Handler>
  clock: Clock
  workerId?: string
}

const text = (e: unknown): string => (e instanceof Error ? e.message : String(e))

async function runJob({ queue, handlers, clock, workerId = 'worker' }: RunnerOptions): Promise<boolean> {
  const job = await queue.claim(workerId, undefined, (kind) => handlers[kind]?.leaseMs)
  if (!job) return false
  const handler = handlers[job.kind]
  if (!handler) {
    await queue.fail(job.id, workerId, `no handler for ${job.kind}`, { retry: false })
    return true
  }
  try {
    const input = handler.input.safeParse(job.input)
    if (!input.success) {
      await queue.fail(job.id, workerId, `input: ${input.error.message}`)
      return true
    }
    const out = await handler.run(input.data, { jobId: job.id, attempt: job.attempts, now: clock.now(), returnId: job.return_id })
    const result = handler.result.safeParse(out)
    if (!result.success) {
      await queue.fail(job.id, workerId, `result: ${result.error.message}`)
      return true
    }
    await queue.complete(job.id, workerId, result.data, handler.versions)
  } catch (e) {
    await queue.fail(job.id, workerId, text(e))
  }
  return true
}

/** The in-process runner. */
export function createRunner(options: RunnerOptions): Runner {
  const runOnce = (): Promise<boolean> => runJob(options)
  return {
    runOnce,
    async runUntilIdle() {
      let n = 0
      while (await runOnce()) n += 1
      return n
    },
  }
}

/** The test runner: one job at a time, in order, nothing in flight between calls. */
export function createSyncRunner(options: RunnerOptions): Runner {
  let ran = 0
  return {
    runOnce: async () => {
      const did = await runJob(options)
      if (did) ran += 1
      return did
    },
    async runUntilIdle() {
      const before = ran
      while (await runJob(options)) ran += 1
      return ran - before
    },
  }
}
