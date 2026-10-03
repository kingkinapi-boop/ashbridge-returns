// FX3 acceptance tests, the bridge's blank rule (spec-writer; builders never edit this file).
// Card plan/cards/FX3.md defect 6: src/modules/bridge/run.ts decides whether outstanding_years holds
// text with its own .trim() rule, so a value made only of invisible characters (blank by text.ts, not
// by .trim()) raised an "unfiled years" ops item for a client who said every year is filed (EV-1: one
// blank definition, src/contracts/text.ts; END-1). SC R41 is the source scan; these are its behaviour
// tests. They run in the unit project on a PGlite booted here by createTemplate (the real schema), so
// mutation testing, which runs the unit project only, reaches run.ts (findings A04, A391).
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { isBlank } from '../../contracts/text'
import { fixedClock, setClock, systemClock } from '../../core/clock'
import { createTemplate, type DbTemplate } from '../../core/db'
import { runBridge } from './index'
import { company, snapshot } from './__fixtures__/snapshot'

const BOOT_MS = 60_000
let template: DbTemplate | undefined
const open: PGlite[] = []

beforeAll(async () => {
  setClock(fixedClock('2026-03-15T14:00:00-04:00'))
  template = await createTemplate()
}, BOOT_MS)
afterAll(async () => {
  setClock(systemClock)
  await Promise.all(open.map((d) => d.close()))
  await template?.close()
}, BOOT_MS)

async function fresh(): Promise<PGlite> {
  if (template === undefined) throw new Error('the template did not boot')
  const db = await template.clone()
  open.push(db)
  return db
}

// Blank by text.ts, but not by String.prototype.trim.
const INVISIBLE = ['⠀', '​', '⁠​', '\u{e0020}']

test('EV-1 the invisible samples are blank by text.ts and survive .trim()', () => {
  expect(INVISIBLE.length).toBeGreaterThan(0)
  for (const s of INVISIBLE) {
    expect(isBlank(s), JSON.stringify(s)).toBe(true)
    expect(s.trim(), JSON.stringify(s)).not.toBe('')
  }
})

describe('FX3 defect 6: outstanding years text is blank by the one definition (EV-1, END-1; SC R41)', () => {
  test.each(INVISIBLE.map((s) => [JSON.stringify(s), s]))(
    'EV-1 END-1 R41 every year filed and outstanding_years %s (blank by text.ts) raises no unfiled-years item, and the return is made',
    async (_, s) => {
      const db = await fresh()
      const entity = company(1, { all_prior_years_filed: 'yes', outstanding_years: s })
      const res = await runBridge(db, snapshot(entity))
      expect(res.items.map((i) => i.kind)).toEqual([])
      expect(res.created.map((c) => c.corporationId)).toEqual([entity.corporation?.id])
    },
    BOOT_MS,
  )

  test('END-1 R41 planted: visible text between invisible characters is still unfiled-years text, and no return is guessed', async () => {
    const db = await fresh()
    const entity = company(1, { all_prior_years_filed: 'yes', outstanding_years: '​2023⠀' })
    const res = await runBridge(db, snapshot(entity))
    expect(res.items.map((i) => i.kind)).toEqual(['unfiled_years_text'])
    expect(res.items[0]).toMatchObject({ corporationId: entity.corporation?.id, taxYear: null })
    expect(res.created).toEqual([])
  }, BOOT_MS)

  test('END-1 control: ordinary spaces and an empty value raise no item; "no" raises one whatever the text', async () => {
    const db = await fresh()
    const res = await runBridge(
      db,
      snapshot(
        company(1, { all_prior_years_filed: 'yes', outstanding_years: '  \t' }),
        company(2, { all_prior_years_filed: 'yes', outstanding_years: '' }),
        company(3, { all_prior_years_filed: 'no', outstanding_years: '⠀' }),
      ),
    )
    expect(res.items.map((i) => [i.kind, i.corporationId])).toEqual([['unfiled_years_text', company(3).corporation?.id]])
    expect(res.created).toHaveLength(2)
  }, BOOT_MS)
})
