// SC5 R101 plant (made up): F01's stamp record, keyed by a non-blank string that takes the prototype names.
import { z } from 'zod'

const NonBlank = z.string().refine((s) => s.trim() !== '')
const stampRecord = z.record(NonBlank, z.union([NonBlank, z.number()]))

export const StampSchema = z.unknown().pipe(stampRecord)
export const SlotsSchema = z.strictObject({ slots: z.record(z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,79}$/), z.string()) })

const PROTOTYPE_NAMES = new Set(['__proto__', 'constructor', 'prototype'])
const SafeKey = z.string().refine((k) => !PROTOTYPE_NAMES.has(k), { message: 'a prototype name is not a key (Test)' })
export const CleanStampSchema = z.unknown().pipe(z.record(SafeKey, z.union([NonBlank, z.number()])))
