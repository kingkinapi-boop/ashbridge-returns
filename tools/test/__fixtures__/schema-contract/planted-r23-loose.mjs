// Planted (SC R23): the outer object is strict, the nested one is plain z.object and drops a stray key.
import { z } from 'zod'

export const PlantedEnvelopeSchema = z.strictObject({
  name: z.string(),
  inner: z.object({ amount: z.number().int() }),
})
export const PlantedStrictSchema = z.strictObject({ name: z.string(), inner: z.strictObject({ amount: z.number().int() }) })
