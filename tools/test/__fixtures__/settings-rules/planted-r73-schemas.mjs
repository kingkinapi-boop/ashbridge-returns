// SC5 R73 runtime plant (made up): a recording schema strict at the top whose nested parts drop a stray key.
import { z } from 'zod'

export const RecordingSchema = z.strictObject({
  modelId: z.string(),
  sourceEngine: z.object({ name: z.string(), version: z.string() }),
  pages: z.array(z.looseObject({ page: z.number() })),
  notes: z.record(z.string(), z.strictObject({ text: z.string() }).catchall(z.string())),
  stamp: z.strictObject({ ocrEngine: z.string() }).optional().transform((s) => s),
})

export const CleanRecordingSchema = z.strictObject({
  modelId: z.string(),
  sourceEngine: z.strictObject({ name: z.string(), version: z.string() }),
  pages: z.array(z.strictObject({ page: z.number() })),
  notes: z.record(z.string(), z.strictObject({ text: z.string() })),
  stamp: z.strictObject({ ocrEngine: z.string() }).optional(),
})
