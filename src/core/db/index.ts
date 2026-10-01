// PGlite for tests (ARC-4): schema loaded once per worker, cloned per test.
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const SCHEMA_DIR = path.resolve(process.cwd(), 'db/schema')
let template: PGlite | undefined

async function loadTemplate(): Promise<PGlite> {
  const db = new PGlite()
  const files = fs.existsSync(SCHEMA_DIR)
    ? fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.sql')).sort()
    : []
  for (const f of files) await db.exec(fs.readFileSync(path.join(SCHEMA_DIR, f), 'utf8'))
  return db
}

export async function cloneTestDb(): Promise<PGlite> {
  template ??= await loadTemplate()
  return (await template.clone()) as PGlite
}
