// The jobs contract (F06, ARC-5, ARC-10): what a job is, what a handler is, and the queue and runner
// interfaces other modules use. Other modules import this file, never src/modules/jobs.
import { z } from 'zod'
import { VersionStampSchema } from './records'
import { NonBlankSchema } from './text'

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed', 'dead'] as const
export const JobStatusSchema = z.enum(JOB_STATUSES)
export type JobStatus = z.infer<typeof JobStatusSchema>

/** A kind is `<module>:<step>`. */
export const JobKindSchema = z.string().regex(/^[^:\s]+:[^:\s]+$/, 'a job kind is <module>:<step>')

export const JobSchema = z.object({
  id: NonBlankSchema,
  kind: JobKindSchema,
  return_id: NonBlankSchema.nullable(),
  idempotency_key: NonBlankSchema,
  input: z.unknown(),
  status: JobStatusSchema,
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  run_after: z.date(),
  lease_holder: z.string().nullable(),
  lease_until: z.date().nullable(),
  result: z.unknown(),
  last_error: z.string().nullable(),
  version_stamp: VersionStampSchema.nullable(),
  created_at: z.date(),
  finished_at: z.date().nullable(),
  is_test: z.boolean(),
})
export type Job = z.infer<typeof JobSchema>

/** ARC-10: non-blank scalars only. */
export type VersionStamp = Record<string, string | number>

export interface HandlerContext {
  jobId: string
  attempt: number
  now: Date
  returnId: string | null
}

export interface Handler<I = unknown, R = unknown> {
  kind: string
  input: z.ZodType<I>
  result: z.ZodType<R>
  /** Lease length in milliseconds; none means the queue's 10 minute default. */
  leaseMs?: number
  /** ARC-10: the stamp of what produces the result, written when the job is done. */
  versions: VersionStamp
  run(input: I, ctx: HandlerContext): R | Promise<R>
}

export interface StatusCounts {
  queued: number
  running: number
  done: number
  failed: number
  dead: number
}

export interface ReturnJobStatus {
  counts: Record<string, StatusCounts>
  dead: { id: string; kind: string; last_error: string | null }[]
  /** Per kind, the oldest created_at among jobs still queued or leased; a kind with none has no key. */
  oldestOpen: Record<string, Date>
}

export interface JobQueue {
  enqueue(kind: string, key: string, input: unknown, returnId?: string): Promise<Job>
  claim(workerId: string, kinds?: readonly string[], leaseMsFor?: (kind: string) => number | undefined): Promise<Job | null>
  complete(id: string, workerId: string, result: unknown, versions: VersionStamp): Promise<Job>
  fail(id: string, workerId: string, error: string, options?: { retry?: boolean }): Promise<Job>
  statusForReturn(returnId: string): Promise<ReturnJobStatus>
}

export interface Runner {
  /** Runs one due job; false when nothing is due. */
  runOnce(): Promise<boolean>
  /** Runs due jobs until none is due at the clock's now; returns how many ran. */
  runUntilIdle(): Promise<number>
}
