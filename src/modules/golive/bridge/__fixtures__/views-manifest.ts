// GL3 (spec-writer): the shape of db/bridge/views.json, owned by the spec. The build writes the file and its
// own strict parser (parseViewsManifest); the tests read the file through this schema, so the two agree.
//
// {
//   "contract": { "clientAppCommit": "<BRIDGE_CONTRACT.clientAppCommit>", "lastMigration": <BRIDGE_CONTRACT.lastMigration> },
//   "views": [
//     {
//       "name": "corporation",                        // the view is bridge.<name>
//       "columns": [                                  // the view's columns, in the view's own order
//         { "name": "legal_name", "sources": [ { "source": "corporations.legal_name", "cite": "M0002:50" } ] },
//         ...                                         // a union column lists one source per branch
//       ],
//       "alsoReads": [ { "source": "entities.kind", "cite": "M0029:24" } ],   // read in joins and filters only
//       "derived": [                                  // F07 fields the live reader derives from view columns
//         { "field": "services", "rule": "...", "from": ["t2_return.service", "t2_return.corporation_id"], "cite": "M0003:83" }
//       ]
//     }
//   ]
// }
//
// A source is "<client-app table>.<column>" with the contract's cite for that column; cite null is allowed only
// for a key column the contract does not cite (id or corporation_id, for example on the v1 tables).
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { REPO_ROOT } from './contract'

const Ident = z.string().regex(/^[a-z][a-z0-9_]*$/)

export const SourceSchema = z.strictObject({
  source: z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/),
  cite: z.string().regex(/^M\d{4}:\d+$/).nullable(),
})

export const ManifestSchema = z.strictObject({
  contract: z.strictObject({ clientAppCommit: z.string().min(1), lastMigration: z.number().int() }),
  views: z
    .array(
      z.strictObject({
        name: Ident,
        columns: z.array(z.strictObject({ name: Ident, sources: z.array(SourceSchema).min(1) })).min(1),
        alsoReads: z.array(SourceSchema),
        derived: z.array(
          z.strictObject({
            field: Ident,
            rule: z.string().min(1),
            from: z.array(z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/)).min(1),
            cite: z.string().regex(/^(M\d{4}:\d+|U\d{1,2})$/),
          }),
        ),
      }),
    )
    .min(1),
})

export type Manifest = z.infer<typeof ManifestSchema>

export const DRAFT_DIR = path.join(REPO_ROOT, 'db', 'bridge')
export const VIEWS_JSON = path.join(DRAFT_DIR, 'views.json')
export const DRAFT_SQL_FILES = ['0001_bridge_views.sql', '0002_grants.sql'] as const

/** The raw JSON of views.json (unknown, for strictness tests). */
export function rawManifest(): unknown {
  return JSON.parse(fs.readFileSync(VIEWS_JSON, 'utf8')) as unknown
}

/** views.json parsed with the spec's strict schema. */
export function manifest(): Manifest {
  return ManifestSchema.parse(rawManifest())
}

const split = (s: string): { table: string; column: string } => {
  const [table = '', column = ''] = s.split('.')
  return { table, column }
}

/** Every client-app column one view reads: its columns' sources and its alsoReads. */
export function viewReads(view: Manifest['views'][number]): { table: string; column: string }[] {
  return [...view.columns.flatMap((c) => c.sources), ...view.alsoReads].map((s) => split(s.source))
}

/** Plain string order (code units), table first, then column. */
export function byTableThenColumn(a: { table: string; column: string }, b: { table: string; column: string }): number {
  if (a.table !== b.table) return a.table < b.table ? -1 : 1
  if (a.column !== b.column) return a.column < b.column ? -1 : 1
  return 0
}

/** Every client-app column the drafts read, deduplicated, sorted by table then column (plain string order). */
export function allReads(m: Manifest): { table: string; column: string }[] {
  const keys = new Set(m.views.flatMap(viewReads).map((r) => `${r.table}.${r.column}`))
  return [...keys].map(split).sort(byTableThenColumn)
}
