// Planted (SC R15, list side): the status enum leaves out one value of its records list.
import { z } from 'zod'

export const PLANT_STATUSES = ['proposed', 'preparer_verified', 'cpa_accepted']
export const PLANT_ORIGINS = ['third_party', 'judgment']

export const PlantRecordSchema = z.strictObject({
  id: z.string(),
  status: z.enum(['proposed', 'preparer_verified']),
  origin: z.enum(['third_party', 'judgment']),
})
export const PlantFreeTextSchema = z.strictObject({ id: z.string(), state: z.string() })
