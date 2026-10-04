// Planted (SC R14): a version stamp schema that accepts {"x":null} and {"x":""}.
import { z } from 'zod'

export const VersionStampSchema = z.record(z.string(), z.any()).refine((v) => Object.keys(v).length > 0)
