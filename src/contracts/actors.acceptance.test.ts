// FX17 acceptance tests, the unit-project twin (spec-writer; builders never edit this file). Card plan/cards/FX17.md.
// Mutation testing runs the unit project only (findings A04, A391), so the core behaviour that
// actors.acceptance.db.test.ts proves is proved here too, on a template this file boots itself (no db warm-up in
// the unit project). The shape is the db file's header: the five actor columns take a staff_users id or a name on
// returns.system_actors (id is the name, reason), and refuse anything else with SQLSTATE class 23 naming the table and column.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createTemplate, type DbTemplate } from '../core/db'
import { createAuth } from '../modules/auth'
import { listTestUsers } from '../modules/auth/testing'

const BOOT_MS = 60_000
const TEST_MS = 20_000
const AT = new Date('2026-03-17T10:00:00-04:00')
const TEST_IDS = listTestUsers().map((u) => u.id)

let template: DbTemplate | undefined
const open: PGlite[] = []
beforeAll(async () => {
  template = await createTemplate()
}, BOOT_MS)
afterAll(async () => {
  await Promise.all(open.filter((d) => !d.closed).map((d) => d.close()))
  await template?.close()
})

async function world(): Promise<PGlite> {
  if (!template) throw new Error('template did not boot')
  const db = await template.clone()
  open.push(db)
  await createAuth({ db, env: { NODE_ENV: 'test' }, clock: { now: () => AT } })
  return db
}

let seq = 0
const tid = (p: string): string => `fx17u-${p}-${String(++seq).padStart(6, '0')}`
async function newReturn(db: PGlite): Promise<string> {
  const id = tid('return')
  await db.query(`insert into returns.returns (id, entity_name, year_end, state) values ($1, 'Quillfeather Sample Widgets Inc. (Test)', '2025-12-31', 'intake')`, [id])
  return id
}

interface Column { name: string; table: string; column: string; insert: (db: PGlite, actor: string) => Promise<unknown> }
const COLUMNS: readonly Column[] = [
  {
    name: 'events.actor', table: 'events', column: 'actor',
    insert: (db, a) => db.query(
      `insert into returns.events (id, record_table, record_id, actor, occurred_at, reason) values ($1, 'facts', $2, $3, $4, 'Ticked (Test)')`,
      [tid('event'), tid('fact'), a, AT],
    ),
  },
  {
    name: 'state_events.actor', table: 'state_events', column: 'actor',
    insert: async (db, a) => db.query(
      `insert into returns.state_events (id, return_id, from_state, to_state, actor, occurred_at, reason) values ($1, $2, 'intake', 'evidence', $3, $4, 'Created (Test)')`,
      [tid('state'), await newReturn(db), a, AT],
    ),
  },
  {
    name: 'approvals.approved_by', table: 'approvals', column: 'approved_by',
    insert: async (db, a) => {
      const r = await newReturn(db)
      const v = tid('version')
      await db.query(`insert into returns.versions (id, return_id, version_no) values ($1, $2, 1)`, [v, r])
      return db.query(`insert into returns.approvals (id, return_id, version_id, approved_by, fingerprint) values ($1, $2, $3, $4, $5)`, [tid('approval'), r, v, a, 'a'.repeat(64)])
    },
  },
  {
    name: 'adjusting_entries.author', table: 'adjusting_entries', column: 'author',
    insert: async (db, a) => db.query(
      `insert into returns.adjusting_entries (id, return_id, qbo_snapshot_id, qbo_txn_id, entry_type, reason, author) values ($1, $2, 'snap-0001', $3, 'accrual', 'Accrual (Test)', $4)`,
      [tid('entry'), await newReturn(db), tid('txn'), a],
    ),
  },
  {
    name: 'judgment_inputs.author', table: 'judgment_inputs', column: 'author',
    insert: async (db, a) => db.query(
      `insert into returns.judgment_inputs (id, return_id, cell_id, value, author, reason) values ($1, $2, 'T2S8.CCA.CLASS10', '4200', $3, 'Half-year rule (Test)')`,
      [tid('judgment'), await newReturn(db), a],
    ),
  },
]

async function outcome(p: Promise<unknown>): Promise<{ code: string; text: string } | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    const err = e as { code?: string; message?: string; constraint?: string; detail?: string }
    return { code: err.code ?? '', text: `${err.message ?? ''} ${err.constraint ?? ''} ${err.detail ?? ''}` }
  }
}

describe('SEC-1 SEC-7 unit twin: each actor column takes a staff id or a listed system actor and nothing else', () => {
  test.each(COLUMNS)('SEC-1 $name accepts every test user id and every listed system actor', async (c) => {
    const db = await world()
    const names = (await db.query<{ name: string; reason: string }>('select id as name, reason from returns.system_actors')).rows
    expect(names.length).toBeGreaterThan(0)
    for (const { name, reason } of names) expect(reason.trim().length, name).toBeGreaterThan(10)
    for (const v of [...TEST_IDS, ...names.map((n) => n.name)]) {
      const r = await outcome(c.insert(db, v))
      expect(r, `${c.name} refused ${v}: ${r?.code ?? ''} ${r?.text ?? ''}`).toBeUndefined()
    }
  }, TEST_MS)
  test.each(COLUMNS)('SEC-1 $name refuses an unknown id, a blank and an unlisted system name, naming the column', async (c) => {
    const db = await world()
    for (const v of ['nobody-9 (Test)', '', 'system (Test)', 'Pat Preparer (Test)', ' preparer-1']) {
      const r = await outcome(c.insert(db, v))
      expect(r, `${c.name} accepted ${JSON.stringify(v)}`).toBeDefined()
      expect(r?.code, `${c.name} refused ${JSON.stringify(v)} for the wrong reason: ${r?.text ?? ''}`).toMatch(/^23/)
      expect(r?.text).toContain(c.table)
      expect(r?.text).toContain(c.column)
    }
  }, TEST_MS)
})
