// PGlite for tests (ARC-4). The db project boots one template per worker in its setup file
// (vitest-setup.ts); a test only clones it. A test body never pays a cold start.
// A Postgres 16 backend can sit behind DbTemplate later (not built here).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const DEFAULT_SCHEMA_DIR = path.join(REPO_ROOT, 'db', 'schema')

export interface DbTemplate {
  clone(): Promise<PGlite>
  close(): Promise<void>
}

function schemaFiles(schemaDir: string): string[] {
  return fs.existsSync(schemaDir)
    ? fs.readdirSync(schemaDir).filter((f) => f.endsWith('.sql')).sort()
    : []
}

/** Boots PGlite once and applies every *.sql file in name order. Pure: registers nothing. */
export async function createTemplate(schemaDir: string = DEFAULT_SCHEMA_DIR): Promise<DbTemplate> {
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
