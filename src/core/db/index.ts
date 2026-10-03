// PGlite for tests (ARC-4). The db project boots one template per worker in its setup file
// (vitest-setup.ts); a test only clones it. A test body never pays a cold start.
// With TEST_DB=pg16 (cloud checks) the same template API runs on a local Postgres 16 cluster (DB16).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { borrowPg16Template, createPg16Template, testDbTarget } from './pg16'

export { testDbTarget }

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const DEFAULT_SCHEMA_DIR = path.join(REPO_ROOT, 'db', 'schema')

export interface DbTemplate {
  clone(): Promise<PGlite>
  close(): Promise<void>
  /** Postgres 16 only: the template's name, so workers can borrow it, and a drop of it and all its clones. */
  pg16?: { name: string; drop(): Promise<void> }
}

function schemaFiles(schemaDir: string): string[] {
  return fs.existsSync(schemaDir)
    ? fs.readdirSync(schemaDir).filter((f) => f.endsWith('.sql')).sort()
    : []
}

/** Boots PGlite once and applies every *.sql file in name order. Pure: registers nothing. */
export async function createTemplate(schemaDir: string = DEFAULT_SCHEMA_DIR): Promise<DbTemplate> {
  const target = testDbTarget(process.env)
  if (target.kind === 'pg16') {
    const schema = schemaFiles(schemaDir).map((file) => ({ file, sql: fs.readFileSync(path.join(schemaDir, file), 'utf8') }))
    return fromPg16(await createPg16Template(target.url, schema))
  }
  const db = new PGlite()
  try {
    for (const f of schemaFiles(schemaDir)) {
      try {
        await db.exec(fs.readFileSync(path.join(schemaDir, f), 'utf8'))
      } catch (e) {
        throw new Error(`schema file ${f} failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e })
      }
    }
  } catch (e) {
    await db.close()
    throw e
  }
  const template: DbTemplate = {
    clone: async () => (await db.clone()) as PGlite,
    close: () => db.close(),
  }
  // The first clone pays a one-off cost (seconds); pay it here, in the warm-up, not in a test.
  await (await template.clone()).close()
  return template
}

function fromPg16(t: Awaited<ReturnType<typeof createPg16Template>>): DbTemplate {
  return { clone: () => t.clone(), close: () => t.close(), pg16: { name: t.name, drop: () => t.drop() } }
}

/** A worker's template: the one the global setup made when on Postgres 16, else a fresh PGlite one. */
export async function openTemplate(): Promise<DbTemplate> {
  const target = testDbTarget(process.env)
  const name = process.env['DB16_TEMPLATE']
  if (target.kind === 'pg16' && name !== undefined && name !== '') return fromPg16(await borrowPg16Template(target.url, name))
  return createTemplate()
}

let active: DbTemplate | undefined
const clones: PGlite[] = []

/** Used by the db project's setup file only. */
export function setActiveTemplate(template: DbTemplate | undefined): void {
  active = template
}

export function hasActiveTemplate(): boolean {
  return active !== undefined
}

export async function cloneTestDb(): Promise<PGlite> {
  if (!active) throw new Error('db warm-up did not run')
  const db = await active.clone()
  clones.push(db)
  return db
}

/** Closes every clone made since the last call (the db project's afterEach). */
export async function closeClones(): Promise<void> {
  const open = clones.splice(0)
  await Promise.all(open.filter((c) => !c.closed).map((c) => c.close()))
}
