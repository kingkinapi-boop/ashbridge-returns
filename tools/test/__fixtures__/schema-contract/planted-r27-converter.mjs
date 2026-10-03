// Planted (SC R27): a converter that passes NaN through to the schema (a ZodError, not a RangeError).
import { z } from 'zod'

const fraction = z.number().min(0).max(1)
const PlantBoxSchema = z.strictObject({ page: z.number().int().min(1), left: fraction, top: fraction, width: fraction, height: fraction })

/**
 * Pixels to a box.
 * @converter
 */
export function plantedPixelsToBox(page, rect, w, h) {
  return PlantBoxSchema.parse({ page, left: rect.x / w, top: rect.y / h, width: rect.width / w, height: rect.height / h })
}
