// @mutate
// Stryker disable all: a strict reader of db/bridge/views.json, whose whole content the spec pins (draft.acceptance.test.ts: readViewsManifest() equals the spec manifest); its patterns decide no read and no right.
// GL3 (ARC-2): db/bridge/views.json, read strictly. An unknown key anywhere is refused, not stripped.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { NonBlankSchema } from '../../../contracts/text'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
export const DRAFT_DIR = path.join(REPO_ROOT, 'db', 'bridge')

const Ident = z.string().regex(/^[a-z][a-z0-9_]*$/)
const Dotted = z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/)

const SourceSchema = z.strictObject({
  source: Dotted,
  /** the contract's cite for the column ("M0002:50"); null only for a key column the contract does not cite */
  cite: z.string().regex(/^M\d{4}:\d+$/).nullable(),
})

export const ViewsManifestSchema = z.strictObject({
  contract: z.strictObject({ clientAppCommit: NonBlankSchema, lastMigration: z.number().int() }),
  views: z
    .array(
      z.strictObject({
        name: Ident,
        columns: z.array(z.strictObject({ name: Ident, sources: z.array(SourceSchema).min(1) })).min(1),
        alsoReads: z.array(SourceSchema),
        derived: z.array(
          z.strictObject({
            field: Ident,
            rule: NonBlankSchema,
            from: z.array(Dotted).min(1),
            cite: z.string().regex(/^(M\d{4}:\d+|U\d{1,2})$/),
          }),
        ),
      }),
    )
    .min(1),
})

export type ViewsManifest = z.infer<typeof ViewsManifestSchema>

export function parseViewsManifest(raw: unknown): ViewsManifest {
  return ViewsManifestSchema.parse(raw)
}

export function readViewsManifest(): ViewsManifest {
  return parseViewsManifest(JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'views.json'), 'utf8')) as unknown)
}
