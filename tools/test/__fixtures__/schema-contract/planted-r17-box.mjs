// Planted (SC R17): a contract with its own {x0, y0, x1, y1} box, used as a box field.
import { z } from 'zod'

export const CornerBoxSchema = z.strictObject({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() })
export const CitationSchema = z.strictObject({ text: z.string(), box: CornerBoxSchema })
